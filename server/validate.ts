import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseGloss,
  sameRef,
  type AnchorInline,
  type CodeRef,
  type Inline,
} from "../src/lib/gloss.js";
import { looksLikeWindowsPath } from "../src/lib/notice.js";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export const ID_RE = /^[a-z0-9][a-z0-9-_]*$/;
export const MAX_FILE_BYTES = 512 * 1024;

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

export interface LocatedRef {
  loc: string;
  ref: CodeRef;
}

export interface RefProblem {
  loc: string;
  ref: CodeRef;
  reason: "outside" | "missing" | "range";
  message: string;
}

export function isValidProjectId(id: string): boolean {
  return ID_RE.test(id);
}

/**
 * Trim, expand a leading `~/`, and resolve from cwd.
 * A Windows drive/UNC path is left as pasted so the notice can name it —
 * POSIX `resolve` would otherwise hide it under `$PWD`.
 */
export function resolveProjectsDir(raw: string): string {
  const s = raw.trim();
  if (s === "~") return homedir();
  if (s.startsWith("~/")) return resolve(homedir(), s.slice(2));
  if (looksLikeWindowsPath(s)) return s;
  return resolve(s);
}

export function projectsRoot(): string {
  const raw = process.env.GLOSS_PROJECTS_DIR;
  if (raw == null || raw.trim() === "") {
    return resolve(join(REPO_ROOT, "examples"));
  }
  return resolveProjectsDir(raw);
}

export type RootStatus = "ok" | "missing" | "not-directory";

/** Resolve the projects folder and say whether it can be listed. */
export function inspectRoot(root = projectsRoot()): {
  root: string;
  status: RootStatus;
} {
  const abs = looksLikeWindowsPath(root) ? root : resolve(root);
  try {
    const st = statSync(abs);
    if (!st.isDirectory()) return { root: abs, status: "not-directory" };
    return { root: abs, status: "ok" };
  } catch {
    return { root: abs, status: "missing" };
  }
}

export function refLabel(ref: CodeRef): string {
  return ref.start === ref.end
    ? `${ref.file}#L${ref.start}`
    : `${ref.file}#L${ref.start}-L${ref.end}`;
}

export function lineCount(src: string): number {
  if (src.length === 0) return 0;
  const lines = src.split(/\r?\n/);
  if (lines[lines.length - 1] === "") lines.pop();
  return lines.length;
}

export function safeResolve(root: string, rel: string): string | null {
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

export function readTextFile(abs: string): string | null {
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

function anchorsIn(inlines: Inline[]): AnchorInline[] {
  const out: AnchorInline[] = [];
  for (const node of inlines) {
    if (node.kind === "anchor") {
      out.push(node);
      out.push(...anchorsIn(node.children));
    }
  }
  return out;
}

export function collectRefs(glossSrc: string): LocatedRef[] {
  const { doc } = parseGloss(glossSrc);
  const out: LocatedRef[] = [];

  for (const a of anchorsIn(doc.lead)) {
    out.push({ loc: a.id, ref: a.ref });
  }

  for (const chapter of doc.chapters) {
    for (const passage of chapter.passages) {
      const anchors = anchorsIn(passage.inlines);
      for (const a of anchors) {
        out.push({ loc: `${passage.chapterId}.${a.id}`, ref: a.ref });
      }
      if (
        passage.ref &&
        !anchors.some((a) => sameRef(a.ref, passage.ref))
      ) {
        out.push({ loc: `${passage.chapterId}.${passage.id}`, ref: passage.ref });
      }
    }
  }

  return out;
}

function problem(
  loc: string,
  ref: CodeRef,
  reason: RefProblem["reason"],
  suffix: string,
): RefProblem {
  return {
    loc,
    ref,
    reason,
    message: `${loc} → ${refLabel(ref)}: ${suffix}`,
  };
}

export function checkRefs(projectDir: string, refs: LocatedRef[]): RefProblem[] {
  const cache = new Map<string, string | null>();
  const out: RefProblem[] = [];

  const textOf = (abs: string): string | null => {
    if (cache.has(abs)) return cache.get(abs) ?? null;
    const text = readTextFile(abs);
    cache.set(abs, text);
    return text;
  };

  for (const { loc, ref } of refs) {
    const abs = safeResolve(projectDir, ref.file);
    if (!abs) {
      out.push(problem(loc, ref, "outside", "path outside project"));
      continue;
    }
    if (!existsSync(abs) || !statSync(abs).isFile()) {
      out.push(problem(loc, ref, "missing", "file missing"));
      continue;
    }
    const text = textOf(abs);
    if (text === null) {
      out.push(problem(loc, ref, "missing", "file missing"));
      continue;
    }
    const n = lineCount(text);
    if (ref.start < 1 || ref.end > n) {
      out.push(problem(loc, ref, "range", `file has ${n} lines`));
    }
  }

  return out;
}
