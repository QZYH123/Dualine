/*
 * How far the code element may slide when the reader peeks past the paired
 * span, and where the thumb sits for that position.
 *
 * `top` is the code element's CSS top. Positive pushes the file downward.
 */

export interface CodeScrollBounds {
  minTop: number;
  maxTop: number;
}

export function codeScrollBounds(contentH: number, viewportH: number): CodeScrollBounds {
  const maxTop = Math.max(16, viewportH * 0.45);
  const minTop = Math.min(maxTop, viewportH - contentH + 16);
  return { minTop, maxTop };
}

export function thumbGeometry(
  trackH: number,
  contentH: number,
  viewportH: number,
  top: number,
): { thumbH: number; thumbTop: number; range: number } & CodeScrollBounds {
  const { minTop, maxTop } = codeScrollBounds(contentH, viewportH);
  const range = maxTop - minTop;
  const span = range <= 0 ? 0 : Math.min(1, Math.max(0, (maxTop - top) / range));
  const thumbH =
    range <= 0 || contentH <= 0
      ? trackH
      : Math.max(28, Math.min(trackH, (viewportH / contentH) * trackH));
  const travel = Math.max(0, trackH - thumbH);
  return { minTop, maxTop, range, thumbH, thumbTop: span * travel };
}

/** Invert `thumbGeometry` so a thumb position becomes a code `top`. */
export function translateForThumb(
  contentH: number,
  viewportH: number,
  thumbTop: number,
  thumbH: number,
  trackH: number,
): number {
  const { minTop, maxTop } = codeScrollBounds(contentH, viewportH);
  const travel = Math.max(1, trackH - thumbH);
  const span = Math.min(1, Math.max(0, thumbTop / travel));
  return maxTop - span * (maxTop - minTop);
}
