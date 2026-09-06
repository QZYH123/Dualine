/*
 * Project loading. Tries the API first; falls back to the bundled fixture so
 * the reader is always viewable, server or not.
 *
 * Dev: set GLOSS_API (e.g. http://localhost:8787) so Vite proxies /api there.
 * Without it there is no proxy — fetch fails quietly and the fixture is used.
 *
 * API contract — GET /api/projects/:id →
 *   { id: string, name: string, tagline: string, lang: string,
 *     gloss: string,                      // gloss.md source
 *     files: { [path: string]: string } } // file contents keyed by repo-relative path
 */
import { buildProject, type Project } from "./gloss";
import { loadShortlyFixture } from "../fixtures/shortly";

interface ProjectPayload {
  id: string;
  name?: string;
  tagline?: string;
  lang?: string;
  gloss: string;
  files: Record<string, string>;
}

export async function loadProject(id: string): Promise<Project> {
  try {
    const res = await fetch(`/api/projects/${encodeURIComponent(id)}`, {
      headers: { accept: "application/json" },
    });
    if (!res.ok) throw new Error(`api ${res.status}`);
    const payload = (await res.json()) as ProjectPayload;
    if (typeof payload.gloss !== "string" || !payload.files) throw new Error("bad payload");
    return buildProject(payload.id ?? id, payload.gloss, payload.files);
  } catch {
    return loadShortlyFixture();
  }
}
