import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { after, describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { runCheck } from "../scripts/check-gloss.js";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const tmp = mkdtempSync(join(tmpdir(), "gloss-check-"));

after(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe("runCheck", () => {
  test("examples/shortly is clean", () => {
    assert.equal(runCheck([join(REPO, "examples")]), 0);
  });

  test("missing dir is exit 2; a file is exit 2", () => {
    const missing = join(tmp, "no-such-dir");
    assert.equal(runCheck([missing]), 2);
    const file = join(tmp, "a-file");
    writeFileSync(file, "not a dir\n");
    assert.equal(runCheck([file]), 2);
  });

  test("empty folder is exit 1", () => {
    const empty = join(tmp, "empty");
    mkdirSync(empty);
    assert.equal(runCheck([empty]), 1);
  });

  test("a folder with gloss.md at its root is checked as one project", () => {
    const self = join(tmp, "self-app");
    mkdirSync(self);
    writeFileSync(
      join(self, "gloss.md"),
      "# Self\n\nLead.\n\n## One\n\nSee [a](src/a.ts#L1).\n",
    );
    mkdirSync(join(self, "src"));
    writeFileSync(join(self, "src/a.ts"), "export const a = 1;\n");
    assert.equal(runCheck([self]), 1);
    assert.equal(runCheck([self, "--accept"]), 0);
    assert.equal(runCheck([self]), 0);
  });

  test("unservable id is a problem", () => {
    const root = join(tmp, "ids");
    mkdirSync(join(root, "Bad Name"), { recursive: true });
    writeFileSync(join(root, "Bad Name", "gloss.md"), "# Bad\n\nNope.\n");
    assert.equal(runCheck([root]), 1);
  });
});
