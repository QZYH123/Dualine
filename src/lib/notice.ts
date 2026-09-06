import type { Catalog } from "./load-decision.js";
import { looksLikeWindowsPath } from "./paths.js";

export type NoticeKind = "not-found" | "unreachable" | "empty" | "no-dir";

/** Screens App renders when there is no project to face. */
export type NoticeScreen =
  | { kind: "not-found"; id: string; catalog: Catalog }
  | { kind: "empty"; catalog: Catalog }
  | { kind: "no-dir"; catalog: Catalog }
  | { kind: "unreachable"; id: string };

/** Back is useful only when `/` is a different screen (not empty / no-dir). */
export function noticeShowsBack(kind: NoticeKind): boolean {
  return kind === "not-found" || kind === "unreachable";
}

/** Missing / not-a-directory projects folder: prefer an absolute path. */
export const NOTICE_NO_DIR_TIP = "把 GLOSS_PROJECTS_DIR 设成文件夹的绝对路径";

/** Empty catalog: child folders, not this folder itself. */
export const NOTICE_EMPTY_TIP =
  "每个项目一个子文件夹（小写字母、数字、- 或 _），内含 gloss.md";

/** Pasted drive/UNC path — we do not convert it to a POSIX folder. */
export const NOTICE_WINDOWS_PATH_TIP = "这是 Windows 路径；请改成当前系统上的绝对路径";

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

export function projectPath(catalog: Catalog, id: string): string {
  return catalog.root ? `${catalog.root}/${id}/gloss.md` : `GLOSS_PROJECTS_DIR/${id}/gloss.md`;
}

/** Title / hint / tip for a load-failure notice — App only renders. */
export function noticeCopy(result: NoticeScreen): {
  title: string;
  hint: string;
  tip: string | null;
} {
  switch (result.kind) {
    case "not-found":
      return {
        title: `找不到项目 “${result.id}”`,
        hint: projectPath(result.catalog, result.id),
        tip: result.catalog.projects.length > 0 ? "这个目录里还有" : NOTICE_EMPTY_TIP,
      };
    case "unreachable":
      return {
        title: "API 未运行，读不到这个项目",
        hint: "npm run dev:all",
        tip: null,
      };
    case "empty":
      return {
        title: "这个目录下没有项目",
        hint: result.catalog.root ?? "GLOSS_PROJECTS_DIR",
        tip: NOTICE_EMPTY_TIP,
      };
    case "no-dir":
      return {
        title:
          result.catalog.rootStatus === "not-directory"
            ? "项目路径不是一个目录"
            : "找不到项目目录",
        hint: result.catalog.root ?? "GLOSS_PROJECTS_DIR",
        tip: noDirTip(result.catalog.root),
      };
  }
}
