/*
 * Rewrite only the line numbers of gloss.md anchors. Everything else —
 * labels, punctuation, CRLF vs LF — stays byte-for-byte.
 */
import { parseRef, type CodeRef } from "../src/lib/gloss.js";
import { refLabel } from "./validate.js";

export function relocatedLine(
  from: CodeRef,
  to: { start: number; end: number },
): string {
  const dest = to.start === to.end ? `L${to.start}` : `L${to.start}-L${to.end}`;
  return `${refLabel(from)} → ${dest}`;
}

export function rewriteRefTarget(
  raw: string,
  to: { start: number; end: number },
): string {
  const start = raw.search(/\S/);
  if (start === -1) return raw;
  let end = raw.length;
  while (end > start && /\s/.test(raw.charAt(end - 1))) end -= 1;
  const trimmed = raw.slice(start, end);
  const hash = trimmed.indexOf("#");
  if (hash === -1) return raw;
  const path = trimmed.slice(0, hash);
  const spec = trimmed.slice(hash);
  const m = /^#L(\d+)(?:(-L?)(\d+))?$/.exec(spec);
  if (!m) return raw;
  const next =
    m[2] == null
      ? to.start === to.end
        ? `${path}#L${to.start}`
        : `${path}#L${to.start}-L${to.end}`
      : `${path}#L${to.start}${m[2]}${to.end}`;
  return `${raw.slice(0, start)}${next}${raw.slice(end)}`;
}

function refKey(ref: CodeRef): string {
  return `${ref.file}\0${ref.start}\0${ref.end}`;
}

/**
 * Replace every inline `](path#L…)` and passage `@[path#L…]` whose
 * parsed target matches a unique move. Conflicting suggestions for the
 * same target are left untouched.
 */
export function rewriteGlossRefs(
  src: string,
  moves: ReadonlyArray<{ from: CodeRef; to: { start: number; end: number } }>,
): string {
  return planGlossRefRewrites(src, moves).text;
}

/**
 * Rewrite matching anchors and report which unique moves actually
 * changed a destination. Conflicting suggestions stay untouched.
 */
export function planGlossRefRewrites(
  src: string,
  moves: ReadonlyArray<{ from: CodeRef; to: { start: number; end: number } }>,
): {
  text: string;
  applied: Array<{ from: CodeRef; to: { start: number; end: number } }>;
} {
  const map = new Map<string, { start: number; end: number } | "conflict">();
  const fromByKey = new Map<string, CodeRef>();
  for (const m of moves) {
    const k = refKey(m.from);
    const prev = map.get(k);
    if (prev === "conflict") continue;
    if (prev && (prev.start !== m.to.start || prev.end !== m.to.end)) {
      map.set(k, "conflict");
      continue;
    }
    map.set(k, m.to);
    fromByKey.set(k, m.from);
  }

  const appliedKeys = new Set<string>();
  const rewrite = (raw: string): string => {
    const parsed = parseRef(raw);
    if (!parsed) return raw;
    const k = refKey(parsed);
    const to = map.get(k);
    if (!to || to === "conflict") return raw;
    const next = rewriteRefTarget(raw, to);
    if (next !== raw) appliedKeys.add(k);
    return next;
  };

  const text = src.replace(
    /(@\[)(\s*[^#\s\]]+#L\d+(?:-L?\d+)?\s*)(\])|(\]\()(\s*[^#\s)]+#L\d+(?:-L?\d+)?\s*)(\))/g,
    (_all, aOpen: string, aRef: string, aClose: string, lOpen: string, lRef: string, lClose: string) => {
      if (aRef != null) return `${aOpen}${rewrite(aRef)}${aClose}`;
      return `${lOpen}${rewrite(lRef)}${lClose}`;
    },
  );

  const applied: Array<{ from: CodeRef; to: { start: number; end: number } }> = [];
  for (const k of appliedKeys) {
    const from = fromByKey.get(k);
    const to = map.get(k);
    if (!from || !to || to === "conflict") continue;
    applied.push({ from, to });
  }
  return { text, applied };
}
