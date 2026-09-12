import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { parseGloss } from "../src/lib/gloss.js";
import {
  COPY,
  chapterNum,
  chromeLocale,
  glossLocale,
  homeHref,
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
  });
});
