import assert from "node:assert/strict";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { after, describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { runCheck } from "../scripts/check-gloss.js";
import { readLock } from "../server/lock.js";

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
    assert.equal(runCheck([self]), 0);
    assert.ok(readLock(self));
    assert.equal(runCheck([self]), 0);
  });

  test("mixed-case self folder is a valid id after lowercasing", () => {
    const self = join(tmp, "Dualine");
    mkdirSync(self);
    writeFileSync(join(self, "gloss.md"), "# Dualine\n\nLead.\n\n## One\n\nHi.\n");
    assert.equal(runCheck([self]), 0);
  });

  test("unservable id is a problem", () => {
    const root = join(tmp, "ids");
    mkdirSync(join(root, "Bad Name"), { recursive: true });
    writeFileSync(join(root, "Bad Name", "gloss.md"), "# Bad\n\nNope.\n");
    assert.equal(runCheck([root]), 1);
  });

  test("--dry-run on a fresh project writes nothing", () => {
    const dir = join(tmp, "fresh-dry");
    mkdirSync(join(dir, "src"), { recursive: true });
    writeFileSync(join(dir, "src/a.ts"), "export const a = 1;\n");
    writeFileSync(join(dir, "gloss.md"), "# T\n\nLead.\n\n## One\n\nSee [a](src/a.ts#L1).\n");
    const got = capture(() => runCheck([dir, "--dry-run"]));
    assert.equal(got.code, 0);
    assert.equal(existsSync(join(dir, "gloss.lock")), false);
    assert.doesNotMatch(got.out, /已生成/);
  });
});

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

function maskRefs(src: string): string {
  return src.replace(/#L\d+(?:-L?\d+)?/g, "#L#");
}

describe("runCheck --fix", () => {
  test("copies shortly, shifts a faced file, rewrites only the numbers", () => {
    const dest = join(tmp, "shortly-fix");
    cpSync(join(REPO, "examples/shortly"), dest, { recursive: true });
    const serverPath = join(dest, "src/server.ts");
    const origServer = readFileSync(serverPath, "utf8");
    writeFileSync(serverPath, "// pad\n// pad\n" + origServer);

    const glossBefore = readFileSync(join(dest, "gloss.md"), "utf8");
    const lockBefore = readLock(dest);
    assert.ok(lockBefore);
    const span18 = lockBefore.spans.find((s) => s.start === 18 && s.end === 59);
    assert.ok(span18);

    const first = capture(() => runCheck([dest, "--fix"]));
    assert.match(first.out, /src\/server\.ts#L18-L59 → L20-L61/);
    assert.match(first.out, /anchors relocated/);
    assert.equal(first.code, 0);

    const glossAfter = readFileSync(join(dest, "gloss.md"), "utf8");
    assert.notEqual(glossAfter, glossBefore);
    assert.equal(maskRefs(glossAfter), maskRefs(glossBefore));
    assert.match(glossAfter, /src\/server\.ts#L20-L61/);
    assert.doesNotMatch(glossAfter, /src\/server\.ts#L18-L59/);
    assert.match(glossAfter, /src\/index\.ts#L4-L6/);

    const lockAfter = readLock(dest);
    assert.ok(lockAfter);
    const moved = lockAfter.spans.find((s) => s.loc === span18.loc);
    assert.ok(moved);
    assert.equal(moved.start, 20);
    assert.equal(moved.end, 61);
    assert.equal(moved.sha256, span18.sha256);

    const second = capture(() => runCheck([dest]));
    assert.equal(second.code, 0);
    assert.match(second.out, /0 problems/);
  });

  test("--dry-run prints the move and writes nothing", () => {
    const dest = join(tmp, "shortly-dry");
    cpSync(join(REPO, "examples/shortly"), dest, { recursive: true });
    const serverPath = join(dest, "src/server.ts");
    writeFileSync(serverPath, "// pad\n" + readFileSync(serverPath, "utf8"));
    const glossBefore = readFileSync(join(dest, "gloss.md"), "utf8");
    const got = capture(() => runCheck([dest, "--fix", "--dry-run"]));
    assert.equal(got.code, 1);
    assert.match(got.out, /would be relocated/);
    assert.match(got.out, /src\/server\.ts#L18-L59 → L19-L60/);
    assert.equal(readFileSync(join(dest, "gloss.md"), "utf8"), glossBefore);
  });

  test("check and --fix cover two notes and name the note file", () => {
    const dir = join(tmp, "two-fix");
    mkdirSync(join(dir, "src"), { recursive: true });
    mkdirSync(join(dir, "gloss"), { recursive: true });
    writeFileSync(join(dir, "src/a.ts"), "keep\nmove-me\n");
    writeFileSync(join(dir, "gloss.md"), "# T\n\nLead.\n\n## One\n\nSee [a](src/a.ts#L2).\n");
    writeFileSync(join(dir, "gloss/b.md"), "# B\n\nLead.\n\n## One\n\nSee [a](src/a.ts#L2).\n");
    assert.equal(runCheck([dir, "--accept"]), 0);
    writeFileSync(join(dir, "src/a.ts"), "pad\nkeep\nmove-me\n");
    const got = capture(() => runCheck([dir, "--fix"]));
    assert.equal(got.code, 0);
    assert.match(got.out, /gloss\.md: src\/a\.ts#L2 → L3/);
    assert.match(got.out, /gloss\/b\.md: src\/a\.ts#L2 → L3/);
    assert.match(readFileSync(join(dir, "gloss.md"), "utf8"), /src\/a\.ts#L3/);
    assert.match(readFileSync(join(dir, "gloss/b.md"), "utf8"), /src\/a\.ts#L3/);
    const lock = readLock(dir);
    assert.ok(lock);
    const a = lock.spans.find((s) => s.loc === "c1.p1.a1");
    const b = lock.spans.find((s) => s.loc === "b:c1.p1.a1");
    assert.equal(a?.start, 3);
    assert.equal(b?.start, 3);
  });

  test("broken and ambiguous anchors stay problems after --fix", () => {
    const dir = join(tmp, "fix-remain");
    mkdirSync(join(dir, "src"), { recursive: true });
    writeFileSync(join(dir, "src/a.ts"), "keep\nmove-me\n");
    writeFileSync(join(dir, "src/b.ts"), "xx\n");
    writeFileSync(
      join(dir, "gloss.md"),
      "# T\n\nLead.\n\n## One\n\nSee [ok](src/a.ts#L2) and [gone](src/a.ts#L1) and [dup](src/b.ts#L1).\n",
    );
    assert.equal(runCheck([dir, "--accept"]), 0);
    writeFileSync(join(dir, "src/a.ts"), "pad\nextra\nmove-me\n");
    writeFileSync(join(dir, "src/b.ts"), "pad\nxx\nxx\n");
    const got = capture(() => runCheck([dir, "--fix"]));
    assert.equal(got.code, 1);
    const gloss = readFileSync(join(dir, "gloss.md"), "utf8");
    assert.match(gloss, /\[ok\]\(src\/a\.ts#L3\)/);
    assert.match(gloss, /\[gone\]\(src\/a\.ts#L1\)/);
    assert.match(gloss, /\[dup\]\(src\/b\.ts#L1\)/);
    assert.match(got.out, /src\/a\.ts#L2 → L3/);
    assert.match(got.out, /text found 2 times/);
  });
});
