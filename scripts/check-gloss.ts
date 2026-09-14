/**
 * Verify every gloss anchor and explicit passage ref points at a real file
 * and a line range inside that file. The first check whose refs all land
 * writes gloss.lock; later checks compare the faced text to that baseline
 * (--accept rewrites the lock).
 *
 *   npx tsx scripts/check-gloss.ts [projects-dir] [--accept] [--fix] [--dry-run]
 *
 * --fix rewrites unique relocations in the note they belong to, then updates
 * those lock entries. One gloss.lock per project; extra notes prefix their
 * lock keys. --fix --accept fixes first, then accepts whatever is still a valid
 * range. --fix --dry-run prints the moves and writes nothing.
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, join, relative, resolve, sep } from "node:path";
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
import { listNotes, prefixNoteRefs } from "../server/notes.js";
import {
  collectRefs,
  folderProjectId,
  inspectRoot,
  isValidProjectId,
  projectsRoot,
  refLabel,
  resolveProjectsDir,
  type LocatedRef,
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

function hasGlossFile(dir: string): boolean {
  const glossPath = join(dir, "gloss.md");
  try {
    return existsSync(glossPath) && statSync(glossPath).isFile();
  } catch {
    return false;
  }
}

function projectEntries(root: string): { id: string; dir: string }[] {
  const out: { id: string; dir: string }[] = [];
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
    if (hasGlossFile(dir)) out.push({ id: name, dir });
  }
  if (out.length > 0) return out;
  if (hasGlossFile(root)) {
    out.push({ id: folderProjectId(root) ?? basename(resolve(root)), dir: root });
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
  label?: string,
): { src: string; moved: number } {
  const moves = problems.filter(
    (p): p is RefProblem & { suggest: { start: number; end: number } } =>
      p.suggest != null,
  );
  if (moves.length === 0) return { src, moved: 0 };
  for (const p of moves) {
    const line = relocatedLine(p.ref, p.suggest);
    console.log(label ? `${label}: ${line}` : line);
  }
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
        moves.map((p) => ({ loc: p.loc, ref: p.ref, start: p.suggest.start, end: p.suggest.end })),
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

  const entries = projectEntries(root);
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
  let glossN = 0;

  for (const { id, dir: projectDir } of entries) {
    if (!isValidProjectId(id)) {
      const rel = displayPath(join(projectDir, "gloss.md"), root);
      console.log(
        `${rel}: id "${id}" is not servable (use lowercase letters, digits, - or _)`,
      );
      problems += 1;
    }

    const notes = listNotes(projectDir);
    const locatedByNote: { rel: string; located: LocatedRef[] }[] = [];

    for (const note of notes) {
      const rel = displayPath(note.path, root);
      let src = readFileSync(note.path, "utf8");
      let located = prefixNoteRefs(note.id, collectRefs(src));

      if (fix) {
        const preview = checkGloss(projectDir, located);
        const applied = applyFix(projectDir, note.path, src, preview, dryRun, rel);
        src = applied.src;
        if (!dryRun && applied.moved > 0) {
          located = prefixNoteRefs(note.id, collectRefs(src));
        }
      }

      locatedByNote.push({ rel, located });
      refsChecked += located.length;
      glossN += 1;
    }

    const allLocated = locatedByNote.flatMap((x) => x.located);
    const foundByNote = locatedByNote.map((x) => ({
      rel: x.rel,
      found: checkGloss(projectDir, x.located),
    }));
    const rangeProblems = foundByNote.reduce(
      (n, x) =>
        n +
        x.found.filter(
          (p) => p.reason !== "drift" && p.reason !== "lock" && p.reason !== "unlocked",
        ).length,
      0,
    );
    const noLock = readLock(projectDir) == null;
    const doAccept = accept && !dryRun && rangeProblems === 0;
    const doEstablish = noLock && !dryRun && rangeProblems === 0;
    if (doAccept || doEstablish) {
      writeLock(projectDir, buildLock(projectDir, allLocated));
    }
    if (doEstablish) {
      const rel = displayPath(join(projectDir, "gloss.md"), root);
      console.log(`${rel}: gloss.lock 已生成 · 以后 check 会拥有对照的代码正文作基线`);
    }

    for (const { rel, found } of foundByNote) {
      const remaining =
        doAccept || doEstablish
          ? found.filter((p) => p.reason !== "drift" && p.reason !== "lock" && p.reason !== "unlocked")
          : found;
      for (const problem of remaining) {
        console.log(`${rel}: ${formatProblem(problem)}`);
        problems += 1;
      }
    }

    if (useShortlyGuard && id === "shortly") {
      for (const { rel, located } of locatedByNote) {
        for (const { loc, ref } of located) {
          if (fixturePaths.has(ref.file)) continue;
          console.log(
            `${rel}: ${loc} → ${refLabel(ref)} (warning: not in shortly fixture)`,
          );
          warnings += 1;
        }
      }
    }
  }
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
