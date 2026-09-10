/*
 * Gloss document model.
 *
 * A gloss is prose that faces code. The prose is Markdown with one extension:
 * a link whose target is `path#L<start>-L<end>` is an *anchor* — a phrase tied
 * to a span of real code. Every paragraph (passage) faces one span: the first
 * anchor it contains, or an explicit `@[path#L1-L9]` at its start, or — if it
 * has neither — whatever the previous passage faced.
 */

export interface CodeRef {
  file: string;
  start: number; // 1-based, inclusive
  end: number; // 1-based, inclusive
}

export type Inline =
  | { kind: "text"; text: string }
  | { kind: "code"; text: string }
  | { kind: "em"; text: string }
  | { kind: "strong"; text: string }
  | { kind: "anchor"; id: string; children: Inline[]; ref: CodeRef };

export type AnchorInline = Extract<Inline, { kind: "anchor" }>;

export interface Passage {
  id: string;
  chapterId: string;
  inlines: Inline[];
  /** The span this passage faces; null means "inherit from the previous passage". */
  ref: CodeRef | null;
  anchors: AnchorInline[];
}

export interface Chapter {
  id: string;
  index: number; // 1-based
  title: string;
  passages: Passage[];
}

export interface GlossDoc {
  title: string;
  lead: Inline[];
  chapters: Chapter[];
}

export interface ProjectFile {
  path: string;
  lang: string;
  content: string;
}

export interface Project {
  id: string;
  name: string;
  tagline: string;
  lang: string;
  doc: GlossDoc;
  files: Record<string, ProjectFile>;
}

/* ───────────────────────── parsing ───────────────────────── */

const REF_RE = /^([^#\s]+)#L(\d+)(?:-L?(\d+))?$/;

export function parseRef(raw: string): CodeRef | null {
  const m = REF_RE.exec(raw.trim());
  if (!m) return null;
  const start = Number(m[2]);
  const end = m[3] ? Number(m[3]) : start;
  return { file: m[1], start: Math.min(start, end), end: Math.max(start, end) };
}

export function refKey(ref: CodeRef): string {
  return `${ref.file}#L${ref.start}-L${ref.end}`;
}

export function sameRef(a: CodeRef | null, b: CodeRef | null): boolean {
  if (!a || !b) return a === b;
  return a.file === b.file && a.start === b.start && a.end === b.end;
}

interface Frontmatter {
  [key: string]: string;
}

export function splitFrontmatter(src: string): { meta: Frontmatter; body: string } {
  const meta: Frontmatter = {};
  if (!src.startsWith("---")) return { meta, body: src };
  const end = src.indexOf("\n---", 3);
  if (end === -1) return { meta, body: src };
  const block = src.slice(3, end).trim();
  for (const line of block.split("\n")) {
    const i = line.indexOf(":");
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return { meta, body: src.slice(end + 4) };
}

/** Tokenise inline markup: anchors, `code`, **strong**, *em*. */
export function parseInlines(text: string, idPrefix: string): Inline[] {
  const out: Inline[] = [];
  let anchorN = 0;
  let i = 0;
  let buf = "";

  const flush = () => {
    if (buf) out.push({ kind: "text", text: buf });
    buf = "";
  };

  while (i < text.length) {
    const ch = text[i];

    if (ch === "[") {
      const close = text.indexOf("](", i);
      const paren = close === -1 ? -1 : text.indexOf(")", close + 2);
      if (close !== -1 && paren !== -1) {
        const label = text.slice(i + 1, close);
        const ref = parseRef(text.slice(close + 2, paren));
        if (ref) {
          flush();
          anchorN += 1;
          out.push({
            kind: "anchor",
            id: `${idPrefix}.a${anchorN}`,
            children: parseInlines(label, `${idPrefix}.a${anchorN}`),
            ref,
          });
          i = paren + 1;
          continue;
        }
      }
    }

    if (ch === "`") {
      const close = text.indexOf("`", i + 1);
      if (close !== -1) {
        flush();
        out.push({ kind: "code", text: text.slice(i + 1, close) });
        i = close + 1;
        continue;
      }
    }

    if (ch === "*" && text[i + 1] === "*") {
      const close = text.indexOf("**", i + 2);
      if (close !== -1) {
        flush();
        out.push({ kind: "strong", text: text.slice(i + 2, close) });
        i = close + 2;
        continue;
      }
    }

    if (ch === "*") {
      const close = text.indexOf("*", i + 1);
      if (close !== -1) {
        flush();
        out.push({ kind: "em", text: text.slice(i + 1, close) });
        i = close + 1;
        continue;
      }
    }

    buf += ch;
    i += 1;
  }
  flush();
  return out;
}

export function inlineText(inlines: Inline[]): string {
  return inlines
    .map((x) => (x.kind === "anchor" ? inlineText(x.children) : x.text))
    .join("");
}

export interface ParsedGloss {
  meta: Frontmatter;
  doc: GlossDoc;
}

export function parseGloss(src: string): ParsedGloss {
  const { meta, body } = splitFrontmatter(src);
  const lines = body.replace(/\r\n/g, "\n").split("\n");

  let title = meta.name ?? "";
  const lead: Inline[] = [];
  const chapters: Chapter[] = [];
  let chapter: Chapter | null = null;
  let para: string[] = [];
  let passageN = 0;

  const endParagraph = () => {
    if (para.length === 0) return;
    const text = para.join(" ").trim();
    para = [];
    if (!text) return;

    if (!chapter) {
      lead.push(...parseInlines(text, "lead"));
      return;
    }

    passageN += 1;
    const id = `p${passageN}`;
    let explicit: CodeRef | null = null;
    let rest = text;
    const m = /^@\[([^\]]+)\]\s*/.exec(rest);
    if (m) {
      explicit = parseRef(m[1]);
      rest = rest.slice(m[0].length);
    }
    const inlines = parseInlines(rest, id);
    const anchors = inlines.filter((x): x is AnchorInline => x.kind === "anchor");
    chapter.passages.push({
      id,
      chapterId: chapter.id,
      inlines,
      ref: explicit ?? anchors[0]?.ref ?? null,
      anchors,
    });
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line.startsWith("## ")) {
      endParagraph();
      const index = chapters.length + 1;
      chapter = { id: `c${index}`, index, title: line.slice(3).trim(), passages: [] };
      chapters.push(chapter);
      continue;
    }
    if (line.startsWith("# ")) {
      endParagraph();
      title = line.slice(2).trim();
      continue;
    }
    if (line.trim() === "") {
      endParagraph();
      continue;
    }
    para.push(line.trim());
  }
  endParagraph();

  return { meta, doc: { title, lead, chapters } };
}

/* ───────────────────────── helpers ───────────────────────── */

const CJK_NUMERALS = ["〇", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];

export function cjkNumeral(n: number): string {
  if (n <= 10) return CJK_NUMERALS[n];
  if (n < 20) return "十" + CJK_NUMERALS[n - 10];
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  return CJK_NUMERALS[tens] + "十" + (ones ? CJK_NUMERALS[ones] : "");
}

export function allPassages(doc: GlossDoc): Passage[] {
  return doc.chapters.flatMap((c) => c.passages);
}

/** Resolve the span each passage faces, applying inheritance. */
export function resolveRefs(doc: GlossDoc): Map<string, CodeRef | null> {
  const out = new Map<string, CodeRef | null>();
  let current: CodeRef | null = null;
  for (const p of allPassages(doc)) {
    if (p.ref) current = p.ref;
    out.set(p.id, current);
  }
  return out;
}

/* ───────────────────────── reverse map (code → prose) ───────────────────────── */

export interface GlossHit {
  anchorId: string;
  passageId: string;
  ref: CodeRef;
}

/**
 * For each file, every anchor that points into it, most specific span first.
 * A code line's "explaining anchor" is the narrowest span that covers it, so
 * clicking L27 inside a big `L18-L59` block prefers the anchor for `L27-L29`.
 */
export function buildReverseIndex(doc: GlossDoc): Map<string, GlossHit[]> {
  const out = new Map<string, GlossHit[]>();
  for (const p of allPassages(doc)) {
    for (const a of p.anchors) {
      const list = out.get(a.ref.file) ?? [];
      list.push({ anchorId: a.id, passageId: p.id, ref: a.ref });
      out.set(a.ref.file, list);
    }
  }
  for (const list of out.values()) {
    list.sort((x, y) => x.ref.end - x.ref.start - (y.ref.end - y.ref.start));
  }
  return out;
}

export function hitAtLine(hits: GlossHit[] | undefined, line: number): GlossHit | null {
  if (!hits) return null;
  for (const h of hits) if (line >= h.ref.start && line <= h.ref.end) return h;
  return null;
}

export function buildProject(
  id: string,
  glossSrc: string,
  files: Record<string, string>,
): Project {
  const { meta, doc } = parseGloss(glossSrc);
  const lang = meta.lang ?? "typescript";
  const projectFiles: Record<string, ProjectFile> = {};
  for (const [path, content] of Object.entries(files)) {
    projectFiles[path] = { path, lang: langFor(path, lang), content };
  }
  return {
    id,
    name: meta.name ?? doc.title,
    tagline: meta.tagline ?? "",
    lang,
    doc,
    files: projectFiles,
  };
}

function langFor(path: string, fallback: string): string {
  const ext = path.split(".").pop() ?? "";
  switch (ext) {
    case "ts":
    case "tsx":
      return "typescript";
    case "js":
    case "jsx":
    case "mjs":
      return "javascript";
    case "py":
      return "python";
    case "json":
      return "json";
    case "md":
      return "markdown";
    case "css":
      return "css";
    case "html":
      return "html";
    default:
      return fallback;
  }
}
