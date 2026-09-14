import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, test } from "node:test";
import {
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

function capture(fn: () => number): { code: number; out: string } {
  const chunks: string[] = [];
  const log = console.log;
  const err = console.error;
  console.log = (...a: unknown[]) => {
    chunks.push(a.map(String).join(" "));
  };
  console.error = (...a: unknown[]) => {
    chunks.push(a.map(String).join(" "));
  };
  try {
    return { code: fn(), out: chunks.join("\n") };
  } finally {
    console.log = log;
    console.error = err;
  }
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
  test("first check writes gloss.lock when refs land; edit is drift", () => {
    const dir = projectWith("export const a = 1;\nexport const b = 2;\n");
    const refs = collectRefs(readFileSync(join(dir, "gloss.md"), "utf8"));
    const ok = new Set(refs.map((r) => r.loc));

    assert.deepEqual(checkLock(dir, refs, ok), []);

    const first = capture(() => runCheck([dir]));
    assert.equal(first.code, 0);
    assert.match(first.out, /已生成/);
    assert.match(first.out, /0 problems/);
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

  test("broken refs on a fresh project do not write the lock", () => {
    const dir = projectWith("export const a = 1;\nexport const b = 2;\n");
    writeFileSync(
      join(dir, "gloss.md"),
      "# T\n\nLead.\n\n## One\n\nSee [gone](src/gone.ts#L1).\n",
    );
    const got = capture(() => runCheck([dir]));
    assert.equal(got.code, 1);
    assert.equal(existsSync(join(dir, "gloss.lock")), false);
    assert.match(got.out, /file missing/);
    assert.doesNotMatch(got.out, /已生成/);
    assert.doesNotMatch(got.out, /gloss\.lock missing/);
  });

  test("a new loc not in gloss.lock is unlocked, not drift", () => {
    const dir = projectWith("export const a = 1;\nexport const b = 2;\n");
    writeLock(dir, buildLock(dir, collectRefs(readFileSync(join(dir, "gloss.md"), "utf8"))));
    writeFileSync(
      join(dir, "gloss.md"),
      "# T\n\nLead.\n\n## One\n\nSee [a](src/a.ts#L1-L2).\n\n## Two\n\nAlso [b](src/a.ts#L2).\n",
    );
    const refs = collectRefs(readFileSync(join(dir, "gloss.md"), "utf8"));
    const ok = new Set(refs.map((r) => r.loc));
    const unlocked = checkLock(dir, refs, ok);
    assert.equal(unlocked.length, 1);
    assert.equal(unlocked[0]?.reason, "unlocked");
    assert.match(unlocked[0]?.message ?? "", /not in gloss\.lock/);
    const got = capture(() => runCheck([dir]));
    assert.equal(got.code, 1);
    assert.match(got.out, /not in gloss\.lock/);
    assert.match(got.out, /1 problem/);
  });

  test("two notes with the same loc keep distinct lock keys", () => {
    const parent = mkdtempSync(join(tmp, "two-"));
    const dir = join(parent, "demo");
    mkdirSync(join(dir, "src"), { recursive: true });
    mkdirSync(join(dir, "gloss"), { recursive: true });
    writeFileSync(join(dir, "src/a.ts"), "export const a = 1;\nexport const b = 2;\n");
    writeFileSync(join(dir, "gloss.md"), "# T\n\nLead.\n\n## One\n\nSee [a](src/a.ts#L1).\n");
    writeFileSync(join(dir, "gloss/b.md"), "# B\n\nLead.\n\n## One\n\nSee [a](src/a.ts#L1).\n");
    const first = capture(() => runCheck([dir]));
    assert.equal(first.code, 0);
    const lock = readLock(dir);
    assert.ok(lock);
    const locs = lock.spans.map((s) => s.loc).sort();
    assert.deepEqual(locs, ["b:c1.p1.a1", "c1.p1.a1"]);
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
