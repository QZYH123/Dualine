import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import http from "node:http";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";
import { createApiServer, handle } from "../server/index.js";
import { contentTypeFor, pathHasDotDot, resolveStatic } from "../server/static.js";

const tmp = mkdtempSync(join(tmpdir(), "gloss-static-"));
const dist = join(tmp, "dist");
const project = join(tmp, "MyApp");

mkdirSync(join(dist, "assets"), { recursive: true });
writeFileSync(join(dist, "index.html"), "<!doctype html><title>ui</title><div id=\"root\"></div>\n");
writeFileSync(join(dist, "assets/app.js"), "console.log(1);\n");
writeFileSync(join(dist, "style.css"), "body{color:#111}\n");
writeFileSync(join(dist, "mark.svg"), "<svg xmlns='http://www.w3.org/2000/svg'></svg>\n");
mkdirSync(project);
writeFileSync(
  join(project, "gloss.md"),
  "---\nname: MyApp\n---\n# MyApp\n\nLead.\n\n## One\n\nHi.\n",
);

describe("resolveStatic / content types", () => {
  test("content types for the packaged extensions", () => {
    assert.equal(contentTypeFor("x.html"), "text/html; charset=utf-8");
    assert.equal(contentTypeFor("x.js"), "text/javascript; charset=utf-8");
    assert.equal(contentTypeFor("x.css"), "text/css; charset=utf-8");
    assert.equal(contentTypeFor("x.svg"), "image/svg+xml");
    assert.equal(contentTypeFor("x.woff2"), "font/woff2");
    assert.equal(contentTypeFor("x.json"), "application/json; charset=utf-8");
    assert.equal(contentTypeFor("x.png"), "image/png");
    assert.equal(contentTypeFor("x.ico"), "image/x-icon");
    assert.equal(contentTypeFor("x.js.map"), "application/json");
  });

  test("index, asset, SPA fallback; .. is rejected", () => {
    const index = resolveStatic("GET", "/", dist);
    assert.equal(index.status, 200);
    if (index.status === 200) {
      assert.equal(index.contentType, "text/html; charset=utf-8");
      assert.ok(index.file.endsWith("index.html"));
    }
    const asset = resolveStatic("GET", "/assets/app.js", dist);
    assert.equal(asset.status, 200);
    if (asset.status === 200) {
      assert.equal(asset.contentType, "text/javascript; charset=utf-8");
    }
    const spa = resolveStatic("GET", "/reader", dist);
    assert.equal(spa.status, 200);
    if (spa.status === 200) assert.ok(spa.file.endsWith("index.html"));
    assert.equal(resolveStatic("GET", "/../secret", dist).status, 404);
    assert.equal(pathHasDotDot("/../secret"), true);
    assert.equal(pathHasDotDot("/%2e%2e/secret"), true);
    assert.equal(pathHasDotDot("/assets/app.js"), false);
    assert.equal(resolveStatic("POST", "/", dist).status, 405);
  });
});

describe("createApiServer with dist + single folder", () => {
  let server: Server;
  let base = "";

  before(async () => {
    server = createApiServer({ root: project, single: true, distDir: dist });
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
    rmSync(tmp, { recursive: true, force: true });
  });

  test("GET / is index.html; an asset keeps its type", async () => {
    const page = await fetch(`${base}/`);
    assert.equal(page.status, 200);
    assert.match(page.headers.get("content-type") ?? "", /text\/html/);
    assert.match(await page.text(), /id="root"/);

    const js = await fetch(`${base}/assets/app.js`);
    assert.equal(js.status, 200);
    assert.match(js.headers.get("content-type") ?? "", /javascript/);
    assert.match(await js.text(), /console\.log/);

    const css = await fetch(`${base}/style.css`);
    assert.equal(css.status, 200);
    assert.match(css.headers.get("content-type") ?? "", /text\/css/);
  });

  test("SPA fallback and path traversal", async () => {
    const spa = await fetch(`${base}/no-such-route`);
    assert.equal(spa.status, 200);
    assert.match(await spa.text(), /id="root"/);

    const port = Number(new URL(base).port);
    const rawGet = (urlPath: string) =>
      new Promise<{ status: number }>((resolve, reject) => {
        const req = http.request(
          { host: "127.0.0.1", port, path: urlPath, method: "GET" },
          (res) => {
            res.resume();
            res.on("end", () => resolve({ status: res.statusCode ?? 0 }));
          },
        );
        req.on("error", reject);
        req.end();
      });

    const trav = await rawGet("/../secret");
    assert.ok(trav.status === 404 || trav.status === 403, `.. → ${trav.status}`);

    const encoded = await rawGet("/%2e%2e/secret");
    assert.ok(encoded.status === 404 || encoded.status === 403, `%2e%2e → ${encoded.status}`);
  });

  test("/api still wins over the SPA", async () => {
    const listed = await fetch(`${base}/api/projects`);
    assert.equal(listed.status, 200);
    assert.match(listed.headers.get("content-type") ?? "", /json/);
    const body = (await listed.json()) as {
      projects: { id: string }[];
      single: boolean;
    };
    assert.equal(body.single, true);
    assert.deepEqual(
      body.projects.map((p) => p.id),
      ["myapp"],
    );

    const detail = handle("GET", "/api/projects/myapp", project, { single: true });
    assert.equal(detail.status, 200);
    const payload = detail.body as { id: string; gloss: string; rev: string };
    assert.equal(payload.id, "myapp");
    assert.match(payload.gloss, /MyApp/);
    assert.match(payload.rev, /^\d+$/);

    const live = await fetch(`${base}/api/projects/myapp`);
    assert.equal(live.status, 200);
    const liveBody = (await live.json()) as { id: string };
    assert.equal(liveBody.id, "myapp");
  });
});
