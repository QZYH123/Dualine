/**
 * Freeze one project into a static facing-page.
 *
 *   npx tsx scripts/export-gloss.ts [project-dir]
 *
 * Writes export/<id>/ — open index.html, no API.
 */
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";
import { loadProject } from "../server/projects.js";
import { folderProjectId, resolveProjectsDir } from "../server/validate.js";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export function frozenPayload(detail: NonNullable<ReturnType<typeof loadProject>>) {
  return {
    id: detail.id,
    name: detail.name,
    tagline: detail.tagline,
    lang: detail.lang,
    gloss: detail.gloss,
    files: detail.files,
    warnings: detail.warnings,
  };
}

export async function exportProject(projectDir: string, outDir?: string): Promise<string> {
  const dir = resolveProjectsDir(projectDir);
  const id = folderProjectId(dir);
  if (!id) {
    throw new Error(`folder name "${basename(dir)}" is not a servable project id`);
  }
  const detail = loadProject(id, dir);
  if (!detail) {
    throw new Error(`no gloss.md in ${dir}`);
  }
  const payloadPath = join(mkdtempSync(join(tmpdir(), "gloss-export-")), "payload.json");
  writeFileSync(payloadPath, JSON.stringify(frozenPayload(detail)));
  const dest = outDir ?? join(REPO_ROOT, "export", id);
  process.env.GLOSS_EXPORT_PAYLOAD = payloadPath;
  process.env.GLOSS_EXPORT_OUT = dest;
  await build({ configFile: join(REPO_ROOT, "vite.config.ts") });
  return dest;
}

export async function runExport(argv: string[] = process.argv.slice(2)): Promise<number> {
  const arg = argv.find((a) => !a.startsWith("-")) ?? ".";
  try {
    const dest = await exportProject(arg);
    console.log(`exported ${dest}`);
    return 0;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`export:gloss: ${message}`);
    return 1;
  }
}

const entry = process.argv[1];
if (entry && resolve(entry) === fileURLToPath(import.meta.url)) {
  runExport().then((code) => process.exit(code));
}
