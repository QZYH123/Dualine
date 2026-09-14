import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { parseGloss } from "../src/lib/gloss.js";
import {
  COPY,
  chapterNum,
  chromeLocale,
  glossLocale,
  chapterHref,
  homeHref,
  jumpValue,
  noteHref,
  parseJumpValue,
  parseLocale,
} from "../src/lib/locale.js";
import { noticeCopy, warningStripText } from "../src/lib/notice.js";

describe("parseLocale", () => {
  test("zh / en and prefixes; junk is null", () => {
    assert.equal(parseLocale("zh"), "zh");
    assert.equal(parseLocale("zh-CN"), "zh");
    assert.equal(parseLocale("en-US"), "en");
    assert.equal(parseLocale(" EN "), "en");
    assert.equal(parseLocale("fr"), null);
    assert.equal(parseLocale(""), null);
  });
});

describe("glossLocale", () => {
  test("CJK title → zh; Latin title → en; locale: overrides", () => {
    const zh = parseGloss("# 短链\n\n导语。\n");
    assert.equal(glossLocale(undefined, zh.doc), "zh");
    const en = parseGloss("# shortly\n\nA lead.\n");
    assert.equal(glossLocale(undefined, en.doc), "en");
    assert.equal(glossLocale("en", zh.doc), "en");
    assert.equal(glossLocale("zh", en.doc), "zh");
  });
});

describe("chromeLocale", () => {
  test("?lang= wins over the gloss", () => {
    const { doc } = parseGloss("# 短链\n\n导语。\n");
    assert.equal(chromeLocale("?lang=en", { doc }), "en");
    assert.equal(chromeLocale("", { doc }), "zh");
    assert.equal(chromeLocale("", undefined, "en-US"), "en");
    assert.equal(chromeLocale("", undefined, "fr-FR"), "zh");
  });
});

describe("chapterNum", () => {
  test("CJK numerals vs arabic", () => {
    assert.equal(chapterNum(1, "zh"), "一");
    assert.equal(chapterNum(8, "zh"), "八");
    assert.equal(chapterNum(1, "en"), "1");
    assert.equal(chapterNum(8, "en"), "8");
  });
});

describe("homeHref", () => {
  test("keeps lang; optional project; frozen is relative", () => {
    assert.equal(homeHref("en"), "/?lang=en");
    assert.equal(homeHref("zh", "shortly"), "/?lang=zh&project=shortly");
    assert.equal(homeHref("en", "shortly", true), "?lang=en");
  });
});

describe("chapterHref / noteHref", () => {
  test("chapter change keeps ?note=", () => {
    assert.equal(
      chapterHref("c3", { pathname: "/", search: "?project=p&note=b" }),
      "/?project=p&note=b#c3",
    );
    assert.equal(chapterHref("c3", { pathname: "/", search: "?project=p" }), "/?project=p#c3");
  });

  test("noteHref omits the default note and can carry a chapter", () => {
    assert.equal(noteHref("zh", "p", "b"), "/?lang=zh&project=p&note=b");
    assert.equal(noteHref("zh", "p", "gloss"), "/?lang=zh&project=p");
    assert.equal(noteHref("en", "p", "b", { chapterId: "c2" }), "/?lang=en&project=p&note=b#c2");
    assert.equal(noteHref("en", null, "b", { frozen: true }), "?lang=en&note=b");
  });

  test("jump values encode a foreign note", () => {
    assert.equal(jumpValue("gloss", "c1", "gloss"), "c1");
    assert.equal(jumpValue("b", "c2", "gloss"), "b:c2");
    assert.deepEqual(parseJumpValue("c1", "gloss"), { noteId: "gloss", chapterId: "c1" });
    assert.deepEqual(parseJumpValue("b:c2", "gloss"), { noteId: "b", chapterId: "c2" });
  });
});

describe("notes copy", () => {
  test("rail label, document title, and missing-note notice", () => {
    assert.equal(COPY.zh.notes, "笔记");
    assert.equal(COPY.en.notes, "Notes");
    assert.equal(COPY.zh.documentNoteTitle("Other", "Two"), "Other · Two · Dualine");
    assert.equal(COPY.en.documentNoteTitle("Other", "Two"), "Other · Two · Dualine");
    assert.equal(COPY.zh.notFoundNote("b"), "找不到笔记 “b”");
    assert.equal(COPY.en.notFoundNote("b"), "No note “b”");
  });
});

describe("warn strip relocation copy", () => {
  test("moved / ambiguous / fix-all use an en dash and the CLI command", () => {
    assert.equal(COPY.zh.warnMoved(23, 64), "已挪到 L23–L64");
    assert.equal(COPY.en.warnMoved(23, 64), "moved to L23–L64");
    assert.equal(COPY.zh.warnAmbiguous(3), "原文出现 3 处，需手改");
    assert.equal(COPY.en.warnAmbiguous(3), "text found 3 times, fix by hand");
    assert.equal(COPY.zh.warnFixAll, "· dualine check --fix 可全部挪好");
    assert.equal(COPY.en.warnFixAll, "· dualine check --fix moves them all");
    assert.equal(COPY.zh.warnFixCmd, "dualine check --fix");
  });
});

describe("noticeCopy en", () => {
  test("English titles and tips", () => {
    const copy = noticeCopy(
      { kind: "unreachable", id: "x" },
      "en",
    );
    assert.equal(copy.title, COPY.en.unreachable);
    assert.equal(copy.hint, "npm run dev:all");
    assert.equal(copy.tip, COPY.en.unreachableTip);
    assert.equal(warningStripText(["a", "b"], "en"), COPY.en.warnMany(2));

    const empty = noticeCopy(
      { kind: "empty", catalog: { root: "/tmp/x", rootStatus: "ok", projects: [] } },
      "en",
    );
    assert.equal(empty.title, COPY.en.empty);
    assert.equal(empty.hint, "dualine init");
    assert.equal(empty.tip, COPY.en.emptyTip);
    assert.match(COPY.en.emptyTip, /write-gloss/);

    const emptySingle = noticeCopy(
      { kind: "empty", catalog: { root: "/tmp/x", rootStatus: "ok", projects: [], single: true } },
      "en",
    );
    assert.equal(emptySingle.title, COPY.en.emptySingle);
  });
});
