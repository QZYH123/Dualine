import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, test } from "node:test";
import { planGlossRefRewrites, rewriteGlossRefs, rewriteRefTarget } from "../server/fix.js";
import { buildLock, checkGloss, writeLock } from "../server/lock.js";
import { relocate } from "../server/relocate.js";
import { collectRefs, fileLines } from "../server/validate.js";

const tmp = mkdtempSync(join(tmpdir(), "gloss-relocate-"));

after(() => {
  rmSync(tmp, { recursive: true, force: true });
});

function projectWith(src: string, gloss?: string): string {
  const parent = mkdtempSync(join(tmp, "p-"));
  const dir = join(parent, "demo");
  mkdirSync(join(dir, "src"), { recursive: true });
  writeFileSync(join(dir, "src/a.ts"), src);
  writeFileSync(
    join(dir, "gloss.md"),
    gloss ?? "# T\n\nLead.\n\n## One\n\nSee [a](src/a.ts#L1-L2).\n",
  );
  return dir;
}

describe("relocate", () => {
  test("unique match, including a one-line block", () => {
    assert.deepEqual(relocate(["keep", "alpha", "beta", "tail"], "alpha\nbeta"), {
      start: 2,
      end: 3,
    });
    assert.deepEqual(relocate(["x", "only", "z"], "only"), { start: 2, end: 2 });
  });

  test("ambiguous when the block appears more than once", () => {
    assert.deepEqual(relocate(["aa", "bb", "aa", "bb"], "aa\nbb"), { ambiguous: 2 });
  });

  test("null when the block is gone", () => {
    assert.equal(relocate(["aa", "cc"], "aa\nbb"), null);
    assert.equal(relocate([], "aa"), null);
    assert.equal(relocate(["aa"], ""), null);
  });

  test("CRLF locked text matches LF file lines", () => {
    const lines = fileLines("one\r\ntwo\r\nthree\r\n");
    assert.deepEqual(relocate(lines, "two\r\nthree"), { start: 2, end: 3 });
  });

  test("trailing whitespace is ignored; indentation is not", () => {
    assert.deepEqual(relocate(["  foo  ", "bar"], "  foo\nbar"), { start: 1, end: 2 });
    assert.equal(relocate(["foo", "bar"], "  foo\nbar"), null);
  });

  test("shifted by insertions above", () => {
    const locked = "export const a = 1;\nexport const b = 2;";
    const lines = fileLines("// pad\n// pad\nexport const a = 1;\nexport const b = 2;\n");
    assert.deepEqual(relocate(lines, locked), { start: 3, end: 4 });
  });

  test("shifted by deletions above", () => {
    const locked = "export const a = 1;\nexport const b = 2;";
    const lines = fileLines("export const a = 1;\nexport const b = 2;\n");
    assert.deepEqual(relocate(lines, locked), { start: 1, end: 2 });
  });
});

describe("rewriteGlossRefs", () => {
  test("rewrites inline and @[ forms; only the numbers change", () => {
    const src = "See [a](src/a.ts#L1-L2) and @[src/b.ts#L4]\nand [c](src/a.ts#L1-L2).\n";
    const out = rewriteGlossRefs(src, [
      { from: { file: "src/a.ts", start: 1, end: 2 }, to: { start: 5, end: 6 } },
      { from: { file: "src/b.ts", start: 4, end: 4 }, to: { start: 9, end: 9 } },
    ]);
    assert.equal(out, "See [a](src/a.ts#L5-L6) and @[src/b.ts#L9]\nand [c](src/a.ts#L5-L6).\n");
  });

  test("preserves CRLF and #L18-59 punctuation", () => {
    const src = "x [a](src/a.ts#L18-59)\r\n";
    const out = rewriteGlossRefs(src, [
      { from: { file: "src/a.ts", start: 18, end: 59 }, to: { start: 23, end: 64 } },
    ]);
    assert.equal(out, "x [a](src/a.ts#L23-64)\r\n");
    assert.equal(rewriteRefTarget("src/a.ts#L18-L59", { start: 23, end: 64 }), "src/a.ts#L23-L64");
  });

  test("rewrites destinations with surrounding spaces and keeps the padding", () => {
    const src = "See [a]( src/a.ts#L1-L2 ) and @[ src/b.ts#L4 ].\n";
    const planned = planGlossRefRewrites(src, [
      { from: { file: "src/a.ts", start: 1, end: 2 }, to: { start: 5, end: 6 } },
      { from: { file: "src/b.ts", start: 4, end: 4 }, to: { start: 9, end: 9 } },
    ]);
    assert.equal(planned.text, "See [a]( src/a.ts#L5-L6 ) and @[ src/b.ts#L9 ].\n");
    assert.equal(planned.applied.length, 2);
  });

  test("conflicting suggestions apply nothing", () => {
    const src = "See [a](src/a.ts#L1-L2).\n";
    const planned = planGlossRefRewrites(src, [
      { from: { file: "src/a.ts", start: 1, end: 2 }, to: { start: 5, end: 6 } },
      { from: { file: "src/a.ts", start: 1, end: 2 }, to: { start: 9, end: 10 } },
    ]);
    assert.equal(planned.text, src);
    assert.deepEqual(planned.applied, []);
  });
});

describe("checkGloss suggest / ambiguous", () => {
  test("unique move on a range problem and on drift", () => {
    const dir = projectWith("one\ntwo\nthree\n");
    writeLock(dir, buildLock(dir, collectRefs(readFileSync(join(dir, "gloss.md"), "utf8"))));

    writeFileSync(join(dir, "src/a.ts"), "pad\none\ntwo\nthree\n");
    const drift = checkGloss(dir, collectRefs(readFileSync(join(dir, "gloss.md"), "utf8")));
    assert.equal(drift.length, 1);
    assert.equal(drift[0]?.reason, "drift");
    assert.deepEqual(drift[0]?.suggest, { start: 2, end: 3 });

    const dir2 = projectWith(
      "pad\npad\none\ntwo\n",
      "# T\n\nLead.\n\n## One\n\nSee [a](src/a.ts#L3-L4).\n",
    );
    writeLock(dir2, buildLock(dir2, collectRefs(readFileSync(join(dir2, "gloss.md"), "utf8"))));
    writeFileSync(join(dir2, "src/a.ts"), "one\ntwo\n");
    const range = checkGloss(dir2, collectRefs(readFileSync(join(dir2, "gloss.md"), "utf8")));
    assert.equal(range.length, 1);
    assert.equal(range[0]?.reason, "range");
    assert.deepEqual(range[0]?.suggest, { start: 1, end: 2 });
  });

  test("ambiguous when the locked block is in the file more than once", () => {
    const dir = projectWith("aa\nbb\n");
    writeLock(dir, buildLock(dir, collectRefs(readFileSync(join(dir, "gloss.md"), "utf8"))));
    writeFileSync(join(dir, "src/a.ts"), "pad\naa\nbb\naa\nbb\n");
    const problems = checkGloss(dir, collectRefs(readFileSync(join(dir, "gloss.md"), "utf8")));
    assert.equal(problems.length, 1);
    assert.equal(problems[0]?.ambiguous, 2);
    assert.equal(problems[0]?.suggest, undefined);
  });

  test("no hint when the locked text is gone", () => {
    const dir = projectWith("one\ntwo\n");
    writeLock(dir, buildLock(dir, collectRefs(readFileSync(join(dir, "gloss.md"), "utf8"))));
    writeFileSync(join(dir, "src/a.ts"), "zzz\nyyy\n");
    const problems = checkGloss(dir, collectRefs(readFileSync(join(dir, "gloss.md"), "utf8")));
    assert.equal(problems.length, 1);
    assert.equal(problems[0]?.suggest, undefined);
    assert.equal(problems[0]?.ambiguous, undefined);
  });
});
