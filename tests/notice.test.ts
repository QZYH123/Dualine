import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  CATALOG_DEFAULT_HINT,
  NOTICE_EMPTY_TIP,
  NOTICE_NO_DIR_TIP,
  NOTICE_UNREACHABLE_TIP,
  NOTICE_WINDOWS_PATH_TIP,
  noDirTip,
  noticeCopy,
  noticeShowsBack,
  warningStripExpandable,
  warningStripText,
} from "../src/lib/notice.js";
import { looksLikeWindowsPath } from "../src/lib/paths.js";

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

  test("when every problem has a unique suggest, the summary names --fix", () => {
    const a = { message: "one", suggest: { start: 23, end: 64 } };
    const b = { message: "two", suggest: { start: 8, end: 9 } };
    assert.equal(warningStripText([a]), "one · dualine check --fix 可全部挪好");
    assert.equal(warningStripText([a, b]), "2 处锚点无法落到代码 · dualine check --fix 可全部挪好");
    assert.equal(
      warningStripText([a, b], "en"),
      "2 anchors miss the code · dualine check --fix moves them all",
    );
    assert.equal(warningStripText([a, { message: "gone" }]), "2 处锚点无法落到代码");
  });
});

describe("CATALOG_DEFAULT_HINT", () => {
  test("names the first listed id and the ?project= query", () => {
    assert.match(CATALOG_DEFAULT_HINT, /目录第一项/);
    assert.match(CATALOG_DEFAULT_HINT, /\?project=/);
  });
});

describe("NOTICE_NO_DIR_TIP", () => {
  test("asks for an absolute folder path", () => {
    assert.match(NOTICE_NO_DIR_TIP, /GLOSS_PROJECTS_DIR/);
    assert.match(NOTICE_NO_DIR_TIP, /绝对路径/);
  });
});

describe("noticeCopy empty", () => {
  test("points at dualine init, not a fake <id> path", () => {
    const copy = noticeCopy({
      kind: "empty",
      catalog: { root: "/tmp/glosses", rootStatus: "ok", projects: [] },
    });
    assert.equal(copy.title, "这个目录下没有项目");
    assert.equal(copy.hint, "dualine init");
    assert.equal(copy.tip, NOTICE_EMPTY_TIP);
    assert.match(NOTICE_EMPTY_TIP, /write-gloss/);
    assert.match(NOTICE_EMPTY_TIP, /gloss\.md/);
    assert.doesNotMatch(copy.hint, /<id>/);
  });

  test("still points at init when the catalog has no root", () => {
    const copy = noticeCopy({ kind: "empty", catalog: { projects: [] } });
    assert.equal(copy.hint, "dualine init");
    assert.equal(copy.tip, NOTICE_EMPTY_TIP);
  });
});

describe("noticeCopy unreachable", () => {
  test("names the recovery command and asks to refresh once the API is up", () => {
    const copy = noticeCopy({ kind: "unreachable", id: "audit-many" });
    assert.equal(copy.title, "API 未运行，读不到这个项目");
    assert.equal(copy.hint, "npm run dev:all");
    assert.equal(copy.tip, NOTICE_UNREACHABLE_TIP);
    assert.match(NOTICE_UNREACHABLE_TIP, /API/);
    assert.match(NOTICE_UNREACHABLE_TIP, /刷新这一页/);
    assert.equal(noticeShowsBack("unreachable"), true);
  });
});

describe("noDirTip", () => {
  test("names a pasted Windows path instead of asking for a POSIX folder", () => {
    assert.equal(looksLikeWindowsPath("C:/Users/foo/glosses"), true);
    assert.equal(looksLikeWindowsPath("C:\\Users\\foo\\glosses"), true);
    assert.equal(looksLikeWindowsPath("\\\\server\\share"), true);
    assert.equal(looksLikeWindowsPath("/tmp/gloss-projects"), false);
    assert.equal(noDirTip("/tmp/gone"), NOTICE_NO_DIR_TIP);
    assert.equal(noDirTip("C:/Users/foo/glosses"), NOTICE_WINDOWS_PATH_TIP);
    assert.match(NOTICE_WINDOWS_PATH_TIP, /Windows/);
  });
});
