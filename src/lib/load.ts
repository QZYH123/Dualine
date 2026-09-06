/*
 * Project loading.
 *
 * Which project to read comes from the URL: `/?project=<id>`. Without it, the
 * first project the API lists is opened; with no API at all, the bundled
 * sample (shortly) is read so the screen is always viewable.
 *
 * The API is thin — see server/ — and is pointed at a folder of projects with
 * GLOSS_PROJECTS_DIR. In dev, Vite proxies /api to it and answers 502 when it
 * is not running, which we treat as "unreachable" rather than "not found".
 *
 * API contract — GET /api/projects/:id →
 *   { id: string, name: string, tagline: string, lang: string,
 *     gloss: string,                        // gloss.md source
 *     files: { [path: string]: string },    // contents keyed by project-relative path
 *     warnings: string[] }                  // anchors that point at nothing
 */
import { buildProject, type Project } from "./gloss";
import { loadShortlyFixture } from "../fixtures/shortly";

export const SAMPLE_ID = "shortly";

interface ProjectPayload {
  id: string;
  name?: string;
  tagline?: string;
  lang?: string;
  gloss: string;
  files: Record<string, string>;
  warnings?: string[];
}

interface ListPayload {
  projects: { id: string }[];
}

export type LoadResult =
  | { kind: "project"; project: Project; source: "api" | "sample" }
  | { kind: "not-found"; id: string }
  | { kind: "empty" }
  | { kind: "unreachable"; id: string };

/** `/?project=<id>` — null means "whatever is there". */
export function requestedProjectId(search: string = window.location.search): string | null {
  const id = new URLSearchParams(search).get("project")?.trim() ?? "";
  return id ? id : null;
}

class Unreachable extends Error {}

async function getJson<T>(url: string): Promise<{ status: number; body: T | null }> {
  let res: Response;
  try {
    res = await fetch(url, { headers: { accept: "application/json" } });
  } catch {
    throw new Unreachable();
  }
  // The dev proxy answers 502 for a dead API; a real API never sends these.
  if (res.status === 502 || res.status === 503 || res.status === 504) throw new Unreachable();
  let body: T | null = null;
  try {
    body = (await res.json()) as T;
  } catch {
    body = null;
  }
  return { status: res.status, body };
}

export async function loadProject(requested: string | null): Promise<LoadResult> {
  const sample = (): LoadResult => ({
    kind: "project",
    project: loadShortlyFixture(),
    source: "sample",
  });

  try {
    let id = requested;
    if (id === null) {
      const list = await getJson<ListPayload>("/api/projects");
      const first = list.body?.projects?.[0]?.id;
      if (!first) return { kind: "empty" };
      id = first;
    }

    const { status, body } = await getJson<ProjectPayload>(
      `/api/projects/${encodeURIComponent(id)}`,
    );
    if (status === 200 && body && typeof body.gloss === "string" && body.files) {
      return {
        kind: "project",
        project: buildProject(body.id ?? id, body.gloss, body.files),
        source: "api",
      };
    }
    return { kind: "not-found", id };
  } catch (err) {
    if (!(err instanceof Unreachable)) throw err;
    // No API. The sample is the honest answer only when it is what was asked for.
    if (requested === null || requested === SAMPLE_ID) return sample();
    return { kind: "unreachable", id: requested };
  }
}
