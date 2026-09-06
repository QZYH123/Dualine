import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { after, describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { listProjects, loadProject } from "../server/projects.js";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const EXAMPLES = resolve(REPO, "examples");
const root = mkdtempSync(join(tmpdir(), "gloss-projects-"));

after(() => {
  rmSync(root, { recursive: true, force: true });
});

const validDir = join(root, "valid");
mkdirSync(join(validDir, "src"), { recursive: true });
mkdirSync(join(validDir, "docs"), { recursive: true });
mkdirSync(join(validDir, ".hidden"), { recursive: true });
mkdirSync(join(validDir, "node_modules/dep"), { recursive: true });

writeFileSync(
  join(validDir, "src/a.ts"),
  "export const a = 1;\nexport const b = 2;\nexport const c = 3;\n",
);
writeFileSync(join(validDir, "src/b.ts"), "export const b = 1;\n");
writeFileSync(join(validDir, "docs/notes.md"), "# Notes\n");
writeFileSync(join(validDir, "src/img.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
writeFileSync(join(validDir, ".hidden/x.ts"), "export const hidden = 1;\n");
writeFileSync(join(validDir, "node_modules/dep/index.js"), "module.exports = 1;\n");
writeFileSync(
  join(validDir, "gloss.md"),
  `---
name: Valid
tagline: A valid project
lang: typescript
---

# Valid

Intro.

## One

See [a](src/a.ts#L1) and [notes](docs/notes.md#L1).

@[src/gone.ts#L1]
This file is [missing](src/gone.ts#L1).

And [out of range](src/a.ts#L99).
`,
);

mkdirSync(join(root, "empty-dir"));
writeFileSync(join(root, "empty-dir", "readme.txt"), "no gloss here\n");

const badDir = join(root, "Bad Name");
mkdirSync(badDir);
writeFileSync(join(badDir, "gloss.md"), "# Bad\n\nNope.\n");

describe("listProjects", () => {
  test("returns only the valid project, sorted, with meta", () => {
    assert.deepEqual(listProjects(root), [
      {
        id: "valid",
        name: "Valid",
        tagline: "A valid project",
        lang: "typescript",
      },
    ]);
  });

  test("nonexistent root is empty", () => {
    assert.deepEqual(listProjects(join(root, "does-not-exist")), []);
  });
});

describe("loadProject", () => {
  test("includes referenced files and src walk; skips binary/hidden/deps", () => {
    const detail = loadProject("valid", root);
    assert.ok(detail);
    assert.equal(detail.name, "Valid");
    assert.ok("src/a.ts" in detail.files);
    assert.ok("src/b.ts" in detail.files);
    assert.ok("docs/notes.md" in detail.files);
    assert.equal("src/img.png" in detail.files, false);
    assert.equal(".hidden/x.ts" in detail.files, false);
    assert.equal(
      Object.keys(detail.files).some((k) => k.includes("node_modules")),
      false,
    );
  });

  test("warnings are exact, one missing and one range, no duplicates", () => {
    const detail = loadProject("valid", root);
    assert.ok(detail);
    assert.deepEqual(detail.warnings, [
      "c1.p2.a1 → src/gone.ts#L1: file missing",
      "c1.p3.a1 → src/a.ts#L99: file has 3 lines",
    ]);
  });

  test("rejects escape, missing, and unservable ids", () => {
    assert.equal(loadProject("../etc", root), null);
    assert.equal(loadProject("nope", root), null);
    assert.equal(loadProject("Bad Name", root), null);
  });

  test("name falls back to id when frontmatter lacks it", () => {
    const anonRoot = mkdtempSync(join(tmpdir(), "gloss-anon-"));
    try {
      mkdirSync(join(anonRoot, "anon"));
      writeFileSync(join(anonRoot, "anon", "gloss.md"), "# Hello\n\nHi.\n");
      const detail = loadProject("anon", anonRoot);
      assert.equal(detail?.name, "anon");
    } finally {
      rmSync(anonRoot, { recursive: true, force: true });
    }
  });

  test("shortly against examples/ has 5 files and no warnings", () => {
    const prev = process.env.GLOSS_PROJECTS_DIR;
    delete process.env.GLOSS_PROJECTS_DIR;
    try {
      const detail = loadProject("shortly", EXAMPLES);
      assert.ok(detail);
      assert.equal(Object.keys(detail.files).length, 5);
      assert.deepEqual(detail.warnings, []);
      for (const f of [
        "src/index.ts",
        "src/server.ts",
        "src/slug.ts",
        "src/store.ts",
        "src/validate.ts",
      ]) {
        assert.ok(f in detail.files, f);
      }
    } finally {
      if (prev === undefined) delete process.env.GLOSS_PROJECTS_DIR;
      else process.env.GLOSS_PROJECTS_DIR = prev;
    }
  });
});
