export type NoticeKind = "not-found" | "unreachable" | "empty" | "no-dir";

/** Back is useful only when `/` is a different screen (not empty / no-dir). */
export function noticeShowsBack(kind: NoticeKind): boolean {
  return kind === "not-found" || kind === "unreachable";
}

/** Missing / not-a-directory projects folder: prefer an absolute path. */
export const NOTICE_NO_DIR_TIP = "把 GLOSS_PROJECTS_DIR 设成文件夹的绝对路径";

/** Pasted drive/UNC path — we do not convert it to a POSIX folder. */
export const NOTICE_WINDOWS_PATH_TIP = "这是 Windows 路径；请改成当前系统上的绝对路径";

/** Drive path (`C:\…` / `C:/…`) or UNC (`\\server\share`). */
export function looksLikeWindowsPath(p: string): boolean {
  return /^[A-Za-z]:[\\/]/.test(p) || p.startsWith("\\\\");
}

export function noDirTip(root?: string): string {
  return root && looksLikeWindowsPath(root) ? NOTICE_WINDOWS_PATH_TIP : NOTICE_NO_DIR_TIP;
}

/**
 * Quiet extra on the warn strip when `/` opened the catalog's first id.
 * Not a redirect, not a shortly preference — just how the list works.
 */
export const CATALOG_DEFAULT_HINT = "目录第一项 · 用 ?project=<id> 指定";

/** One-line strip under the masthead. Null when there is nothing to say. */
export function warningStripText(warnings: string[]): string | null {
  if (warnings.length === 0) return null;
  if (warnings.length === 1) return warnings[0];
  return `${warnings.length} 处锚点无法落到代码`;
}

export function warningStripExpandable(warnings: string[]): boolean {
  return warnings.length > 1;
}
