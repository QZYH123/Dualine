export type NoticeKind = "not-found" | "unreachable" | "empty" | "no-dir";

/** Back is useful only when `/` is a different screen (not empty / no-dir). */
export function noticeShowsBack(kind: NoticeKind): boolean {
  return kind === "not-found" || kind === "unreachable";
}

/** One-line strip under the masthead. Null when there is nothing to say. */
export function warningStripText(warnings: string[]): string | null {
  if (warnings.length === 0) return null;
  if (warnings.length === 1) return warnings[0];
  return `${warnings.length} 处锚点无法落到代码`;
}
