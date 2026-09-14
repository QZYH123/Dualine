/*
 * Find where a locked block now sits in a file.
 *
 * Exact match only: compare line-by-line after trimming trailing
 * whitespace. Indentation is significant. No fuzzy matching.
 */
import { fileLines } from "./validate.js";

export type RelocateHit =
  | { start: number; end: number }
  | { ambiguous: number };

function trimTrailing(line: string): string {
  return line.replace(/[ \t]+$/, "");
}

function blockLines(text: string): string[] {
  return fileLines(text).map(trimTrailing);
}

/**
 * Search `fileLines` for `lockedText`. Unique match → 1-based inclusive
 * range. Several matches → `{ ambiguous: n }`. None → `null`.
 */
export function relocate(
  fileLinesIn: readonly string[],
  lockedText: string,
): RelocateHit | null {
  const needle = blockLines(lockedText);
  if (needle.length === 0) return null;
  const hay = fileLinesIn.map(trimTrailing);
  const matches: { start: number; end: number }[] = [];
  for (let i = 0; i <= hay.length - needle.length; i++) {
    let ok = true;
    for (let j = 0; j < needle.length; j++) {
      if (hay[i + j] !== needle[j]) {
        ok = false;
        break;
      }
    }
    if (ok) matches.push({ start: i + 1, end: i + needle.length });
  }
  if (matches.length === 0) return null;
  if (matches.length === 1) return matches[0]!;
  return { ambiguous: matches.length };
}
