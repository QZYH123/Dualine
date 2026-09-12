import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, test } from "node:test";
import {
  LOCK_MISSING,
  buildLock,
  checkLock,
  hashRef,
  readLock,
  spanHash,
  spanSlice,
  writeLock,
} from "../server/lock.js";
import { collectRefs } from "../server/validate.js";
import { runCheck } from "../scripts/check-gloss.js";

const tmp = mkdtempSync(join(tmpdir(), "gloss-lock-"));

after(() => {
  rmSync(tmp, { recursive: true, force: true });
});

function projectWith(src: string): string {
  const parent = mkdtempSync(join(tmp, "p-"));
  const dir = join(parent, "demo");
  mkdirSync(join(dir, "src"), { recursive: true });
  writeFileSync(join(dir, "src/a.ts"), src);
  writeFileSync(
    join(dir, "gloss.md"),
    "# T\n\nLead.\n\n## One\n\nSee [a](src/a.ts#L1-L2).\n",
  );
  return dir;
}

describe("spanSlice / spanHash", () => {
  test("hashes the faced lines, not the rest of the file", () => {
    const src = "one\ntwo\nthree\n";
    assert.equal(spanSlice(src, 1, 2), "one\ntwo");
    assert.equal(spanSlice(src, 2, 2), "two");
    assert.equal(spanSlice(src, 1, 9), null);
    assert.equal(spanHash("one\ntwo"), spanHash("one\ntwo"));
    assert.notEqual(spanHash("one\ntwo"), spanHash("one\ntwo\n"));
  });
});

describe("gloss.lock", () => {
  test("missing lock is one problem; --accept writes; edit is drift", () => {
    const dir = projectWith("export const a = 1;\nexport const b = 2;\n");
    const refs = collectRefs(readFileSync(join(dir, "gloss.md"), "utf8"));
    const ok = new Set(refs.map((r) => r.loc));

    const missing = checkLock(dir, refs, ok);
    assert.equal(missing.length, 1);
    assert.equal(missing[0].message, LOCK_MISSING);

    assert.equal(runCheck([dir, "--accept"]), 0);
    const lock = readLock(dir);
    assert.ok(lock);
    assert.equal(lock.spans.length, 1);
    assert.match(lock.spans[0].sha256, /^[a-f0-9]{64}$/);
    assert.equal(runCheck([dir]), 0);

    writeFileSync(join(dir, "src/a.ts"), "export const a = 99;\nexport const b = 2;\n");
    assert.equal(runCheck([dir]), 1);

    const drifted = checkLock(dir, refs, ok);
    assert.ok(drifted.some((p) => p.message.includes("code changed since gloss.lock")));

    const shaBefore = hashRef(dir, refs[0].ref);
    assert.ok(shaBefore);
    assert.notEqual(shaBefore, lock.spans[0].sha256);

    assert.equal(runCheck([dir, "--accept"]), 0);
    assert.equal(runCheck([dir]), 0);
  });

  test("same text at new lines is still a match", () => {
    const dir = projectWith("export const a = 1;\nexport const b = 2;\n");
    writeLock(dir, buildLock(dir, collectRefs(readFileSync(join(dir, "gloss.md"), "utf8"))));
    writeFileSync(
      join(dir, "src/a.ts"),
      "// pad\nexport const a = 1;\nexport const b = 2;\n",
    );
    writeFileSync(
      join(dir, "gloss.md"),
      "# T\n\nLead.\n\n## One\n\nSee [a](src/a.ts#L2-L3).\n",
    );
    assert.equal(runCheck([dir]), 0);
  });
});
