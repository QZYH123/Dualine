import assert from "node:assert/strict";
import { dirname, resolve } from "node:path";
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
  });
});
