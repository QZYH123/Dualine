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
  isUsablePayload, parseNoteSummaries, parseProjectWarnings,
  requestedProjectId as projectIdFromSearch,
  SAMPLE_ID,
  type Catalog,
  type FetchResult,
  type ProjectPayload, type ProjectWarning,
} from "./load-decision";
import {
  DEFAULT_NOTE_ID,
  notesFromDoc,
  requestedNoteId as noteIdFromSearch,
  summaryFromGloss,
  type NoteSummary,
} from "./notes";

export { SAMPLE_ID };
export type { Catalog } from "./load-decision";
export { requestedNoteId } from "./notes";

/** `/?project=<id>` — null means "whatever is there". */
export function requestedProjectId(search: string = window.location.search): string | null {
  return projectIdFromSearch(search);
}

/** `/?note=<id>` — null means the default note (`gloss`). */
export function requestedNote(search: string = window.location.search): string | null {
  return noteIdFromSearch(search);
}

export type LoadResult =
  | {
      kind: "project";
      project: Project;
      source: "api" | "sample" | "export";
      warnings: ProjectWarning[];
      rev?: string;
      note: string;
      notes: NoteSummary[];
    }
  | { kind: "not-found"; id: string; catalog: Catalog; note?: string; notes?: NoteSummary[]; frozen?: boolean }
  | { kind: "empty"; catalog: Catalog }
  | { kind: "no-dir"; catalog: Catalog }
  | { kind: "unreachable"; id: string };

function payloadWarnings(body: ProjectPayload): ProjectWarning[] {
  const raw = body.warnings;
  if (!Array.isArray(raw)) return [];
  return parseProjectWarnings(raw);
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

function applyProjectMeta(project: Project, body: ProjectPayload): Project {
  return {
    ...project,
    name: typeof body.name === "string" && body.name ? body.name : project.name,
    tagline: typeof body.tagline === "string" ? body.tagline : project.tagline,
    lang: typeof body.lang === "string" && body.lang ? body.lang : project.lang,
  };
}

function notesForProject(project: Project, payload?: ProjectPayload): NoteSummary[] {
  if (payload?.notes && payload.notes.length > 0) return payload.notes;
  return notesFromDoc(
    project.doc.title || project.name,
    project.doc.chapters.map((c) => ({ id: c.id, title: c.title, index: c.index })),
    project.tagline || undefined,
  );
}

function exportNoteList(raw: ProjectPayload): NoteSummary[] {
  if (raw.byNote && typeof raw.byNote === "object") {
    const ids = [
      DEFAULT_NOTE_ID,
      ...Object.keys(raw.byNote)
        .filter((k) => k !== DEFAULT_NOTE_ID)
        .sort(),
    ];
    return ids.map((id) => {
      const src = id === DEFAULT_NOTE_ID ? (raw.byNote?.[id]?.gloss ?? raw.gloss) : raw.byNote?.[id]?.gloss;
      return src ? summaryFromGloss(id, src) : { id, title: id, chapters: [] };
    });
  }
  return [summaryFromGloss(DEFAULT_NOTE_ID, raw.gloss)];
}

function readExportPayload(note: string | null): LoadResult | null {
  const raw = (window as Window & { __GLOSS_EXPORT__?: unknown }).__GLOSS_EXPORT__;
  if (!isUsablePayload(raw)) return null;
  const want = note || DEFAULT_NOTE_ID;
  const notes = exportNoteList(raw);
  const id = typeof raw.id === "string" && raw.id ? raw.id : "export";
  if (!notes.some((n) => n.id === want)) {
    return { kind: "not-found", id, catalog: { projects: [] }, note: want, notes, frozen: true };
  }
  if (want !== DEFAULT_NOTE_ID) {
    const chunk = raw.byNote?.[want];
    if (!chunk || typeof chunk.gloss !== "string" || !chunk.files || typeof chunk.files !== "object") {
      return { kind: "not-found", id, catalog: { projects: [] }, note: want, notes, frozen: true };
    }
    return {
      kind: "project",
      project: applyProjectMeta(buildProject(id, chunk.gloss, chunk.files), raw),
      source: "export",
      warnings: payloadWarnings({ ...raw, gloss: chunk.gloss, files: chunk.files, warnings: chunk.warnings }),
      note: want,
      notes,
    };
  }
  return {
    kind: "project",
    project: applyProjectMeta(buildProject(id, raw.gloss, raw.files), raw),
    source: "export",
    warnings: payloadWarnings(raw),
    note: DEFAULT_NOTE_ID,
    notes,
  };
}

function sampleResult(): Extract<LoadResult, { kind: "project" }> {
  const project = loadShortlyFixture();
  return {
    kind: "project",
    project,
    source: "sample",
    warnings: [],
    note: DEFAULT_NOTE_ID,
    notes: notesForProject(project),
  };
}

export async function loadProject(
  requested: string | null,
  note: string | null = null,
): Promise<LoadResult> {
  const frozen = readExportPayload(note);
  if (frozen) return frozen;

  const list = await getJson("/api/projects");
  const listed = afterList(requested, list);
  if (listed.kind === "sample") return sampleResult();
  if (listed.kind !== "continue") return listed;

  const qs = note ? `?note=${encodeURIComponent(note)}` : "";
  const detail = await getJson(`/api/projects/${encodeURIComponent(listed.id)}${qs}`);
  const decided = afterDetail(requested, listed.id, listed.catalog, detail);
  if (decided.kind === "sample") return sampleResult();
  if (decided.kind === "project") {
    const body: ProjectPayload = decided.payload;
    const project = applyProjectMeta(buildProject(body.id, body.gloss, body.files), body);
    return {
      kind: "project",
      project,
      source: "api",
      warnings: payloadWarnings(body),
      rev: typeof body.rev === "string" ? body.rev : undefined,
      note: typeof body.note === "string" && body.note ? body.note : note || DEFAULT_NOTE_ID,
      notes: notesForProject(project, {
        ...body,
        notes: parseNoteSummaries(body.notes),
      }),
    };
  }
  return decided;
}
