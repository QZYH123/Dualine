/*
 * A gloss.lock is the facing-page's memory: each claim's loc maps to a hash
 * of the code it faces. Line numbers may move; if the text of the span is
 * the same, the facing still holds. If the text changed, the lock says so.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { CodeRef } from "../src/lib/gloss.js";
import { relocate } from "./relocate.js";
import {
  checkRefs,
  fileLines,
  readTextFile,
  refLabel,
  safeResolve,
  type LocatedRef,
  type RefProblem,
} from "./validate.js";

export const LOCK_FILE = "gloss.lock";
export const LOCK_MISSING = `gloss.lock missing — run check:gloss --accept`;

export interface LockSpan {
  loc: string;
  file: string;
  start: number;
  end: number;
  sha256: string;
}

export interface GlossLock {
  version: 1;
  spans: LockSpan[];
}

export function lockPath(projectDir: string): string {
  return join(projectDir, LOCK_FILE);
}

export function spanSlice(src: string, start: number, end: number): string | null {
  const lines = fileLines(src);
  if (start < 1 || end > lines.length || start > end) return null;
  return lines.slice(start - 1, end).join("\n");
}

export function spanHash(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

export function hashRef(projectDir: string, ref: CodeRef): string | null {
  const abs = safeResolve(projectDir, ref.file);
  if (!abs) return null;
  const src = readTextFile(abs);
  if (src === null) return null;
  const slice = spanSlice(src, ref.start, ref.end);
  if (slice === null) return null;
  return spanHash(slice);
}

export function buildLock(projectDir: string, refs: LocatedRef[]): GlossLock {
  const spans: LockSpan[] = [];
  for (const { loc, ref } of refs) {
    const sha256 = hashRef(projectDir, ref);
    if (!sha256) continue;
    spans.push({
      loc,
      file: ref.file,
      start: ref.start,
      end: ref.end,
      sha256,
    });
  }
  spans.sort((a, b) => a.loc.localeCompare(b.loc));
  return { version: 1, spans };
}

export function readLock(projectDir: string): GlossLock | null {
  const p = lockPath(projectDir);
  if (!existsSync(p)) return null;
  try {
    const raw: unknown = JSON.parse(readFileSync(p, "utf8"));
    if (!raw || typeof raw !== "object") return null;
    const rec = raw as { version?: unknown; spans?: unknown };
    if (rec.version !== 1 || !Array.isArray(rec.spans)) return null;
    const spans: LockSpan[] = [];
    for (const item of rec.spans) {
      if (!item || typeof item !== "object") continue;
      const s = item as Partial<LockSpan>;
      if (
        typeof s.loc !== "string" ||
        typeof s.file !== "string" ||
        typeof s.start !== "number" ||
        typeof s.end !== "number" ||
        typeof s.sha256 !== "string"
      ) {
        continue;
      }
      spans.push({ loc: s.loc, file: s.file, start: s.start, end: s.end, sha256: s.sha256 });
    }
    return { version: 1, spans };
  } catch {
    return null;
  }
}

export function writeLock(projectDir: string, lock: GlossLock): void {
  const body = `${JSON.stringify(lock, null, 2)}\n`;
  writeFileSync(lockPath(projectDir), body);
}

function driftProblem(loc: string, ref: CodeRef, suffix: string): RefProblem {
  return {
    loc,
    ref,
    reason: "drift",
    message: `${loc} → ${refLabel(ref)}: ${suffix}`,
  };
}

/**
 * Refs that already failed checkRefs (missing file / bad range) are skipped —
 * those problems speak first. A missing lock is one project-level problem.
 */
export function checkLock(
  projectDir: string,
  refs: LocatedRef[],
  okLocs: Set<string>,
): RefProblem[] {
  const lock = readLock(projectDir);
  if (!lock) {
    const first = refs[0];
    return [
      {
        loc: LOCK_FILE,
        ref: first?.ref ?? { file: LOCK_FILE, start: 1, end: 1 },
        reason: "lock",
        message: LOCK_MISSING,
      },
    ];
  }

  const byLoc = new Map(lock.spans.map((s) => [s.loc, s]));
  const out: RefProblem[] = [];
  for (const { loc, ref } of refs) {
    if (!okLocs.has(loc)) continue;
    const remembered = byLoc.get(loc);
    const sha = hashRef(projectDir, ref);
    if (!sha) continue;
    if (!remembered) {
      out.push(driftProblem(loc, ref, `not in ${LOCK_FILE} — run check:gloss --accept`));
      continue;
    }
    if (remembered.sha256 !== sha) {
      out.push(driftProblem(loc, ref, `code changed since ${LOCK_FILE}`));
    }
  }
  return out;
}

/**
 * Reconstruct the locked block from a v1 hash-only span: a same-length
 * window whose sha256 matches. Several windows with that hash share the
 * same text; relocate() then says unique vs ambiguous.
 */
export function recoverLockedText(
  lines: readonly string[],
  span: LockSpan,
): string | null {
  const width = span.end - span.start + 1;
  if (width < 1) return null;
  for (let i = 0; i <= lines.length - width; i++) {
    const block = lines.slice(i, i + width).join("\n");
    if (spanHash(block) === span.sha256) return block;
  }
  return null;
}

export function relocateLockSpans(
  lock: GlossLock,
  updates: ReadonlyArray<{ loc: string; start: number; end: number }>,
): GlossLock {
  const byLoc = new Map(updates.map((u) => [u.loc, u]));
  return {
    version: 1,
    spans: lock.spans.map((s) => {
      const u = byLoc.get(s.loc);
      return u ? { ...s, start: u.start, end: u.end } : s;
    }),
  };
}

/**
 * Attach `suggest` / `ambiguous` to range and drift problems when the
 * locked block is found in the current file.
 */
export function hintRelocation(
  projectDir: string,
  problems: RefProblem[],
): RefProblem[] {
  const lock = readLock(projectDir);
  if (!lock) return problems;
  const byLoc = new Map(lock.spans.map((s) => [s.loc, s]));
  const cache = new Map<string, string[] | null>();

  const linesOf = (file: string): string[] | null => {
    const abs = safeResolve(projectDir, file);
    if (!abs) return null;
    if (cache.has(abs)) return cache.get(abs) ?? null;
    const src = readTextFile(abs);
    const lines = src === null ? null : fileLines(src);
    cache.set(abs, lines);
    return lines;
  };

  return problems.map((p) => {
    if (p.reason !== "range" && p.reason !== "drift") return p;
    const span = byLoc.get(p.loc);
    if (!span) return p;
    const lines = linesOf(p.ref.file);
    if (!lines) return p;
    const locked = recoverLockedText(lines, span);
    if (locked == null) return p;
    const found = relocate(lines, locked);
    if (found == null) return p;
    if ("ambiguous" in found) return { ...p, ambiguous: found.ambiguous };
    if (found.start === p.ref.start && found.end === p.ref.end) return p;
    return { ...p, suggest: found };
  });
}

/** Range + lock + relocation hints. CLI and API both call this. */
export function checkGloss(projectDir: string, refs: LocatedRef[]): RefProblem[] {
  const found = checkRefs(projectDir, refs);
  const okLocs = new Set(refs.map((r) => r.loc));
  for (const p of found) okLocs.delete(p.loc);
  return hintRelocation(projectDir, [...found, ...checkLock(projectDir, refs, okLocs)]);
}
