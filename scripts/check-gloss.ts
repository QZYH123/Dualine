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
import { checkFollowupPrompt, type CheckPromptItem } from "../src/lib/agent-prompt.js";
import { sameRef } from "../src/lib/gloss.js";
import { planGlossRefRewrites, relocatedLine } from "../server/fix.js";
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

export interface CheckJson {
  ok: boolean;
  error?: string;
  glosses: number;
  refs: number;
  problems: number;
  items: CheckPromptItem[];
  relocated: { note: string; line: string }[];
  prompt: string;
}

function emptyJson(error: string, problems = 0): CheckJson {
  return {
    ok: false,
    error,
    glosses: 0,
    refs: 0,
    problems,
    items: [],
    relocated: [],
    prompt: error,
  };
}

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
  onLine: (line: string) => void,
  label?: string,
): { src: string; moved: number } {
  const moves = problems.filter(
    (p): p is RefProblem & { suggest: { start: number; end: number } } =>
      p.suggest != null,
  );
  if (moves.length === 0) return { src, moved: 0 };
  const planned = planGlossRefRewrites(
    src,
    moves.map((p) => ({ from: p.ref, to: p.suggest })),
  );
  const applied = moves.filter((p) => planned.applied.some((a) => sameRef(a.from, p.ref)));
  for (const p of applied) {
    const line = relocatedLine(p.ref, p.suggest);
    onLine(label ? `${label}: ${line}` : line);
  }
  if (dryRun) {
    const n = applied.length;
    onLine(`${n} ${n === 1 ? "anchor" : "anchors"} would be relocated`);
    return { src, moved: n };
  }
  if (planned.text !== src) writeFileSync(glossPath, planned.text);
  const lock = readLock(projectDir);
  if (lock && applied.length > 0) {
    writeLock(
      projectDir,
      relocateLockSpans(
        lock,
        applied.map((p) => ({ loc: p.loc, ref: p.ref, start: p.suggest.start, end: p.suggest.end })),
      ),
    );
  }
  const n = applied.length;
  onLine(`${n} ${n === 1 ? "anchor" : "anchors"} relocated`);
  return { src: planned.text, moved: n };
}

function emitJson(report: CheckJson): void {
  console.log(JSON.stringify(report, null, 2));
}

export function runCheck(argv: string[] = process.argv.slice(2)): number {
  const accept = argv.includes("--accept");
  const fix = argv.includes("--fix");
  const dryRun = argv.includes("--dry-run");
  const json = argv.includes("--json");
  const { root, status } = inspectRoot(resolveRoot(argv));
  if (status === "missing") {
    const msg = `check:gloss: projects dir not found: ${root}`;
    if (json) emitJson(emptyJson(msg));
    else console.error(msg);
    return 2;
  }
  if (status === "not-directory") {
    const msg = `check:gloss: not a directory: ${root}`;
    if (json) emitJson(emptyJson(msg));
    else console.error(msg);
    return 2;
  }

  const entries = projectEntries(root);
  if (entries.length === 0) {
    const msg = `0 glosses checked under ${root} — expected ${root}/<id>/gloss.md or ${root}/gloss.md`;
    if (json) emitJson(emptyJson(msg, 1));
    else console.log(msg);
    return 1;
  }

  const fixturePaths = shortlyFixturePaths();
  const useShortlyGuard = resolve(root) === DEFAULT_EXAMPLES;
  let problems = 0;
  let warnings = 0;
  let refsChecked = 0;
  let glossN = 0;
  const items: CheckPromptItem[] = [];
  const relocated: { note: string; line: string }[] = [];
  const say = (line: string) => {
    if (!json) console.log(line);
  };

  for (const { id, dir: projectDir } of entries) {
    if (!isValidProjectId(id)) {
      const rel = displayPath(join(projectDir, "gloss.md"), root);
      const message = `id "${id}" is not servable (use lowercase letters, digits, - or _)`;
      items.push({
        note: rel,
        loc: id,
        message,
        reason: "id",
        file: "",
        start: 0,
        end: 0,
      });
      say(`${rel}: ${message}`);
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
        const applied = applyFix(
          projectDir,
          note.path,
          src,
          preview,
          dryRun,
          (line) => {
            relocated.push({ note: rel, line });
            say(line);
          },
          rel,
        );
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
      say(`${rel}: gloss.lock 已生成 · 以后 check 会拥有对照的代码正文作基线`);
    }

    for (const { rel, found } of foundByNote) {
      const remaining =
        doAccept || doEstablish
          ? found.filter((p) => p.reason !== "drift" && p.reason !== "lock" && p.reason !== "unlocked")
          : found;
      for (const problem of remaining) {
        items.push({
          note: rel,
          loc: problem.loc,
          message: problem.message,
          reason: problem.reason,
          file: problem.ref.file,
          start: problem.ref.start,
          end: problem.ref.end,
          suggest: problem.suggest,
          ambiguous: problem.ambiguous,
        });
        say(`${rel}: ${formatProblem(problem)}`);
        problems += 1;
      }
    }

    if (useShortlyGuard && id === "shortly") {
      for (const { rel, located } of locatedByNote) {
        for (const { loc, ref } of located) {
          if (fixturePaths.has(ref.file)) continue;
          say(`${rel}: ${loc} → ${refLabel(ref)} (warning: not in shortly fixture)`);
          warnings += 1;
        }
      }
    }
  }
  const glossWord = glossN === 1 ? "gloss" : "glosses";
  const problemWord = problems === 1 ? "problem" : "problems";
  const warnPart =
    warnings > 0 ? `, ${warnings} warning${warnings === 1 ? "" : "s"}` : "";
  if (json) {
    emitJson({
      ok: problems === 0,
      glosses: glossN,
      refs: refsChecked,
      problems,
      items,
      relocated,
      prompt: checkFollowupPrompt(items),
    });
  } else {
    console.log(
      `${glossN} ${glossWord} checked, ${refsChecked} refs, ${problems} ${problemWord}${warnPart}`,
    );
  }
  return problems > 0 ? 1 : 0;
}

const entry = process.argv[1];
if (entry && resolve(entry) === fileURLToPath(import.meta.url)) {
  process.exit(runCheck());
}
