import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
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
}

export function listProjects(root = projectsRoot()): ProjectSummary[] {
  if (inspectRoot(root).status !== "ok") return [];
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
    const glossPath = join(dir, "gloss.md");
    try {
      if (!statSync(dir).isDirectory() || !existsSync(glossPath)) continue;
      const gloss = readFileSync(glossPath, "utf8");
      out.push({ id: name, ...metaFromGloss(name, gloss) });
    } catch {
      continue;
    }
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

  return { id, ...meta, gloss, files, warnings };
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
