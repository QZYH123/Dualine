import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  loadLastNote,
  loadNoteChapter,
  loadReadingStore,
  markLastNote,
  saveNoteChapter,
} from "../src/lib/reading-position.js";

function memory() {
  const data = new Map<string, string>();
  return {
    getItem(key: string) {
      return data.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      data.set(key, value);
    },
  };
}

describe("reading position", () => {
  test("saves and loads a chapter per note", () => {
    const s = memory();
    assert.equal(loadNoteChapter("app", "gloss", s), null);
    saveNoteChapter("app", "gloss", "c3", s);
    saveNoteChapter("app", "api", "c1", s);
    assert.equal(loadNoteChapter("app", "gloss", s), "c3");
    assert.equal(loadNoteChapter("app", "api", s), "c1");
    assert.equal(loadNoteChapter("other", "gloss", s), null);
  });

  test("last note is the one you left, not the one you just opened", () => {
    const s = memory();
    saveNoteChapter("app", "gloss", "c2", s);
    markLastNote("app", "gloss", s);
    assert.equal(loadLastNote("app", s), "gloss");
    saveNoteChapter("app", "api", "c1", s);
    assert.equal(loadLastNote("app", s), "gloss");
    markLastNote("app", "api", s);
    assert.equal(loadLastNote("app", s), "api");
  });

  test("junk in storage is an empty store", () => {
    const s = memory();
    s.setItem("dualine:pos:v1:app", "{not json");
    assert.deepEqual(loadReadingStore("app", s), { lastNote: null, chapters: {} });
  });
});
