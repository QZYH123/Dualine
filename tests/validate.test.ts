import assert from "node:assert/strict";
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { after, describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  checkRefs,
  collectRefs,
  inspectRoot,
  lineCount,
  MAX_FILE_BYTES,
  projectsRoot,
  readTextFile,
  refLabel,
  resolveProjectsDir,
} from "../server/validate.js";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const tmp = mkdtempSync(join(tmpdir(), "gloss-validate-"));
const projectDir = join(tmp, "proj");

after(() => {
  rmSync(tmp, { recursive: true, force: true });
});

mkdirSync(join(projectDir, "src"), { recursive: true });
writeFileSync(join(projectDir, "src/ok.ts"), "one\ntwo\nthree\n");

const ORDER_GLOSS = `---
name: order
---

# Title

Lead has [one](src/a.ts#L1-L2) and [two](src/a.ts#L3).

## Alpha

First [alpha](src/a.ts#L1) then [beta](src/b.ts#L1-L4).

@[src/c.ts#L5]
Only explicit.

@[src/a.ts#L1]
Same as [alpha](src/a.ts#L1) so explicit is skipped.

## Beta

Bare paragraph with no anchors.
`;

describe("collectRefs", () => {
  test("locs and ordering: lead, passage anchors, explicit-only", () => {
    const refs = collectRefs(ORDER_GLOSS);
    assert.deepEqual(
      refs.map((r) => r.loc),
      ["lead.a1", "lead.a2", "c1.p1.a1", "c1.p1.a2", "c1.p2", "c1.p3.a1"],
    );
    assert.deepEqual(refs[0]?.ref, { file: "src/a.ts", start: 1, end: 2 });
    assert.deepEqual(refs[1]?.ref, { file: "src/a.ts", start: 3, end: 3 });
    assert.deepEqual(refs[4]?.ref, { file: "src/c.ts", start: 5, end: 5 });
    assert.equal(
      refs.some((r) => r.loc === "c1.p3"),
      false,
      "explicit that matches an anchor is not re-emitted",
    );
    assert.equal(
      refs.some((r) => r.loc === "c2.p4"),
      false,
    );
  });
});

describe("checkRefs", () => {
  test("outside: relative escape and absolute path", () => {
    const problems = checkRefs(projectDir, [
      { loc: "t1", ref: { file: "../x.ts", start: 1, end: 1 } },
      { loc: "t2", ref: { file: "/etc/passwd", start: 1, end: 1 } },
    ]);
    assert.equal(problems.length, 2);
    assert.equal(problems[0]?.reason, "outside");
    assert.equal(problems[0]?.message, "t1 → ../x.ts#L1: path outside project");
    assert.equal(problems[1]?.reason, "outside");
    assert.equal(problems[1]?.message, "t2 → /etc/passwd#L1: path outside project");
  });

  test("outside: symlink pointing outside the project", (t) => {
    const outside = join(tmp, "outside.ts");
    writeFileSync(outside, "secret\n");
    const link = join(projectDir, "escape.ts");
    try {
      symlinkSync(outside, link);
    } catch (err) {
      if (
        err &&
        typeof err === "object" &&
        "code" in err &&
        (err as { code: string }).code === "EPERM"
      ) {
        t.skip("symlinkSync EPERM");
        return;
      }
      throw err;
    }
    const problems = checkRefs(projectDir, [
      { loc: "t", ref: { file: "escape.ts", start: 1, end: 1 } },
    ]);
    assert.equal(problems[0]?.reason, "outside");
    assert.equal(problems[0]?.message, "t → escape.ts#L1: path outside project");
  });

  test("missing, range, and ok", () => {
    const problems = checkRefs(projectDir, [
      { loc: "m", ref: { file: "src/nope.ts", start: 1, end: 1 } },
      { loc: "r1", ref: { file: "src/ok.ts", start: 1, end: 99 } },
      { loc: "r0", ref: { file: "src/ok.ts", start: 0, end: 1 } },
      { loc: "ok", ref: { file: "src/ok.ts", start: 1, end: 3 } },
    ]);
    assert.equal(problems.length, 3);
    assert.equal(problems[0]?.reason, "missing");
    assert.equal(problems[0]?.message, "m → src/nope.ts#L1: file missing");
    assert.equal(problems[1]?.reason, "range");
    assert.equal(problems[1]?.message, "r1 → src/ok.ts#L1-L99: file has 3 lines");
    assert.equal(problems[2]?.reason, "range");
    assert.equal(problems[2]?.message, "r0 → src/ok.ts#L0-L1: file has 3 lines");
  });
});

describe("lineCount / refLabel / readTextFile / projectsRoot", () => {
  test("lineCount edge cases", () => {
    assert.equal(lineCount(""), 0);
    assert.equal(lineCount("a"), 1);
    assert.equal(lineCount("a\n"), 1);
    assert.equal(lineCount("a\nb"), 2);
    assert.equal(lineCount("a\nb\n"), 2);
    assert.equal(lineCount("a\r\nb\r\n"), 2);
    assert.equal(lineCount("a\n\n"), 2);
  });

  test("refLabel", () => {
    assert.equal(refLabel({ file: "a.ts", start: 3, end: 3 }), "a.ts#L3");
    assert.equal(refLabel({ file: "a.ts", start: 3, end: 9 }), "a.ts#L3-L9");
  });

  test("readTextFile rejects png, NUL, and oversized files", () => {
    const png = join(tmp, "pic.png");
    writeFileSync(png, "not really a png");
    assert.equal(readTextFile(png), null);

    const nul = join(tmp, "nul.ts");
    writeFileSync(nul, Buffer.from("a\0b"));
    assert.equal(readTextFile(nul), null);

    const big = join(tmp, "big.ts");
    writeFileSync(big, Buffer.alloc(MAX_FILE_BYTES + 1, 0x61));
    assert.equal(readTextFile(big), null);

    const ok = join(tmp, "ok.ts");
    writeFileSync(ok, "hello\n");
    assert.equal(readTextFile(ok), "hello\n");
  });

  test("projectsRoot honours GLOSS_PROJECTS_DIR and defaults to examples", () => {
    const prev = process.env.GLOSS_PROJECTS_DIR;
    try {
      delete process.env.GLOSS_PROJECTS_DIR;
      assert.equal(projectsRoot(), resolve(REPO, "examples"));
      process.env.GLOSS_PROJECTS_DIR = "/tmp/custom-gloss-root";
      assert.equal(projectsRoot(), resolve("/tmp/custom-gloss-root"));
      process.env.GLOSS_PROJECTS_DIR = "";
      assert.equal(projectsRoot(), resolve(REPO, "examples"));
      process.env.GLOSS_PROJECTS_DIR = "   ";
      assert.equal(projectsRoot(), resolve(REPO, "examples"));
    } finally {
      if (prev === undefined) delete process.env.GLOSS_PROJECTS_DIR;
      else process.env.GLOSS_PROJECTS_DIR = prev;
    }
  });

  test("resolveProjectsDir trims, expands ~, and leaves Windows paths as pasted", () => {
    const spaced = join(tmp, "with spaces");
    mkdirSync(spaced);
    assert.equal(resolveProjectsDir(`  ${spaced}  `), resolve(spaced));
    assert.equal(resolveProjectsDir(`${projectDir}/`), resolve(projectDir));
    assert.equal(resolveProjectsDir("~"), homedir());
    assert.equal(resolveProjectsDir("~/glosses"), resolve(homedir(), "glosses"));
    assert.equal(resolveProjectsDir("  ~/glosses  "), resolve(homedir(), "glosses"));
    assert.equal(resolveProjectsDir("C:/Users/foo/glosses"), "C:/Users/foo/glosses");
    assert.equal(resolveProjectsDir("C:\\Users\\foo\\glosses"), "C:\\Users\\foo\\glosses");

    const prev = process.env.GLOSS_PROJECTS_DIR;
    try {
      process.env.GLOSS_PROJECTS_DIR = `  ${projectDir}  `;
      assert.equal(projectsRoot(), resolve(projectDir));
      process.env.GLOSS_PROJECTS_DIR = "C:/Users/foo/glosses";
      assert.equal(projectsRoot(), "C:/Users/foo/glosses");
      assert.equal(inspectRoot().status, "missing");
      assert.equal(inspectRoot().root, "C:/Users/foo/glosses");
    } finally {
      if (prev === undefined) delete process.env.GLOSS_PROJECTS_DIR;
      else process.env.GLOSS_PROJECTS_DIR = prev;
    }
  });

  test("inspectRoot distinguishes missing, file, and directory", () => {
    const missing = inspectRoot(join(tmp, "no-such"));
    assert.equal(missing.status, "missing");
    const file = join(tmp, "just-a-file");
    writeFileSync(file, "x\n");
    assert.equal(inspectRoot(file).status, "not-directory");
    assert.equal(inspectRoot(projectDir).status, "ok");
  });
});
