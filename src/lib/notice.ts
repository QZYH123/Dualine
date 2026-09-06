export type NoticeKind = "not-found" | "unreachable" | "empty" | "no-dir";

/** Back is useful only when `/` is a different screen (not empty / no-dir). */
export function noticeShowsBack(kind: NoticeKind): boolean {
  return kind === "not-found" || kind === "unreachable";
}

/** Missing / not-a-directory projects folder: prefer an absolute path. */
export const NOTICE_NO_DIR_TIP = "把 GLOSS_PROJECTS_DIR 设成文件夹的绝对路径";

/** One-line strip under the masthead. Null when there is nothing to say. */
export function warningStripText(warnings: string[]): string | null {
  if (warnings.length === 0) return null;
  if (warnings.length === 1) return warnings[0];
  return `${warnings.length} 处锚点无法落到代码`;
}

export function warningStripExpandable(warnings: string[]): boolean {
  return warnings.length > 1;
}
