import assert from "node:assert/strict";
import type { Server } from "node:http";
import { after, before, describe, test } from "node:test";
import { createApiServer } from "../server/index.js";

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
    assert.deepEqual(await res.json(), { ok: true });
  });

  test("GET /api/projects lists shortly", async () => {
    const res = await get("/api/projects");
    assert.equal(res.status, 200);
    const body = (await res.json()) as { projects: { id: string }[] };
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
