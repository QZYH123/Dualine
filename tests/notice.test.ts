import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  NOTICE_NO_DIR_TIP,
  noticeShowsBack,
  warningStripExpandable,
  warningStripText,
} from "../src/lib/notice.js";

describe("noticeShowsBack", () => {
  test("true for not-found and unreachable; false for empty and no-dir", () => {
    assert.equal(noticeShowsBack("not-found"), true);
    assert.equal(noticeShowsBack("unreachable"), true);
    assert.equal(noticeShowsBack("empty"), false);
    assert.equal(noticeShowsBack("no-dir"), false);
  });
});

describe("warningStripText", () => {
  test("null for none, identity for one, count string for two or more", () => {
    assert.equal(warningStripText([]), null);
    assert.equal(warningStripText(["missing: src/nope.ts"]), "missing: src/nope.ts");
    assert.equal(warningStripText(["a", "b"]), "2 处锚点无法落到代码");
    assert.equal(warningStripText(["a", "b", "c"]), "3 处锚点无法落到代码");
  });

  test("expandable only when there are two or more warnings", () => {
    assert.equal(warningStripExpandable([]), false);
    assert.equal(warningStripExpandable(["a"]), false);
    assert.equal(warningStripExpandable(["a", "b"]), true);
  });
});

describe("NOTICE_NO_DIR_TIP", () => {
  test("asks for an absolute folder path", () => {
    assert.match(NOTICE_NO_DIR_TIP, /GLOSS_PROJECTS_DIR/);
    assert.match(NOTICE_NO_DIR_TIP, /绝对路径/);
  });
});
