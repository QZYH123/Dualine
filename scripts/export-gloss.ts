/**
 * Freeze one project into a static facing-page.
 *
 *   npx tsx scripts/export-gloss.ts [project-dir]
 *
 * Writes export/<id>/ — open index.html, no API.
 */
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";
import { loadProject } from "../server/projects.js";
import { packageRoot } from "../server/root.js";
import { resolveProjectsDir, slugifyProjectId } from "../server/validate.js";

const REPO_ROOT = packageRoot();

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
  const id = slugifyProjectId(basename(dir));
  const detail = loadProject(id, dir, { single: true });
  if (!detail) {
    throw new Error(`no gloss.md in ${dir}`);
  }
  const payloadPath = join(mkdtempSync(join(tmpdir(), "gloss-export-")), "payload.json");
  writeFileSync(payloadPath, JSON.stringify(frozenPayload(detail)));
  const dest = outDir ? resolveProjectsDir(outDir) : join(process.cwd(), "export", id);
  process.env.GLOSS_EXPORT_PAYLOAD = payloadPath;
  process.env.GLOSS_EXPORT_OUT = dest;
  await build({ configFile: join(REPO_ROOT, "vite.config.ts") });
  return dest;
}

export async function runExport(argv: string[] = process.argv.slice(2)): Promise<number> {
  const positional: string[] = [];
  let out: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--out") {
      const next = argv[i + 1];
      if (!next || next.startsWith("-")) {
        console.error("export:gloss: --out needs a directory");
        return 1;
      }
      out = next;
      i += 1;
      continue;
    }
    if (a.startsWith("--out=")) {
      out = a.slice("--out=".length);
      continue;
    }
    if (!a.startsWith("-")) positional.push(a);
  }
  const arg = positional[0] ?? ".";
  try {
    const dest = await exportProject(arg, out);
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
