import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join, relative, resolve, sep } from "node:path";
import { splitFrontmatter } from "../src/lib/gloss.js";
import {
  checkRefs,
  collectRefs,
  inspectRoot,
  isValidProjectId,
  projectsRoot,
  readTextFile,
  safeResolve,
} from "./validate.js";

export {
  inspectRoot,
  isValidProjectId,
  projectsRoot,
  type RootStatus,
} from "./validate.js";

export const MAX_FILES = 200;
const SKIP_DIRS = new Set(["node_modules", "dist"]);

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
  /** Max mtime of gloss.md and the files it faces — for the reader's quiet reload chip. */
  rev: string;
}

function hasGloss(dir: string): boolean {
  const glossPath = join(dir, "gloss.md");
  try {
    return existsSync(glossPath) && statSync(glossPath).isFile();
  } catch {
    return false;
  }
}

function childProjects(root: string): ProjectSummary[] {
  let names: string[];
  try {
    names = readdirSync(root).sort();
  } catch {
    return [];
  }
  const out: ProjectSummary[] = [];
  for (const name of names) {
    if (!isValidProjectId(name)) continue;
    const dir = join(root, name);
    try {
      if (!statSync(dir).isDirectory() || !hasGloss(dir)) continue;
      const gloss = readFileSync(join(dir, "gloss.md"), "utf8");
      out.push({ id: name, ...metaFromGloss(name, gloss) });
    } catch {
      continue;
    }
  }
  return out;
}

function selfProject(root: string): ProjectSummary | null {
  const id = basename(resolve(root));
  if (!isValidProjectId(id) || !hasGloss(root)) return null;
  try {
    const gloss = readFileSync(join(root, "gloss.md"), "utf8");
    return { id, ...metaFromGloss(id, gloss) };
  } catch {
    return null;
  }
}

/**
 * Folder of child projects, or — if none — the folder itself when it has gloss.md
 * and a servable name. Children win when both exist.
 */
export function listProjects(root = projectsRoot()): ProjectSummary[] {
  if (inspectRoot(root).status !== "ok") return [];
  const children = childProjects(root);
  if (children.length > 0) return children;
  const self = selfProject(root);
  return self ? [self] : [];
}

/** Child `<root>/<id>` first; otherwise `<root>` when its basename is `id`. */
export function resolveProjectDir(
  id: string,
  root = projectsRoot(),
): string | null {
  if (!isValidProjectId(id)) return null;
  const child = safeResolve(root, id);
  if (child) {
    try {
      if (statSync(child).isDirectory() && hasGloss(child)) return child;
    } catch {
      /* fall through to self */
    }
  }
  const abs = resolve(root);
  if (basename(abs) === id && hasGloss(abs)) return abs;
  return null;
}

export function projectStamp(projectDir: string): string {
  let latest = 0;
  const bump = (abs: string) => {
    try {
      latest = Math.max(latest, statSync(abs).mtimeMs);
    } catch {
      /* skip */
    }
  };
  bump(join(projectDir, "gloss.md"));
  try {
    const gloss = readFileSync(join(projectDir, "gloss.md"), "utf8");
    for (const { ref } of collectRefs(gloss)) {
      const abs = safeResolve(projectDir, ref.file);
      if (abs) bump(abs);
    }
  } catch {
    /* gloss unreadable — stamp still reflects the file mtime above */
  }
  const srcRoot = join(projectDir, "src");
  try {
    if (existsSync(srcRoot) && statSync(srcRoot).isDirectory()) {
      for (const abs of walkTextFiles(srcRoot)) bump(abs);
    }
  } catch {
    /* skip */
  }
  return String(Math.round(latest));
}

export function loadProject(
  id: string,
  root = projectsRoot(),
): ProjectDetail | null {
  const projectDir = resolveProjectDir(id, root);
  if (!projectDir) return null;
  return loadFromDir(id, projectDir);
}

function loadFromDir(id: string, projectDir: string): ProjectDetail | null {
  const glossPath = join(projectDir, "gloss.md");
  if (!hasGloss(projectDir)) return null;

  const gloss = readFileSync(glossPath, "utf8");
  const meta = metaFromGloss(id, gloss);
  const refs = collectRefs(gloss);
  const problems = checkRefs(projectDir, refs);
  const seenWarn = new Set<string>();
  const warnings: string[] = [];
  for (const p of problems) {
    if (seenWarn.has(p.message)) continue;
    seenWarn.add(p.message);
    warnings.push(p.message);
  }

  const files: Record<string, string> = {};

  for (const { ref } of refs) {
    const abs = safeResolve(projectDir, ref.file);
    if (!abs) continue;
    if (!existsSync(abs) || !statSync(abs).isFile()) continue;
    const text = readTextFile(abs);
    if (text === null) continue;
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

  return { id, ...meta, gloss, files, warnings, rev: projectStamp(projectDir) };
}

function metaFromGloss(
  id: string,
  src: string,
): Omit<ProjectSummary, "id"> {
  const { meta } = splitFrontmatter(src);
  return {
    name: meta.name || id,
    tagline: meta.tagline ?? "",
    lang: meta.lang || "typescript",
  };
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

export function walkTextFiles(dir: string): string[] {
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
