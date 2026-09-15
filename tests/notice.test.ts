import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  CATALOG_DEFAULT_HINT,
  showCatalogDefaultHint,
  NOTICE_EMPTY_TIP,
  NOTICE_EMPTY_CATALOG_TIP,
  NOTICE_NO_DIR_TIP,
  NOTICE_UNREACHABLE_TIP,
  NOTICE_WINDOWS_PATH_TIP,
  noDirTip,
  notePath,
  noticeCopy,
  noticeShowsBack,
  projectPath,
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
    assert.equal(warningStripText([a]), "已挪到 L23–L64 · dualine check --fix 可全部挪好");
    assert.equal(warningStripText([a], "en"), "moved to L23–L64 · dualine check --fix moves them all");
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

describe("showCatalogDefaultHint", () => {
  test("only on a live catalog home, never in single-folder or export", () => {
    assert.equal(showCatalogDefaultHint({ source: "api", requestedId: null }), true);
    assert.equal(showCatalogDefaultHint({ source: "api", requestedId: null, single: true }), false);
    assert.equal(showCatalogDefaultHint({ source: "api", requestedId: "shortly" }), false);
    assert.equal(showCatalogDefaultHint({ source: "export", requestedId: null }), false);
    assert.equal(showCatalogDefaultHint({ source: "sample", requestedId: null }), true);
  });
});

describe("NOTICE_NO_DIR_TIP", () => {
  test("asks for an absolute folder path", () => {
    assert.match(NOTICE_NO_DIR_TIP, /GLOSS_PROJECTS_DIR/);
    assert.match(NOTICE_NO_DIR_TIP, /绝对路径/);
  });
});

describe("notePath / projectPath", () => {
  test("single-folder mode does not double the project id", () => {
    const catalog = { root: "/tmp/r11-tsnotes", rootStatus: "ok" as const, projects: [], single: true };
    assert.equal(notePath(catalog, "r11-tsnotes", "does-not-exist"), "/tmp/r11-tsnotes/gloss/does-not-exist.md");
    assert.equal(notePath(catalog, "r11-tsnotes", "gloss"), "/tmp/r11-tsnotes/gloss.md");
    assert.equal(projectPath(catalog, "r11-tsnotes"), "/tmp/r11-tsnotes/gloss.md");
  });

  test("catalog mode still nests id under the projects root", () => {
    const catalog = { root: "/tmp/glosses", rootStatus: "ok" as const, projects: [] };
    assert.equal(notePath(catalog, "shortly", "api"), "/tmp/glosses/shortly/gloss/api.md");
    assert.equal(projectPath(catalog, "shortly"), "/tmp/glosses/shortly/gloss.md");
  });
});

describe("noticeCopy missing note", () => {
  test("frozen export names the relative gloss file, not GLOSS_PROJECTS_DIR", () => {
    const copy = noticeCopy({
      kind: "not-found",
      id: "r11-tsnotes",
      catalog: { projects: [] },
      note: "nope",
      notes: [{ id: "gloss", title: "Main", chapters: [] }],
      frozen: true,
    });
    assert.equal(copy.hint, "gloss/nope.md");
    assert.match(copy.title, /nope/);
  });
});

describe("noticeCopy empty", () => {
  test("catalog empty names the projects folder, not dualine init", () => {
    const copy = noticeCopy({
      kind: "empty",
      catalog: { root: "/tmp/glosses", rootStatus: "ok", projects: [] },
    });
    assert.equal(copy.title, "这个目录下没有项目");
    assert.equal(copy.hint, "/tmp/glosses");
    assert.equal(copy.tip, NOTICE_EMPTY_CATALOG_TIP);
    assert.match(NOTICE_EMPTY_CATALOG_TIP, /子文件夹/);
    assert.doesNotMatch(copy.hint, /<id>/);
    assert.doesNotMatch(copy.hint, /dualine init/);
  });

  test("catalog empty without a root still names GLOSS_PROJECTS_DIR", () => {
    const copy = noticeCopy({ kind: "empty", catalog: { projects: [] } });
    assert.equal(copy.hint, "GLOSS_PROJECTS_DIR");
    assert.equal(copy.tip, NOTICE_EMPTY_CATALOG_TIP);
  });

  test("single-folder empty names gloss.md and dualine init", () => {
    const copy = noticeCopy({
      kind: "empty",
      catalog: { root: "/tmp/r11-pycli", rootStatus: "ok", projects: [], single: true },
    });
    assert.equal(copy.title, "这里还没有 gloss.md");
    assert.equal(copy.hint, "dualine init");
    assert.equal(copy.tip, NOTICE_EMPTY_TIP);
    assert.match(NOTICE_EMPTY_TIP, /write-gloss/);
    assert.match(NOTICE_EMPTY_TIP, /gloss\.md/);
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
