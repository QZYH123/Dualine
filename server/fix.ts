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
  const hash = raw.indexOf("#");
  if (hash === -1) return raw;
  const path = raw.slice(0, hash);
  const spec = raw.slice(hash);
  const m = /^#L(\d+)(?:(-L?)(\d+))?$/.exec(spec);
  if (!m) return raw;
  if (m[2] == null) {
    if (to.start === to.end) return `${path}#L${to.start}`;
    return `${path}#L${to.start}-L${to.end}`;
  }
  return `${path}#L${to.start}${m[2]}${to.end}`;
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
  const map = new Map<string, { start: number; end: number } | "conflict">();
  for (const m of moves) {
    const k = refKey(m.from);
    const prev = map.get(k);
    if (prev === "conflict") continue;
    if (prev && (prev.start !== m.to.start || prev.end !== m.to.end)) {
      map.set(k, "conflict");
      continue;
    }
    map.set(k, m.to);
  }

  const rewrite = (raw: string): string => {
    const parsed = parseRef(raw);
    if (!parsed) return raw;
    const to = map.get(refKey(parsed));
    if (!to || to === "conflict") return raw;
    return rewriteRefTarget(raw, to);
  };

  return src.replace(
    /(@\[)([^#\s\]]+#L\d+(?:-L?\d+)?)(\])|(\]\()([^#\s)]+#L\d+(?:-L?\d+)?)(\))/g,
    (_all, aOpen: string, aRef: string, aClose: string, lOpen: string, lRef: string, lClose: string) => {
      if (aRef != null) return `${aOpen}${rewrite(aRef)}${aClose}`;
      return `${lOpen}${rewrite(lRef)}${lClose}`;
    },
  );
}
