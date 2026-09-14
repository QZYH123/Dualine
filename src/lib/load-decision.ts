/*
 * Client load policy, kept free of the browser and of Vite fixtures so it
 * can be tested with node:test.
 *
 * The sample project is the honest answer only when nothing else was asked
 * for (or when the ask *is* the sample) and the API cannot be reached.
 * A real `?project=` never falls back to shortly in silence.
 */

export const SAMPLE_ID = "shortly";

export type RootStatus = "ok" | "missing" | "not-directory";

export interface ProjectSummary {
  id: string;
  name?: string;
  tagline?: string;
  lang?: string;
}

export interface Catalog {
  root?: string;
  rootStatus?: RootStatus;
  projects: ProjectSummary[];
  /** API single-folder mode: the catalog lists exactly one project. */
  single?: boolean;
}

export interface ProjectPayload {
  id: string;
  name?: string;
  tagline?: string;
  lang?: string;
  gloss: string;
  files: Record<string, string>;
  warnings?: Array<string | ProjectWarning>;
  rev?: string;
}
export type ProjectWarning = { message: string; suggest?: { start: number; end: number }; ambiguous?: number };
export type FetchResult =
  | { unreachable: true }
  | { unreachable?: false; status: number; body: unknown };

export type AfterList =
  | { kind: "sample" }
  | { kind: "unreachable"; id: string }
  | { kind: "no-dir"; catalog: Catalog }
  | { kind: "empty"; catalog: Catalog }
  | { kind: "continue"; id: string; catalog: Catalog };

export type AfterDetail =
  | { kind: "sample" }
  | { kind: "unreachable"; id: string }
  | { kind: "project"; payload: ProjectPayload }
  | { kind: "not-found"; id: string; catalog: Catalog };

export function requestedProjectId(search: string): string | null {
  const id = new URLSearchParams(search).get("project")?.trim() ?? "";
  return id ? id : null;
}

export function parseRootStatus(raw: unknown): RootStatus | undefined {
  if (raw === "ok" || raw === "missing" || raw === "not-directory") return raw;
  return undefined;
}

export function catalogFromListBody(body: unknown): Catalog {
  if (!body || typeof body !== "object") return { projects: [] };
  const rec = body as Record<string, unknown>;
  const raw = rec.projects;
  const projects: ProjectSummary[] = [];
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (item && typeof item === "object" && typeof (item as ProjectSummary).id === "string") {
        projects.push(item as ProjectSummary);
      }
    }
  }
  const catalog: Catalog = {
    projects,
    root: typeof rec.root === "string" ? rec.root : undefined,
    rootStatus: parseRootStatus(rec.rootStatus),
  };
  if (rec.single === true) catalog.single = true;
  return catalog;
}

export function isUsablePayload(body: unknown): body is ProjectPayload {
  if (!body || typeof body !== "object") return false;
  const rec = body as ProjectPayload;
  return typeof rec.gloss === "string" && !!rec.files && typeof rec.files === "object";
}

function hasBody(
  result: FetchResult,
): result is { status: number; body: unknown } {
  return result.unreachable !== true;
}

function downOrSample(
  requested: string | null,
): Extract<AfterList, { kind: "sample" } | { kind: "unreachable" }> {
  if (requested === null || requested === SAMPLE_ID) return { kind: "sample" };
  return { kind: "unreachable", id: requested };
}

export function afterList(requested: string | null, list: FetchResult): AfterList {
  if (!hasBody(list)) return downOrSample(requested);
  if (list.status >= 500) return downOrSample(requested);

  const catalog = catalogFromListBody(list.body);
  if (catalog.rootStatus === "missing" || catalog.rootStatus === "not-directory") {
    return { kind: "no-dir", catalog };
  }

  const id = requested ?? catalog.projects[0]?.id ?? null;
  if (id === null) return { kind: "empty", catalog };
  return { kind: "continue", id, catalog };
}

function detailDown(
  requested: string | null,
  id: string,
): Extract<AfterDetail, { kind: "sample" } | { kind: "unreachable" }> {
  if ((requested === null || requested === SAMPLE_ID) && id === SAMPLE_ID) {
    return { kind: "sample" };
  }
  return { kind: "unreachable", id };
}

export function afterDetail(
  requested: string | null,
  id: string,
  catalog: Catalog,
  detail: FetchResult,
): AfterDetail {
  if (!hasBody(detail)) return detailDown(requested, id);
  if (detail.status >= 500) return detailDown(requested, id);
  if (detail.status === 200 && isUsablePayload(detail.body)) {
    const payload = detail.body;
    return {
      kind: "project",
      payload: { ...payload, id: payload.id || id },
    };
  }
  return { kind: "not-found", id, catalog };
}

export function parseProjectWarnings(raw: unknown[]): ProjectWarning[] {
  const out: ProjectWarning[] = [];
  for (const item of raw) {
    if (typeof item === "string") {
      out.push({ message: item });
      continue;
    }
    if (!item || typeof item !== "object") continue;
    const rec = item as { message?: unknown; suggest?: unknown; ambiguous?: unknown };
    if (typeof rec.message !== "string") continue;
    const w: ProjectWarning = { message: rec.message };
    if (
      rec.suggest &&
      typeof rec.suggest === "object" &&
      typeof (rec.suggest as { start?: unknown }).start === "number" &&
      typeof (rec.suggest as { end?: unknown }).end === "number"
    ) {
      w.suggest = {
        start: (rec.suggest as { start: number }).start,
        end: (rec.suggest as { end: number }).end,
      };
    }
    if (typeof rec.ambiguous === "number") w.ambiguous = rec.ambiguous;
    out.push(w);
  }
  return out;
}
