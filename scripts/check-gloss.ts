/**
 * Verify every gloss anchor and explicit passage ref points at a real file
 * and a line range inside that file.
 *
 *   npx tsx scripts/check-gloss.ts [projects-dir]
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import {
  checkRefs,
  collectRefs,
  inspectRoot,
  isValidProjectId,
  projectsRoot,
  refLabel,
  resolveProjectsDir,
} from "../server/validate.js";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_EXAMPLES = resolve(REPO_ROOT, "examples");

function shortlyFixturePaths(): Set<string> {
  const src = readFileSync(join(REPO_ROOT, "src/fixtures/shortly.ts"), "utf8");
  const keys = new Set<string>();
  for (const m of src.matchAll(/from\s+"[^"]+\/(src\/[^"?]+)\?raw"/g)) {
    keys.add(m[1]);
  }
  for (const m of src.matchAll(/"(src\/[^"]+)":\s/g)) {
    keys.add(m[1]);
  }
  return keys;
}

function displayPath(abs: string, root: string): string {
  const fromCwd = relative(process.cwd(), abs);
  if (fromCwd && !fromCwd.startsWith("..") && !fromCwd.includes(`..${sep}`)) {
    return fromCwd.split(sep).join("/");
  }
  return relative(root, abs).split(sep).join("/");
}

function resolveRoot(argv: string[]): string {
  const arg = argv.find((a) => !a.startsWith("-"));
  return arg ? resolveProjectsDir(arg) : projectsRoot();
}

function glossEntries(root: string): { id: string; glossPath: string }[] {
  const out: { id: string; glossPath: string }[] = [];
  let names: string[];
  try {
    names = readdirSync(root).sort();
  } catch {
    return out;
  }
  for (const name of names) {
    const dir = join(root, name);
    let st;
    try {
      st = statSync(dir);
    } catch {
      continue;
    }
    if (!st.isDirectory()) continue;
    const glossPath = join(dir, "gloss.md");
    if (existsSync(glossPath) && statSync(glossPath).isFile()) {
      out.push({ id: name, glossPath });
    }
  }
  if (out.length > 0) return out;
  const self = join(root, "gloss.md");
  if (existsSync(self) && statSync(self).isFile()) {
    out.push({ id: basename(resolve(root)), glossPath: self });
  }
  return out;
}

export function runCheck(argv: string[] = process.argv.slice(2)): number {
  const { root, status } = inspectRoot(resolveRoot(argv));
  if (status === "missing") {
    console.error(`check:gloss: projects dir not found: ${root}`);
    return 2;
  }
  if (status === "not-directory") {
    console.error(`check:gloss: not a directory: ${root}`);
    return 2;
  }

  const entries = glossEntries(root);
  if (entries.length === 0) {
    console.log(
      `0 glosses checked under ${root} — expected ${root}/<id>/gloss.md or ${root}/gloss.md`,
    );
    return 1;
  }

  const fixturePaths = shortlyFixturePaths();
  const useShortlyGuard = resolve(root) === DEFAULT_EXAMPLES;
  let problems = 0;
  let warnings = 0;
  let refsChecked = 0;

  for (const { id, glossPath } of entries) {
    const rel = displayPath(glossPath, root);

    if (!isValidProjectId(id)) {
      console.log(
        `${rel}: id "${id}" is not servable (use lowercase letters, digits, - or _)`,
      );
      problems += 1;
    }

    const src = readFileSync(glossPath, "utf8");
    const located = collectRefs(src);
    refsChecked += located.length;
    const found = checkRefs(dirname(glossPath), located);

    for (const problem of found) {
      console.log(`${rel}: ${problem.message}`);
      problems += 1;
    }

    if (useShortlyGuard && id === "shortly") {
      for (const { loc, ref } of located) {
        if (fixturePaths.has(ref.file)) continue;
        console.log(
          `${rel}: ${loc} → ${refLabel(ref)} (warning: not in shortly fixture)`,
        );
        warnings += 1;
      }
    }
  }

  const glossN = entries.length;
  const glossWord = glossN === 1 ? "gloss" : "glosses";
  const problemWord = problems === 1 ? "problem" : "problems";
  const warnPart =
    warnings > 0 ? `, ${warnings} warning${warnings === 1 ? "" : "s"}` : "";
  console.log(
    `${glossN} ${glossWord} checked, ${refsChecked} refs, ${problems} ${problemWord}${warnPart}`,
  );
  return problems > 0 ? 1 : 0;
}

const entry = process.argv[1];
if (entry && resolve(entry) === fileURLToPath(import.meta.url)) {
  process.exit(runCheck());
}
