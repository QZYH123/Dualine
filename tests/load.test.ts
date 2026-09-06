import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  afterDetail,
  afterList,
  catalogFromListBody,
  isUsablePayload,
  requestedProjectId,
  SAMPLE_ID,
} from "../src/lib/load-decision.js";

const shortly = { id: "shortly", name: "shortly", tagline: "一个短链接服务" };
const okCatalog = {
  root: "/tmp/glosses",
  rootStatus: "ok" as const,
  projects: [shortly],
};

describe("requestedProjectId", () => {
  test("reads ?project= and treats blank as none", () => {
    assert.equal(requestedProjectId("?project=my-app"), "my-app");
    assert.equal(requestedProjectId("?project=  "), null);
    assert.equal(requestedProjectId(""), null);
    assert.equal(requestedProjectId("?other=1"), null);
  });
});

describe("afterList", () => {
  test("unreachable + no request or shortly → sample; other ids stay unreachable", () => {
    assert.equal(afterList(null, { unreachable: true }).kind, "sample");
    assert.equal(afterList(SAMPLE_ID, { unreachable: true }).kind, "sample");
    const miss = afterList("my-app", { unreachable: true });
    assert.deepEqual(miss, { kind: "unreachable", id: "my-app" });
  });

  test("list 502/500 is the same as unreachable", () => {
    assert.equal(afterList("my-app", { status: 502, body: null }).kind, "unreachable");
    assert.equal(afterList(null, { status: 500, body: { error: "x" } }).kind, "sample");
  });

  test("missing or not-directory root is no-dir even when an id was asked for", () => {
    const missing = afterList("my-app", {
      status: 200,
      body: { projects: [], root: "/nope", rootStatus: "missing" },
    });
    assert.equal(missing.kind, "no-dir");
    if (missing.kind === "no-dir") {
      assert.equal(missing.catalog.rootStatus, "missing");
      assert.equal(missing.catalog.root, "/nope");
    }

    const notDir = afterList(null, {
      status: 200,
      body: { projects: [], root: "/tmp/file", rootStatus: "not-directory" },
    });
    assert.equal(notDir.kind, "no-dir");
  });

  test("empty folder with no request is empty, not the sample", () => {
    const empty = afterList(null, {
      status: 200,
      body: { projects: [], root: "/tmp/glosses", rootStatus: "ok" },
    });
    assert.equal(empty.kind, "empty");
    if (empty.kind === "empty") assert.equal(empty.catalog.root, "/tmp/glosses");
  });

  test("no request opens the first listed project", () => {
    const next = afterList(null, { status: 200, body: { ...okCatalog, projects: [shortly] } });
    assert.deepEqual(next, { kind: "continue", id: "shortly", catalog: { ...okCatalog, projects: [shortly] } });
  });

  test("a named project continues even if it is not in the catalog yet", () => {
    const next = afterList("my-app", { status: 200, body: okCatalog });
    assert.equal(next.kind, "continue");
    if (next.kind === "continue") assert.equal(next.id, "my-app");
  });
});

describe("afterDetail", () => {
  test("200 with gloss+files is a project", () => {
    const payload = { id: "shortly", gloss: "# Hi\n", files: { "src/a.ts": "x" } };
    const got = afterDetail(null, "shortly", okCatalog, { status: 200, body: payload });
    assert.equal(got.kind, "project");
    if (got.kind === "project") assert.equal(got.payload.gloss, "# Hi\n");
  });

  test("404 is not-found and keeps the catalog for the notice list", () => {
    const got = afterDetail("my-app", "my-app", okCatalog, {
      status: 404,
      body: { error: "not found" },
    });
    assert.deepEqual(got, { kind: "not-found", id: "my-app", catalog: okCatalog });
  });

  test("200 with a useless body is not-found, not the sample", () => {
    const got = afterDetail("my-app", "my-app", okCatalog, { status: 200, body: { id: "x" } });
    assert.equal(got.kind, "not-found");
  });

  test("detail down: sample only if shortly was the honest ask", () => {
    assert.equal(
      afterDetail(null, SAMPLE_ID, okCatalog, { unreachable: true }).kind,
      "sample",
    );
    assert.equal(
      afterDetail(SAMPLE_ID, SAMPLE_ID, okCatalog, { status: 503, body: null }).kind,
      "sample",
    );
    const other = afterDetail("my-app", "my-app", okCatalog, { unreachable: true });
    assert.deepEqual(other, { kind: "unreachable", id: "my-app" });
    const firstWasOther = afterDetail(null, "my-app", okCatalog, { unreachable: true });
    assert.deepEqual(firstWasOther, { kind: "unreachable", id: "my-app" });
  });
});

describe("catalogFromListBody / isUsablePayload", () => {
  test("drops junk entries and unknown rootStatus", () => {
    const catalog = catalogFromListBody({
      projects: [{ id: "ok" }, { name: "no-id" }, null, "x"],
      root: "/tmp/g",
      rootStatus: "weird",
    });
    assert.deepEqual(catalog.projects, [{ id: "ok" }]);
    assert.equal(catalog.root, "/tmp/g");
    assert.equal(catalog.rootStatus, undefined);
    assert.deepEqual(catalogFromListBody(null).projects, []);
  });

  test("payload needs gloss string and files object", () => {
    assert.equal(isUsablePayload({ gloss: "#", files: {} }), true);
    assert.equal(isUsablePayload({ gloss: "#", files: null }), false);
    assert.equal(isUsablePayload({ files: {} }), false);
    assert.equal(isUsablePayload(null), false);
  });
});
