import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";
import { createApiServer, handle } from "../server/index.js";

const prevProjectsDir = process.env.GLOSS_PROJECTS_DIR;
delete process.env.GLOSS_PROJECTS_DIR;

let server: Server;
let base = "";

before(async () => {
  server = createApiServer();
  await new Promise<void>((resolve, reject) => {
    server.listen(0, "127.0.0.1", () => resolve());
    server.once("error", reject);
  });
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("no listen address");
  base = `http://127.0.0.1:${addr.port}`;
});

after(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
  if (prevProjectsDir === undefined) delete process.env.GLOSS_PROJECTS_DIR;
  else process.env.GLOSS_PROJECTS_DIR = prevProjectsDir;
});

async function get(path: string, method = "GET") {
  return fetch(`${base}${path}`, { method });
}

describe("createApiServer", () => {
  test("GET /api/health", async () => {
    const res = await get("/api/health");
    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      ok: boolean;
      root: string;
      rootStatus: string;
    };
    assert.equal(body.ok, true);
    assert.equal(body.rootStatus, "ok");
    assert.equal(typeof body.root, "string");
  });

  test("GET /api/projects lists shortly", async () => {
    const res = await get("/api/projects");
    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      projects: { id: string }[];
      root: string;
      rootStatus: string;
    };
    assert.equal(body.rootStatus, "ok");
    assert.ok(body.projects.some((p) => p.id === "shortly"));
  });

  test("GET /api/projects/shortly", async () => {
    const res = await get("/api/projects/shortly");
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("cache-control"), "no-store");
    const body = (await res.json()) as {
      gloss: string;
      files: Record<string, string>;
      warnings: string[];
    };
    assert.equal(typeof body.gloss, "string");
    assert.ok(body.gloss.includes("shortly"));
    assert.equal(typeof body.files, "object");
    assert.ok(body.files);
    assert.deepEqual(body.warnings, []);
  });

  test("invalid and missing ids", async () => {
    const escape = await get("/api/projects/..%2Fx");
    assert.equal(escape.status, 400);
    const missing = await get("/api/projects/nope");
    assert.equal(missing.status, 404);
    const bad = await get("/api/projects/Bad");
    assert.equal(bad.status, 400);
  });

  test("POST is 405 with Allow: GET", async () => {
    const res = await get("/api/projects", "POST");
    assert.equal(res.status, 405);
    assert.equal(res.headers.get("allow"), "GET");
    assert.deepEqual(await res.json(), { error: "method not allowed" });
  });

  test("unknown path is 404; trailing slash lists projects", async () => {
    const nope = await get("/nope");
    assert.equal(nope.status, 404);
    const slash = await get("/api/projects/");
    assert.equal(slash.status, 200);
    const body = (await slash.json()) as { projects: { id: string }[] };
    assert.ok(body.projects.some((p) => p.id === "shortly"));
  });
});

describe("handle catalog against an explicit root", () => {
  test("missing dir vs empty folder vs a file", () => {
    const missing = join(tmpdir(), `gloss-missing-${Date.now()}`);
    const miss = handle("GET", "/api/projects", missing);
    assert.equal(miss.status, 200);
    const missBody = miss.body as {
      projects: unknown[];
      root: string;
      rootStatus: string;
    };
    assert.equal(missBody.rootStatus, "missing");
    assert.deepEqual(missBody.projects, []);

    const empty = mkdtempSync(join(tmpdir(), "gloss-empty-"));
    try {
      const ok = handle("GET", "/api/projects", empty);
      const okBody = ok.body as { projects: unknown[]; rootStatus: string };
      assert.equal(ok.status, 200);
      assert.equal(okBody.rootStatus, "ok");
      assert.deepEqual(okBody.projects, []);
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }

    const dir = mkdtempSync(join(tmpdir(), "gloss-file-"));
    const file = join(dir, "not-a-dir");
    writeFileSync(file, "x\n");
    try {
      const bad = handle("GET", "/api/projects", file);
      const badBody = bad.body as { rootStatus: string };
      assert.equal(bad.status, 200);
      assert.equal(badBody.rootStatus, "not-directory");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("lists a real project from a temp folder", () => {
    const root = mkdtempSync(join(tmpdir(), "gloss-handle-"));
    try {
      mkdirSync(join(root, "demo"));
      writeFileSync(
        join(root, "demo", "gloss.md"),
        "---\nname: Demo\ntagline: hi\n---\n# Demo\n\nLead.\n",
      );
      const listed = handle("GET", "/api/projects", root);
      const body = listed.body as { projects: { id: string; name: string }[] };
      assert.deepEqual(body.projects, [{ id: "demo", name: "Demo", tagline: "hi", lang: "typescript" }]);
      const detail = handle("GET", "/api/projects/demo", root);
      assert.equal(detail.status, 200);
      const missing = handle("GET", "/api/projects/nope", root);
      assert.equal(missing.status, 404);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a folder with gloss.md is listed as itself; /rev tracks the stamp", () => {
    const parent = mkdtempSync(join(tmpdir(), "gloss-self-api-"));
    const self = join(parent, "solo");
    try {
      mkdirSync(self);
      writeFileSync(join(self, "gloss.md"), "# Solo\n\nLead.\n\n## One\n\nHi.\n");
      const id = "solo";
      const listed = handle("GET", "/api/projects", self);
      const body = listed.body as { projects: { id: string }[] };
      assert.deepEqual(
        body.projects.map((p) => p.id),
        [id],
      );
      const detail = handle("GET", `/api/projects/${id}`, self);
      assert.equal(detail.status, 200);
      const payload = detail.body as { rev: string; gloss: string };
      assert.match(payload.rev, /^\d+$/);
      const rev = handle("GET", `/api/projects/${id}/rev`, self);
      assert.equal(rev.status, 200);
      assert.deepEqual(rev.body, { rev: payload.rev });
      const missingRev = handle("GET", "/api/projects/nope/rev", self);
      assert.equal(missingRev.status, 404);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });
});
