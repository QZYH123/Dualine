import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { languageForPath } from "../src/lib/language.js";
import { packageRoot } from "./root.js";
import { fileLines, lineCount, readTextFile, resolveProjectsDir, slugifyProjectId } from "./validate.js";

const SKIP_DIRS = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  "export",
  "target",
  "vendor",
  ".venv",
  "__pycache__",
]);

const DOC_LANG = new Set(["markdown", "mdx"]);

export class InitError extends Error {
  readonly exitCode: number;

  constructor(message: string, exitCode = 1) {
    super(message);
    this.name = "InitError";
    this.exitCode = exitCode;
  }
}

export interface DetectedProject {
  slug: string;
  lang: string | null;
  entry: string | null;
  lines: number;
}

export interface InitOptions {
  force?: boolean;
  pkgRoot?: string;
}

export interface InitResult {
  glossPath: string;
  skillStatus: "installed" | "skipped";
}

export function skillSourcePath(pkgRoot = packageRoot()): string {
  return join(pkgRoot, ".cursor", "skills", "write-gloss", "SKILL.md");
}

/** Shiki id for a source path; docs, gloss.md, and unknown extensions are out. */
export function sourceLang(rel: string): string | null {
  const base = rel.replace(/\\/g, "/").split("/").pop() ?? "";
  if (!base || base === "gloss.md") return null;
  const lang = languageForPath(rel);
  if (!lang || DOC_LANG.has(lang)) return null;
  return lang;
}

export function majorityLang(rels: readonly string[]): string | null {
  const counts = new Map<string, number>();
  for (const rel of rels) {
    const lang = sourceLang(rel);
    if (!lang) continue;
    counts.set(lang, (counts.get(lang) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestN = 0;
  for (const [lang, n] of counts) {
    if (n > bestN || (n === bestN && best !== null && lang.localeCompare(best) < 0)) {
      best = lang;
      bestN = n;
    }
  }
  return best;
}

function parseRel(rel: string): { dir: string; stem: string; ext: string } {
  const norm = rel.replace(/\\/g, "/");
  const i = norm.lastIndexOf("/");
  const dir = i === -1 ? "" : norm.slice(0, i);
  const base = i === -1 ? norm : norm.slice(i + 1);
  const dot = base.lastIndexOf(".");
  if (dot <= 0) return { dir, stem: base, ext: "" };
  return { dir, stem: base.slice(0, dot), ext: base.slice(dot + 1) };
}

const ENTRY_RULES: ((rel: string) => boolean)[] = [
  (rel) => {
    const p = parseRel(rel);
    return p.dir === "src" && p.stem === "index";
  },
  (rel) => {
    const p = parseRel(rel);
    return p.dir === "src" && p.stem === "main";
  },
  (rel) => {
    const p = parseRel(rel);
    return p.dir === "src" && p.stem === "app";
  },
  (rel) => {
    const p = parseRel(rel);
    return p.dir === "" && p.stem === "main";
  },
  (rel) => {
    const p = parseRel(rel);
    return p.dir === "" && p.stem === "index";
  },
  (rel) => {
    const p = parseRel(rel);
    return p.dir === "" && p.stem === "app";
  },
  (rel) => /^cmd\/[^/]+\/main\.go$/.test(rel.replace(/\\/g, "/")),
  (rel) => {
    const p = parseRel(rel);
    return p.dir === "lib" && (p.ext === "ts" || p.ext === "js");
  },
];

function pathDepth(rel: string): number {
  const norm = rel.replace(/\\/g, "/");
  if (!norm) return 0;
  return norm.split("/").length;
}

function baseName(rel: string): string {
  const norm = rel.replace(/\\/g, "/");
  return norm.split("/").pop() ?? "";
}

function isSecondaryEntry(rel: string): boolean {
  const base = baseName(rel);
  if (base === "__main__.py" || base === "cli.py") return true;
  const p = parseRel(rel);
  return p.stem === "main" || p.stem === "app" || p.stem === "server";
}

function isInitPy(rel: string): boolean {
  return baseName(rel) === "__init__.py";
}

function nonBlankLineCount(text: string): number {
  return fileLines(text).filter((line) => line.trim() !== "").length;
}

function isThinEntry(rel: string, nonBlankLines?: Readonly<Record<string, number>>): boolean {
  if (!nonBlankLines || !Object.hasOwn(nonBlankLines, rel)) return false;
  return (nonBlankLines[rel] ?? 0) < 3;
}

function pickShallowestSorted(rels: readonly string[]): string | null {
  if (!rels.length) return null;
  const ranked = [...rels].sort((a, b) => {
    const depthDelta = pathDepth(a) - pathDepth(b);
    if (depthDelta !== 0) return depthDelta;
    return a.localeCompare(b);
  });
  return ranked[0] ?? null;
}

export interface PickEntryOptions {
  /** Non-blank line counts keyed by rel path. Missing keys are treated as substantial. */
  nonBlankLines?: Readonly<Record<string, number>>;
}

export function pickEntry(rels: readonly string[], opts?: PickEntryOptions): string | null {
  const candidates = [...rels]
    .filter((rel) => sourceLang(rel))
    .sort((a, b) => a.localeCompare(b));
  for (const rule of ENTRY_RULES) {
    const hit = candidates.find(rule);
    if (hit) return hit;
  }
  const secondary = pickShallowestSorted(candidates.filter(isSecondaryEntry));
  if (secondary) return secondary;
  const preferred = candidates.filter(
    (rel) => !isInitPy(rel) && !isThinEntry(rel, opts?.nonBlankLines),
  );
  if (preferred.length) return preferred[0] ?? null;
  return candidates[0] ?? null;
}

export function anchorSpan(lines: number): string {
  if (lines <= 1) return "#L1";
  return `#L1-L${Math.min(20, lines)}`;
}

export function renderStarter(opts: {
  slug: string;
  lang: string | null;
  entry: string | null;
  lines: number;
}): string {
  const langLine = opts.lang ? `lang: ${opts.lang}\n` : "";
  const body =
    opts.entry && opts.lines >= 1
      ? `从入口讲起。[程序从这里开始](${opts.entry}${anchorSpan(opts.lines)})。把这句话换成真正的解释：每个要紧的说法都指向几行代码，没有锚点的段落继承上一段的代码。`
      : "从入口讲起。这个文件夹里没找到源文件，先把第一枚锚点指向真实行号。";
  return `---
name: ${opts.slug}
tagline: 一句话说它是什么
${langLine}---

# ${opts.slug} 是怎么工作的

两三句导语：读完这篇，你会摸清什么。导语不带锚点，不驱动代码栏。

## 它做什么

${body}
`;
}

function walkRelFiles(root: string): string[] {
  const out: string[] = [];
  const stack: { abs: string; rel: string }[] = [{ abs: root, rel: "" }];
  while (stack.length) {
    const { abs, rel } = stack.pop()!;
    let entries;
    try {
      entries = readdirSync(abs, { withFileTypes: true });
    } catch {
      continue;
    }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    const dirs: { abs: string; rel: string }[] = [];
    for (const ent of entries) {
      if (ent.name.startsWith(".")) continue;
      const childRel = rel ? `${rel}/${ent.name}` : ent.name;
      const childAbs = join(abs, ent.name);
      if (ent.isDirectory()) {
        if (SKIP_DIRS.has(ent.name)) continue;
        dirs.push({ abs: childAbs, rel: childRel });
      } else if (ent.isFile()) {
        out.push(childRel);
      }
    }
    for (let i = dirs.length - 1; i >= 0; i--) stack.push(dirs[i]!);
  }
  out.sort((a, b) => a.localeCompare(b));
  return out;
}

export function detectProject(dir: string): DetectedProject {
  const abs = resolve(dir);
  const slug = slugifyProjectId(basename(abs));
  const files: { rel: string; text: string }[] = [];
  for (const rel of walkRelFiles(abs)) {
    if (!sourceLang(rel)) continue;
    const text = readTextFile(join(abs, rel));
    if (text === null) continue;
    files.push({ rel, text });
  }
  const rels = files.map((f) => f.rel);
  const lang = majorityLang(rels);
  const withLines = files.filter((f) => lineCount(f.text) >= 1);
  const nonBlankLines: Record<string, number> = {};
  for (const f of withLines) {
    nonBlankLines[f.rel] = nonBlankLineCount(f.text);
  }
  const entry = pickEntry(
    withLines.map((f) => f.rel),
    { nonBlankLines },
  );
  const lines = entry ? lineCount(files.find((f) => f.rel === entry)!.text) : 0;
  return { slug, lang, entry, lines };
}

function installWriteGlossSkill(
  projectDir: string,
  force: boolean,
  pkgRoot: string,
): "installed" | "skipped" {
  const src = skillSourcePath(pkgRoot);
  if (!existsSync(src)) {
    throw new InitError(`找不到 write-gloss 技能：${src}\nwrite-gloss skill not found at ${src}`);
  }
  const destDir = join(projectDir, ".cursor", "skills", "write-gloss");
  const dest = join(destDir, "SKILL.md");
  if (existsSync(dest) && !force) return "skipped";
  mkdirSync(destDir, { recursive: true });
  copyFileSync(src, dest);
  return "installed";
}

export function runInit(dir: string, opts: InitOptions = {}): InitResult {
  const abs = resolveProjectsDir(dir);
  try {
    if (!statSync(abs).isDirectory()) {
      throw new InitError(`not a directory: ${abs}`);
    }
  } catch (err) {
    if (err instanceof InitError) throw err;
    throw new InitError(`directory not found: ${abs}`);
  }

  const glossPath = join(abs, "gloss.md");
  if (existsSync(glossPath)) {
    try {
      if (statSync(glossPath).isDirectory()) {
        throw new InitError(
          "gloss.md 是一个目录，没法写起步笔记\ngloss.md is a directory; cannot write the starter note",
        );
      }
    } catch (err) {
      if (err instanceof InitError) throw err;
    }
    if (!opts.force) {
      throw new InitError("gloss.md 已存在，加 --force 覆写\ngloss.md already exists; pass --force to overwrite");
    }
  }

  const detected = detectProject(abs);
  writeFileSync(glossPath, renderStarter(detected), "utf8");
  const skillStatus = installWriteGlossSkill(abs, opts.force === true, opts.pkgRoot ?? packageRoot());
  return { glossPath, skillStatus };
}
