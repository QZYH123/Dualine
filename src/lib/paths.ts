/**
 * Pure path-shape hints shared by the API (resolve/inspect) and notice copy.
 * Keep this free of UI strings so the server never imports notice modules.
 */

/** Drive path (`C:\…` / `C:/…`) or UNC (`\\server\share`). */
export function looksLikeWindowsPath(p: string): boolean {
  return /^[A-Za-z]:[\\/]/.test(p) || p.startsWith("\\\\");
}
