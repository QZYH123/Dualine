import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { frozenPayload } from "../scripts/export-gloss.js";
import { loadProject } from "../server/projects.js";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const EXAMPLES = resolve(REPO, "examples");

describe("frozenPayload", () => {
  test("shortly serializes gloss and the five source files", () => {
    const detail = loadProject("shortly", EXAMPLES);
    assert.ok(detail);
    const payload = frozenPayload(detail);
    assert.equal(payload.id, "shortly");
    assert.equal(typeof payload.gloss, "string");
    assert.ok(payload.gloss.includes("shortly"));
    assert.equal(Object.keys(payload.files).length, 5);
    assert.deepEqual(payload.warnings, []);
    assert.equal("byNote" in payload, false);
    assert.equal("notes" in payload, false);
    assert.equal("note" in payload, false);
  });

  test("two notes add byNote; the top-level shape stays the default note", () => {
    const parent = mkdtempSync(join(tmpdir(), "gloss-export-two-"));
    const dir = join(parent, "demo");
    try {
      mkdirSync(join(dir, "src"), { recursive: true });
      mkdirSync(join(dir, "gloss"), { recursive: true });
      writeFileSync(join(dir, "src/a.ts"), "export const a = 1;\n");
      writeFileSync(join(dir, "gloss.md"), "---\nname: Demo\n---\n# Default\n\nLead.\n\n## One\n\nSee [a](src/a.ts#L1).\n");
      writeFileSync(join(dir, "gloss/b.md"), "# Other\n\nLead.\n\n## Two\n\nSee [a](src/a.ts#L1).\n");
      const detail = loadProject("demo", parent);
      const other = loadProject("demo", parent, { note: "b" });
      assert.ok(detail);
      assert.ok(other);
      const payload = frozenPayload(detail, [detail, other]);
      assert.equal(payload.id, "demo");
      assert.match(payload.gloss, /# Default/);
      assert.ok("byNote" in payload);
      const byNote = (payload as { byNote: Record<string, { gloss: string }> }).byNote;
      assert.match(byNote.gloss.gloss, /# Default/);
      assert.match(byNote.b.gloss, /# Other/);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });
});
