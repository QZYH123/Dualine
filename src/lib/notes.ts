/*
 * A project may have several notes: gloss.md (id `gloss`) plus gloss/<id>.md.
 * Shared types and loc keys — no filesystem.
 */
import { parseGloss } from "./gloss.js";

export const DEFAULT_NOTE_ID = "gloss";
export const NOTE_ID_RE = /^[a-z0-9][a-z0-9-_]*$/;

export interface NoteChapter {
  id: string;
  title: string;
  index: number;
}

export interface NoteSummary {
  id: string;
  title: string;
  tagline?: string;
  chapters: NoteChapter[];
}

export function isValidNoteId(id: string): boolean {
  return NOTE_ID_RE.test(id);
}

/** Prefix a lock loc or target key. The default note stays unprefixed. */
export function noteLockLoc(noteId: string, loc: string): string {
  return !noteId || noteId === DEFAULT_NOTE_ID ? loc : `${noteId}:${loc}`;
}

export function requestedNoteId(search: string): string | null {
  const id = new URLSearchParams(search).get("note")?.trim() ?? "";
  return id ? id : null;
}

export function summaryFromGloss(id: string, src: string): NoteSummary {
  const { meta, doc } = parseGloss(src);
  const out: NoteSummary = {
    id,
    title: doc.title || id,
    chapters: doc.chapters.map((c) => ({ id: c.id, title: c.title, index: c.index })),
  };
  if (meta.tagline) out.tagline = meta.tagline;
  return out;
}

export function notesFromDoc(
  title: string,
  chapters: NoteChapter[],
  tagline?: string,
): NoteSummary[] {
  const out: NoteSummary = { id: DEFAULT_NOTE_ID, title, chapters };
  if (tagline) out.tagline = tagline;
  return [out];
}
