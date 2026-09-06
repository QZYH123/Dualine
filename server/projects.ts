import {
  existsSync,
  readdirSync,
  readFileSync,
  realpathSync,
  statSync,
} from "node:fs";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ID_RE = /^[a-z0-9][a-z0-9-_]*$/;
const MAX_FILES = 200;
const MAX_FILE_BYTES = 512 * 1024;
const SKIP_DIRS = new Set(["node_modules", "dist"]);
const BINARY_EXT = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".ico",
  ".bmp",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
  ".otf",
  ".zip",
  ".gz",
  ".tar",
  ".7z",
  ".rar",
  ".pdf",
  ".exe",
  ".dll",
  ".so",
  ".dylib",
  ".mp3",
  ".mp4",
  ".wav",
  ".webm",
  ".class",
  ".o",
  ".wasm",
]);

const LINK_REF_RE = /\]\(([^)\s#]+)#L(\d+)(?:-L?(\d+))?\)/g;
const AT_REF_RE = /@\[([^\]\s#]+)#L(\d+)(?:-L?(\d+))?\]/g;

export interface CodeRef {
  file: string;
  start: number;
  end: number;
}

export interface ProjectSummary {
  id: string;
  name: string;
  tagline: string;
  lang: string;
}

export interface ProjectDetail extends ProjectSummary {
  gloss: string;
  files: Record<string, string>;
  warnings: string[];
}

export function isValidProjectId(id: string): boolean {
  return ID_RE.test(id);
}

export function projectsRoot(): string {
  return resolve(process.env.GLOSS_PROJECTS_DIR ?? join(REPO_ROOT, "examples"));
}

export function listProjects(root = projectsRoot()): ProjectSummary[] {
  if (!existsSync(root) || !statSync(root).isDirectory()) return [];
  const out: ProjectSummary[] = [];
  for (const name of readdirSync(root).sort()) {
    if (!isValidProjectId(name)) continue;
    const dir = join(root, name);
    const glossPath = join(dir, "gloss.md");
    if (!statSync(dir).isDirectory() || !existsSync(glossPath)) continue;
    const gloss = readFileSync(glossPath, "utf8");
    out.push({ id: name, ...metaFromGloss(name, gloss) });
  }
  return out;
}

export function loadProject(
  id: string,
  root = projectsRoot(),
): ProjectDetail | null {
  if (!isValidProjectId(id)) return null;
  const projectDir = safeResolve(root, id);
  if (!projectDir) return null;
  const glossPath = join(projectDir, "gloss.md");
  if (!existsSync(glossPath) || !statSync(glossPath).isFile()) return null;

  const gloss = readFileSync(glossPath, "utf8");
  const meta = metaFromGloss(id, gloss);
  const refs = extractRefs(gloss);
  const warnings: string[] = [];
  const files: Record<string, string> = {};

  const seenWarn = new Set<string>();
  const warn = (msg: string) => {
    if (seenWarn.has(msg)) return;
    seenWarn.add(msg);
    warnings.push(msg);
  };

  for (const ref of refs) {
    const label = refLabel(ref);
    const abs = safeResolve(projectDir, ref.file);
    if (!abs) {
      warn(`${label}: path outside project`);
      continue;
    }
    if (!existsSync(abs) || !statSync(abs).isFile()) {
      warn(`${label}: file missing`);
      continue;
    }
    const text = readTextFile(abs);
    if (text === null) {
      warn(`${label}: file missing`);
      continue;
    }
    const n = lineCount(text);
    if (ref.start < 1 || ref.end > n) {
      warn(`${label}: file has ${n} lines`);
    }
    addFile(files, projectDir, abs, text);
  }

  const srcRoot = join(projectDir, "src");
  if (existsSync(srcRoot) && statSync(srcRoot).isDirectory()) {
    for (const abs of walkTextFiles(srcRoot)) {
      if (Object.keys(files).length >= MAX_FILES) break;
      const rel = relPath(projectDir, abs);
      if (!rel || rel in files) continue;
      const text = readTextFile(abs);
      if (text === null) continue;
      files[rel] = text;
    }
  }

  return { id, ...meta, gloss, files, warnings };
}

function metaFromGloss(
  id: string,
  src: string,
): Omit<ProjectSummary, "id"> {
  const meta = parseFrontmatter(src);
  return {
    name: meta.name || id,
    tagline: meta.tagline ?? "",
    lang: meta.lang || "typescript",
  };
}

function parseFrontmatter(src: string): Record<string, string> {
  const meta: Record<string, string> = {};
  if (!src.startsWith("---")) return meta;
  const end = src.indexOf("\n---", 3);
  if (end === -1) return meta;
  for (const line of src.slice(3, end).trim().split("\n")) {
    const i = line.indexOf(":");
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return meta;
}

export function extractRefs(src: string): CodeRef[] {
  const out: CodeRef[] = [];
  const seen = new Set<string>();
  const add = (file: string, startRaw: string, endRaw: string | undefined) => {
    const start = Number(startRaw);
    const end = endRaw ? Number(endRaw) : start;
    const ref: CodeRef = {
      file,
      start: Math.min(start, end),
      end: Math.max(start, end),
    };
    const key = refLabel(ref);
    if (seen.has(key)) return;
    seen.add(key);
    out.push(ref);
  };
  for (const m of src.matchAll(LINK_REF_RE)) add(m[1], m[2], m[3]);
  for (const m of src.matchAll(AT_REF_RE)) add(m[1], m[2], m[3]);
  return out;
}

function refLabel(ref: CodeRef): string {
  return ref.start === ref.end
    ? `${ref.file}#L${ref.start}`
    : `${ref.file}#L${ref.start}-L${ref.end}`;
}

function lineCount(src: string): number {
  if (src.length === 0) return 0;
  const lines = src.split(/\r?\n/);
  if (lines[lines.length - 1] === "") lines.pop();
  return lines.length;
}

function safeResolve(root: string, rel: string): string | null {
  if (!rel || rel.includes("\0")) return null;
  const rootAbs = resolve(root);
  const abs = resolve(rootAbs, rel);
  if (abs !== rootAbs && !abs.startsWith(rootAbs + sep)) return null;
  try {
    if (existsSync(abs)) {
      const real = realpathSync(abs);
      const realRoot = realpathSync(rootAbs);
      if (real !== realRoot && !real.startsWith(realRoot + sep)) return null;
      return real;
    }
  } catch {
    return null;
  }
  return abs;
}

function relPath(root: string, abs: string): string | null {
  const rel = relative(resolve(root), abs);
  if (!rel || rel.startsWith("..") || rel.includes(`..${sep}`)) return null;
  return rel.split(sep).join("/");
}

function addFile(
  files: Record<string, string>,
  projectDir: string,
  abs: string,
  text: string,
): void {
  if (Object.keys(files).length >= MAX_FILES) return;
  const rel = relPath(projectDir, abs);
  if (!rel || rel in files) return;
  files[rel] = text;
}

function readTextFile(abs: string): string | null {
  let st;
  try {
    st = statSync(abs);
  } catch {
    return null;
  }
  if (!st.isFile() || st.size > MAX_FILE_BYTES) return null;
  if (BINARY_EXT.has(extname(abs).toLowerCase())) return null;
  const buf = readFileSync(abs);
  if (buf.includes(0)) return null;
  return buf.toString("utf8");
}

function walkTextFiles(dir: string): string[] {
  const out: string[] = [];
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop()!;
    let entries;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const ent of entries) {
      if (ent.name.startsWith(".")) continue;
      const child = join(current, ent.name);
      if (ent.isDirectory()) {
        if (SKIP_DIRS.has(ent.name)) continue;
        stack.push(child);
      } else if (ent.isFile()) {
        out.push(child);
      }
    }
  }
  return out;
}
