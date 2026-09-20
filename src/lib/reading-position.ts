/**
 * Last-read place for a project, kept in localStorage.
 * Per-note chapter is restored when the URL has no #hash.
 * lastNote is the note you left, so the rail can mark 上次 on the other note.
 */

const PREFIX = "dualine:pos:v1:";

export interface ReadingStore {
  lastNote: string | null;
  chapters: Record<string, string>;
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function memory(): StorageLike | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  } catch {
    return null;
  }
}

function key(projectId: string): string {
  return PREFIX + projectId;
}

export function loadReadingStore(
  projectId: string,
  storage: StorageLike | null = memory(),
): ReadingStore {
  if (!storage || !projectId) return { lastNote: null, chapters: {} };
  try {
    const raw = storage.getItem(key(projectId));
    if (!raw) return { lastNote: null, chapters: {} };
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return { lastNote: null, chapters: {} };
    const rec = parsed as { lastNote?: unknown; chapters?: unknown };
    const lastNote = typeof rec.lastNote === "string" ? rec.lastNote : null;
    const chapters: Record<string, string> = {};
    if (rec.chapters && typeof rec.chapters === "object") {
      for (const [k, v] of Object.entries(rec.chapters as Record<string, unknown>)) {
        if (typeof v === "string" && v) chapters[k] = v;
      }
    }
    return { lastNote, chapters };
  } catch {
    return { lastNote: null, chapters: {} };
  }
}

function saveReadingStore(
  projectId: string,
  store: ReadingStore,
  storage: StorageLike | null = memory(),
): void {
  if (!storage || !projectId) return;
  try {
    storage.setItem(key(projectId), JSON.stringify(store));
  } catch {
    /* quota / private mode */
  }
}

export function loadNoteChapter(
  projectId: string,
  noteId: string,
  storage?: StorageLike | null,
): string | null {
  const ch = loadReadingStore(projectId, storage ?? memory()).chapters[noteId];
  return ch || null;
}

export function saveNoteChapter(
  projectId: string,
  noteId: string,
  chapterId: string,
  storage?: StorageLike | null,
): void {
  if (!chapterId) return;
  const mem = storage ?? memory();
  const store = loadReadingStore(projectId, mem);
  store.chapters[noteId] = chapterId;
  saveReadingStore(projectId, store, mem);
}

export function loadLastNote(
  projectId: string,
  storage?: StorageLike | null,
): string | null {
  return loadReadingStore(projectId, storage ?? memory()).lastNote;
}

/** Call when leaving a note so the next note's rail can mark 上次. */
export function markLastNote(
  projectId: string,
  noteId: string,
  storage?: StorageLike | null,
): void {
  if (!noteId) return;
  const mem = storage ?? memory();
  const store = loadReadingStore(projectId, mem);
  store.lastNote = noteId;
  saveReadingStore(projectId, store, mem);
}
