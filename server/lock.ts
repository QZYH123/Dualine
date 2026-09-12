/*
 * A gloss.lock is the facing-page's memory: each claim's loc maps to a hash
 * of the code it faces. Line numbers may move; if the text of the span is
 * the same, the facing still holds. If the text changed, the lock says so.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { CodeRef } from "../src/lib/gloss.js";
import {
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
