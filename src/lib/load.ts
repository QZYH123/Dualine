/*
 * Project loading.
 *
 * Which project to read comes from the URL: `/?project=<id>`. Without it, the
 * first project the API lists is opened (the catalog is sorted by id — that is
 * not always shortly). Use `?project=shortly` for the sample. The bundled
 * sample is used only when there is no API *and* it is what was asked for —
 * never as a quiet stand-in for a missing real project.
 *
 * GET /api/projects is the catalog: it also says whether the projects folder
 * is missing or merely empty. GET /api/projects/:id is the gloss + files.
 *
 * In dev (and `vite preview`), Vite proxies /api and answers 502 when the API
 * is not running, which we treat as "unreachable" rather than "not found".
 */
import { buildProject, type Project } from "./gloss";
import { loadShortlyFixture } from "../fixtures/shortly";
import {
  afterDetail,
  afterList,
  isUsablePayload,
  requestedProjectId as projectIdFromSearch,
  SAMPLE_ID,
  type Catalog,
  type FetchResult,
  type ProjectPayload,
} from "./load-decision";

export { SAMPLE_ID };
export type { Catalog } from "./load-decision";

/** `/?project=<id>` — null means "whatever is there". */
export function requestedProjectId(search: string = window.location.search): string | null {
  return projectIdFromSearch(search);
}

export type LoadResult =
  | {
      kind: "project";
      project: Project;
      source: "api" | "sample" | "export";
      warnings: string[];
      rev?: string;
    }
  | { kind: "not-found"; id: string; catalog: Catalog }
  | { kind: "empty"; catalog: Catalog }
  | { kind: "no-dir"; catalog: Catalog }
  | { kind: "unreachable"; id: string };

function payloadWarnings(body: ProjectPayload): string[] {
  const raw = body.warnings;
  if (!Array.isArray(raw)) return [];
  return raw.filter((w): w is string => typeof w === "string");
}

async function getJson(url: string): Promise<FetchResult> {
  let res: Response;
  try {
    res = await fetch(url, { headers: { accept: "application/json" } });
  } catch {
    return { unreachable: true };
  }
  // The proxy answers 502 for a dead API; a real API never sends these.
  if (res.status === 502 || res.status === 503 || res.status === 504) {
    return { unreachable: true };
  }
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status, body };
}

function readExportPayload(): LoadResult | null {
  const raw = (window as Window & { __GLOSS_EXPORT__?: unknown }).__GLOSS_EXPORT__;
  if (!isUsablePayload(raw)) return null;
  return {
    kind: "project",
    project: buildProject(typeof raw.id === "string" && raw.id ? raw.id : "export", raw.gloss, raw.files),
    source: "export",
    warnings: payloadWarnings(raw),
  };
}

export async function loadProject(requested: string | null): Promise<LoadResult> {
  const frozen = readExportPayload();
  if (frozen) return frozen;

  const list = await getJson("/api/projects");
  const listed = afterList(requested, list);
  if (listed.kind === "sample") {
    return { kind: "project", project: loadShortlyFixture(), source: "sample", warnings: [] };
  }
  if (listed.kind !== "continue") return listed;

  const detail = await getJson(`/api/projects/${encodeURIComponent(listed.id)}`);
  const decided = afterDetail(requested, listed.id, listed.catalog, detail);
  if (decided.kind === "sample") {
    return { kind: "project", project: loadShortlyFixture(), source: "sample", warnings: [] };
  }
  if (decided.kind === "project") {
    const body: ProjectPayload = decided.payload;
    return {
      kind: "project",
      project: buildProject(body.id, body.gloss, body.files),
      source: "api",
      warnings: payloadWarnings(body),
      rev: typeof body.rev === "string" ? body.rev : undefined,
    };
  }
  return decided;
}
