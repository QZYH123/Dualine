/**
 * Verify every gloss anchor and explicit passage ref points at a real file
 * and a line range inside that file.
 *
 *   npx tsx scripts/check-gloss.ts
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import {
  allPassages,
  parseGloss,
  parseRef,
  type CodeRef,
  type Inline,
} from "../src/lib/gloss.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const EXAMPLES = join(ROOT, "examples");

interface LocatedRef {
  loc: string;
  ref: CodeRef;
}

function refLabel(ref: CodeRef): string {
  return ref.start === ref.end
    ? `${ref.file}#L${ref.start}`
    : `${ref.file}#L${ref.start}-L${ref.end}`;
}

function sameRef(a: CodeRef, b: CodeRef): boolean {
  return a.file === b.file && a.start === b.start && a.end === b.end;
}

function lineCount(src: string): number {
  if (src.length === 0) return 0;
  const lines = src.split(/\r?\n/);
  if (lines[lines.length - 1] === "") lines.pop();
  return lines.length;
}

function anchorsIn(inlines: Inline[]): Extract<Inline, { kind: "anchor" }>[] {
  const out: Extract<Inline, { kind: "anchor" }>[] = [];
  for (const node of inlines) {
    if (node.kind === "anchor") {
      out.push(node);
      out.push(...anchorsIn(node.children));
    }
  }
  return out;
}

function bodyOf(src: string): string {
  if (!src.startsWith("---")) return src;
  const end = src.indexOf("\n---", 3);
  return end === -1 ? src : src.slice(end + 4);
}

/** Paragraph-leading `@[path#L1-L9]` markers, in document order. */
function explicitRefsFromSource(src: string): CodeRef[] {
  const refs: CodeRef[] = [];
  for (const block of bodyOf(src).split(/\n\s*\n/)) {
    const m = /^@\[([^\]]+)\]/.exec(block.trim());
    if (!m) continue;
    const ref = parseRef(m[1]);
    if (ref) refs.push(ref);
  }
  return refs;
}

function shortlyFixturePaths(): Set<string> {
  const src = readFileSync(join(ROOT, "src/fixtures/shortly.ts"), "utf8");
  const keys = new Set<string>();
  for (const m of src.matchAll(/"(src\/[^"]+)":\s/g)) {
    keys.add(m[1]);
  }
  return keys;
}

function collectRefs(src: string): LocatedRef[] {
  const { doc } = parseGloss(src);
  const out: LocatedRef[] = [];

  for (const a of anchorsIn(doc.lead)) {
    out.push({ loc: a.id, ref: a.ref });
  }

  const passages = allPassages(doc);
  for (const p of passages) {
    for (const a of p.anchors) {
      out.push({ loc: `${p.chapterId}.${a.id}`, ref: a.ref });
    }
  }

  let pi = 0;
  for (const ref of explicitRefsFromSource(src)) {
    while (
      pi < passages.length &&
      !(passages[pi].ref && sameRef(passages[pi].ref!, ref))
    ) {
      pi += 1;
    }
    const p = passages[pi];
    const loc = p
      ? `${p.chapterId}.${p.id}`
      : `@[${refLabel(ref)}]`;
    if (p) pi += 1;
    out.push({ loc, ref });
  }

  return out;
}

function underProject(projectDir: string, file: string): string | null {
  const root = resolve(projectDir);
  const abs = resolve(root, file);
  if (abs === root || abs.startsWith(root + sep)) return abs;
  return null;
}

function glossFiles(): string[] {
  if (!existsSync(EXAMPLES)) return [];
  return readdirSync(EXAMPLES)
    .sort()
    .map((name) => join(EXAMPLES, name, "gloss.md"))
    .filter((p) => existsSync(p) && statSync(p).isFile());
}

function main(): number {
  const fixturePaths = shortlyFixturePaths();
  const files = glossFiles();
  let problems = 0;
  let warnings = 0;
  let refsChecked = 0;

  for (const glossPath of files) {
    const projectDir = dirname(glossPath);
    const projectId = relative(EXAMPLES, projectDir);
    const glossRel = relative(ROOT, glossPath).split("\\").join("/");
    const src = readFileSync(glossPath, "utf8");
    const located = collectRefs(src);
    refsChecked += located.length;

    for (const { loc, ref } of located) {
      const abs = underProject(projectDir, ref.file);
      const label = `${glossRel}: ${loc} → ${refLabel(ref)}`;

      if (!abs || !existsSync(abs) || !statSync(abs).isFile()) {
        console.log(`${label} (file missing)`);
        problems += 1;
      } else {
        const n = lineCount(readFileSync(abs, "utf8"));
        if (ref.start < 1 || ref.end > n) {
          console.log(`${label} (file has ${n} lines)`);
          problems += 1;
        }
      }

      if (projectId === "shortly" && !fixturePaths.has(ref.file)) {
        console.log(`${label} (warning: not in shortly fixture)`);
        warnings += 1;
      }
    }
  }

  const glossN = files.length;
  const glossWord = glossN === 1 ? "gloss" : "glosses";
  const problemWord = problems === 1 ? "problem" : "problems";
  const warnPart = warnings > 0 ? `, ${warnings} warning${warnings === 1 ? "" : "s"}` : "";
  console.log(
    `${glossN} ${glossWord} checked, ${refsChecked} refs, ${problems} ${problemWord}${warnPart}`,
  );
  return problems > 0 ? 1 : 0;
}

process.exit(main());
