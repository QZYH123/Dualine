/**
 * Verify every gloss anchor and explicit passage ref points at a real file
 * and a line range inside that file, and that the faced text still matches
 * gloss.lock (unless --accept rewrites the lock).
 *
 *   npx tsx scripts/check-gloss.ts [projects-dir] [--accept] [--fix] [--dry-run]
 *
 * --fix rewrites unique relocations in gloss.md, then updates those lock
 * entries. --fix --accept fixes first, then accepts whatever is still a
 * valid range. --fix --dry-run prints the moves and writes nothing.
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { packageRoot } from "../server/root.js";
import { relocatedLine, rewriteGlossRefs } from "../server/fix.js";
import {
  buildLock,
  checkGloss,
  readLock,
  relocateLockSpans,
  writeLock,
} from "../server/lock.js";
import {
  collectRefs,
  folderProjectId,
  inspectRoot,
  isValidProjectId,
  projectsRoot,
  refLabel,
  resolveProjectsDir,
  type RefProblem,
} from "../server/validate.js";

const REPO_ROOT = packageRoot();
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
    out.push({ id: folderProjectId(root) ?? basename(resolve(root)), glossPath: self });
  }
  return out;
}

function formatProblem(p: RefProblem): string {
  if (p.suggest) {
    const dest =
      p.suggest.start === p.suggest.end
        ? `L${p.suggest.start}`
        : `L${p.suggest.start}-L${p.suggest.end}`;
    return `${p.message} (moved to ${dest})`;
  }
  if (p.ambiguous != null) return `${p.message} (text found ${p.ambiguous} times)`;
  return p.message;
}

function applyFix(
  projectDir: string,
  glossPath: string,
  src: string,
  problems: RefProblem[],
  dryRun: boolean,
): { src: string; moved: number } {
  const moves = problems.filter(
    (p): p is RefProblem & { suggest: { start: number; end: number } } =>
      p.suggest != null,
  );
  if (moves.length === 0) return { src, moved: 0 };
  for (const p of moves) console.log(relocatedLine(p.ref, p.suggest));
  if (dryRun) {
    const n = moves.length;
    console.log(`${n} ${n === 1 ? "anchor" : "anchors"} would be relocated`);
    return { src, moved: n };
  }
  const next = rewriteGlossRefs(
    src,
    moves.map((p) => ({ from: p.ref, to: p.suggest })),
  );
  if (next !== src) writeFileSync(glossPath, next);
  const lock = readLock(projectDir);
  if (lock) {
    writeLock(
      projectDir,
      relocateLockSpans(
        lock,
        moves.map((p) => ({ loc: p.loc, start: p.suggest.start, end: p.suggest.end })),
      ),
    );
  }
  const n = moves.length;
  console.log(`${n} ${n === 1 ? "anchor" : "anchors"} relocated`);
  return { src: next, moved: n };
}

export function runCheck(argv: string[] = process.argv.slice(2)): number {
  const accept = argv.includes("--accept");
  const fix = argv.includes("--fix");
  const dryRun = argv.includes("--dry-run");
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

    let src = readFileSync(glossPath, "utf8");
    let located = collectRefs(src);
    const projectDir = dirname(glossPath);

    if (fix) {
      const preview = checkGloss(projectDir, located);
      const applied = applyFix(projectDir, glossPath, src, preview, dryRun);
      src = applied.src;
      if (!dryRun && applied.moved > 0) located = collectRefs(src);
    }

    refsChecked += located.length;
    const found = checkGloss(projectDir, located);
    const rangeProblems = found.filter((p) => p.reason !== "drift" && p.reason !== "lock").length;
    const doAccept = accept && !dryRun && rangeProblems === 0;
    if (doAccept) {
      writeLock(projectDir, buildLock(projectDir, located));
    }

    const remaining = doAccept
      ? found.filter((p) => p.reason !== "drift" && p.reason !== "lock")
      : found;

    for (const problem of remaining) {
      console.log(`${rel}: ${formatProblem(problem)}`);
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
