import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  DEFAULT_NOTE_ID,
  isValidNoteId,
  noteLockLoc,
  summaryFromGloss,
  type NoteSummary,
} from "../src/lib/notes.js";
import { collectRefs, type LocatedRef } from "./validate.js";

export {
  DEFAULT_NOTE_ID,
  isValidNoteId,
  noteLockLoc,
  type NoteChapter,
  type NoteSummary,
} from "../src/lib/notes.js";

export interface NoteFile {
  id: string;
  path: string;
  rel: string;
}

/**
 * gloss.md (id `gloss`) first, then gloss/*.md whose basename is a valid id.
 * `gloss/gloss.md` is ignored so it cannot collide with the default note.
 */
export function listNotes(projectDir: string): NoteFile[] {
  const out: NoteFile[] = [];
  const main = join(projectDir, "gloss.md");
  try {
    if (existsSync(main) && statSync(main).isFile()) {
      out.push({ id: DEFAULT_NOTE_ID, path: main, rel: "gloss.md" });
    }
  } catch {
    /* unreadable */
  }

  const extra = join(projectDir, "gloss");
  let names: string[] = [];
  try {
    if (existsSync(extra) && statSync(extra).isDirectory()) {
      names = readdirSync(extra);
    }
  } catch {
    return out;
  }

  const extras: NoteFile[] = [];
  for (const name of names) {
    if (!name.endsWith(".md")) continue;
    const id = name.slice(0, -3);
    if (!isValidNoteId(id) || id === DEFAULT_NOTE_ID) continue;
    const path = join(extra, name);
    try {
      if (!statSync(path).isFile()) continue;
    } catch {
      continue;
    }
    extras.push({ id, path, rel: `gloss/${name}` });
  }
  extras.sort((a, b) => a.id.localeCompare(b.id));
  out.push(...extras);
  return out;
}

export function prefixNoteRefs(noteId: string, refs: LocatedRef[]): LocatedRef[] {
  if (noteId === DEFAULT_NOTE_ID) return refs;
  return refs.map((r) => ({ ...r, loc: noteLockLoc(noteId, r.loc) }));
}

export function noteSummaries(projectDir: string): NoteSummary[] {
  const out: NoteSummary[] = [];
  for (const n of listNotes(projectDir)) {
    try {
      out.push(summaryFromGloss(n.id, readFileSync(n.path, "utf8")));
    } catch {
      out.push({ id: n.id, title: n.id, chapters: [] });
    }
  }
  return out;
}

export function collectAllNoteRefs(projectDir: string): LocatedRef[] {
  const all: LocatedRef[] = [];
  for (const n of listNotes(projectDir)) {
    try {
      all.push(...prefixNoteRefs(n.id, collectRefs(readFileSync(n.path, "utf8"))));
    } catch {
      /* skip unreadable notes */
    }
  }
  return all;
}

/** gloss.md plus every file sitting in gloss/ (valid notes and ignored names). */
export function noteSourcePaths(projectDir: string): string[] {
  const out: string[] = [join(projectDir, "gloss.md")];
  const extra = join(projectDir, "gloss");
  try {
    if (!existsSync(extra) || !statSync(extra).isDirectory()) return out;
    for (const name of readdirSync(extra)) {
      const path = join(extra, name);
      try {
        if (statSync(path).isFile()) out.push(path);
      } catch {
        /* skip */
      }
    }
  } catch {
    /* skip */
  }
  return out;
}
