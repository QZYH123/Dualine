import type { Catalog, NoteSummary, ProjectWarning } from "./load-decision.js";
import { COPY, type Locale } from "./locale.js";
import { DEFAULT_NOTE_ID } from "./notes.js";
import { looksLikeWindowsPath } from "./paths.js";

export type { ProjectWarning };

export type NoticeKind = "not-found" | "unreachable" | "empty" | "no-dir";

/** Screens App renders when there is no project to face. */
export type NoticeScreen =
  | { kind: "not-found"; id: string; catalog: Catalog; note?: string; notes?: NoteSummary[]; frozen?: boolean }
  | { kind: "empty"; catalog: Catalog }
  | { kind: "no-dir"; catalog: Catalog }
  | { kind: "unreachable"; id: string };

/** Back is useful only when `/` is a different screen (not empty / no-dir). */
export function noticeShowsBack(kind: NoticeKind): boolean {
  return kind === "not-found" || kind === "unreachable";
}

/** Missing / not-a-directory projects folder: prefer an absolute path. */
export const NOTICE_NO_DIR_TIP = COPY.zh.noDirTip;

/** Empty catalog: run `dualine init` in the project folder. */
export const NOTICE_EMPTY_TIP = COPY.zh.emptyTip;

/** API down: name the recovery, then refresh this page; 返回 stays home. */
export const NOTICE_UNREACHABLE_TIP = COPY.zh.unreachableTip;

/** Pasted drive/UNC path — we do not convert it to a POSIX folder. */
export const NOTICE_WINDOWS_PATH_TIP = COPY.zh.windowsTip;

export function noDirTip(root?: string, locale: Locale = "zh"): string {
  const copy = COPY[locale];
  return root && looksLikeWindowsPath(root) ? copy.windowsTip : copy.noDirTip;
}

/**
 * Quiet extra on the warn strip when `/` opened the catalog's first id.
 * Not a redirect, not a shortly preference — just how the list works.
 * Single-folder CLI (`dualine .`) has no catalog; do not show it there.
 */
export const CATALOG_DEFAULT_HINT = COPY.zh.catalogDefault;

export function showCatalogDefaultHint(opts: {
  source: "api" | "sample" | "export";
  requestedId: string | null;
  single?: boolean;
}): boolean {
  return opts.source !== "export" && opts.requestedId === null && opts.single !== true;
}

export type StripWarning = string | ProjectWarning;

function asWarning(w: StripWarning): ProjectWarning {
  return typeof w === "string" ? { message: w } : w;
}

/** One-line strip under the masthead. Null when there is nothing to say. */
export function warningStripText(
  warnings: readonly StripWarning[],
  locale: Locale = "zh",
): string | null {
  if (warnings.length === 0) return null;
  const items = warnings.map(asWarning);
  const hint = items.every((w) => w.suggest) ? ` ${COPY[locale].warnFixAll}` : "";
  if (items.length === 1) {
    const w = items[0]!;
    if (w.suggest) {
      return `${COPY[locale].warnMoved(w.suggest.start, w.suggest.end)}${hint}`;
    }
    return `${w.message}${hint}`;
  }
  return `${COPY[locale].warnMany(items.length)}${hint}`;
}

export function warningStripExpandable(warnings: readonly StripWarning[]): boolean {
  return warnings.length > 1;
}

/** Project folder as shown on a notice. Single-folder mode is the root itself. */
export function projectDirHint(catalog: Catalog, projectId: string): string {
  if (catalog.single && catalog.root) return catalog.root;
  return catalog.root ? `${catalog.root}/${projectId}` : `GLOSS_PROJECTS_DIR/${projectId}`;
}

export function projectPath(catalog: Catalog, id: string): string {
  return `${projectDirHint(catalog, id)}/gloss.md`;
}

export function notePath(catalog: Catalog, projectId: string, noteId: string): string {
  const base = projectDirHint(catalog, projectId);
  return !noteId || noteId === DEFAULT_NOTE_ID ? `${base}/gloss.md` : `${base}/gloss/${noteId}.md`;
}

/** Title / hint / tip for a load-failure notice — App only renders. */
export function noticeCopy(
  result: NoticeScreen,
  locale: Locale = "zh",
): {
  title: string;
  hint: string;
  tip: string | null;
} {
  const copy = COPY[locale];
  switch (result.kind) {
    case "not-found":
      if (result.note) {
        return {
          title: copy.notFoundNote(result.note),
          hint: notePath(result.catalog, result.id, result.note),
          tip: (result.notes?.length ?? 0) > 0 ? copy.alsoHere : copy.emptyTip,
        };
      }
      return {
        title: copy.notFound(result.id),
        hint: projectPath(result.catalog, result.id),
        tip: result.catalog.projects.length > 0 ? copy.alsoHere : copy.emptyTip,
      };
    case "unreachable":
      return {
        title: copy.unreachable,
        hint: "npm run dev:all",
        tip: copy.unreachableTip,
      };
    case "empty":
      return {
        title: result.catalog.single ? copy.emptySingle : copy.empty,
        hint: "dualine init",
        tip: copy.emptyTip,
      };
    case "no-dir":
      return {
        title: result.catalog.rootStatus === "not-directory" ? copy.notDirectory : copy.missingDir,
        hint: result.catalog.root ?? "GLOSS_PROJECTS_DIR",
        tip: noDirTip(result.catalog.root, locale),
      };
  }
}
