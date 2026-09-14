import assert from "node:assert/strict";
import { createServer } from "node:net";
import { describe, test } from "node:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgv } from "../server/args.js";
import { chooseListenPort, pickFreePort, portFromEnv } from "../server/port.js";
import { packageRoot } from "../server/root.js";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("packageRoot", () => {
  test("finds the Dualine checkout from a nested file", () => {
    assert.equal(packageRoot(), REPO);
    assert.equal(packageRoot(fileURLToPath(import.meta.url)), REPO);
  });
});

describe("parseArgv", () => {
  test("help and version win over other args", () => {
    assert.deepEqual(parseArgv(["--help"]), { cmd: "help" });
    assert.deepEqual(parseArgv(["-h", "check"]), { cmd: "help" });
    assert.deepEqual(parseArgv(["--version"]), { cmd: "version" });
    assert.deepEqual(parseArgv(["-v"]), { cmd: "version" });
  });

  test("serve defaults to . and opens the browser", () => {
    assert.deepEqual(parseArgv([]), { cmd: "serve", dir: ".", open: true });
    assert.deepEqual(parseArgv(["examples/shortly"]), {
      cmd: "serve",
      dir: "examples/shortly",
      open: true,
    });
    assert.deepEqual(parseArgv([".", "--no-open"]), { cmd: "serve", dir: ".", open: false });
    assert.deepEqual(parseArgv(["--no-open"]), { cmd: "serve", dir: ".", open: false });
  });

  test("check, export, init", () => {
    assert.deepEqual(parseArgv(["check"]), {
      cmd: "check",
      dir: ".",
      accept: false,
      fix: false,
      dryRun: false,
    });
    assert.deepEqual(parseArgv(["check", "foo", "--accept"]), {
      cmd: "check",
      dir: "foo",
      accept: true,
      fix: false,
      dryRun: false,
    });
    assert.deepEqual(parseArgv(["check", "--fix"]), {
      cmd: "check",
      dir: ".",
      accept: false,
      fix: true,
      dryRun: false,
    });
    assert.deepEqual(parseArgv(["check", ".", "--fix", "--dry-run"]), {
      cmd: "check",
      dir: ".",
      accept: false,
      fix: true,
      dryRun: true,
    });
    assert.deepEqual(parseArgv(["check", "foo", "--fix", "--accept"]), {
      cmd: "check",
      dir: "foo",
      accept: true,
      fix: true,
      dryRun: false,
    });
    assert.deepEqual(parseArgv(["export"]), { cmd: "export", dir: "." });
    assert.deepEqual(parseArgv(["export", "bar", "--out", "/tmp/x"]), {
      cmd: "export",
      dir: "bar",
      out: "/tmp/x",
    });
    assert.deepEqual(parseArgv(["export", "--out=dest"]), {
      cmd: "export",
      dir: ".",
      out: "dest",
    });
    assert.deepEqual(parseArgv(["init"]), { cmd: "init", dir: ".", force: false });
    assert.deepEqual(parseArgv(["init", "app"]), { cmd: "init", dir: "app", force: false });
    assert.deepEqual(parseArgv(["init", "--force"]), { cmd: "init", dir: ".", force: true });
    assert.deepEqual(parseArgv(["init", "app", "--force"]), {
      cmd: "init",
      dir: "app",
      force: true,
    });
    assert.deepEqual(parseArgv(["init", "--force", "app"]), {
      cmd: "init",
      dir: "app",
      force: true,
    });
  });

  test("unknown flags and missing --out value are errors", () => {
    assert.deepEqual(parseArgv(["--wat"]), { cmd: "error", message: "unknown flag: --wat" });
    assert.deepEqual(parseArgv(["export", "--out"]), {
      cmd: "error",
      message: "--out needs a directory",
    });
    assert.deepEqual(parseArgv(["check", "--no-open"]), {
      cmd: "error",
      message: "unknown flag: --no-open",
    });
    assert.deepEqual(parseArgv(["a", "b"]), {
      cmd: "error",
      message: "unexpected argument: b",
    });
  });
});

describe("portFromEnv / pickFreePort", () => {
  test("PORT env is an integer or ignored", () => {
    assert.equal(portFromEnv({}), null);
    assert.equal(portFromEnv({ PORT: "" }), null);
    assert.equal(portFromEnv({ PORT: "8787" }), 8787);
    assert.equal(portFromEnv({ PORT: " 9000 " }), 9000);
    assert.equal(portFromEnv({ PORT: "nope" }), null);
    assert.equal(portFromEnv({ PORT: "0" }), null);
  });

  test("pickFreePort skips a bound port", async () => {
    const blocker = createServer();
    await new Promise<void>((resolve, reject) => {
      blocker.listen(0, "127.0.0.1", () => resolve());
      blocker.once("error", reject);
    });
    const addr = blocker.address();
    if (!addr || typeof addr === "string") throw new Error("no address");
    const used = addr.port;
    try {
      const picked = await pickFreePort(used, "127.0.0.1", 20);
      assert.notEqual(picked, used);
      assert.ok(picked > used);
    } finally {
      await new Promise<void>((resolve, reject) => {
        blocker.close((err) => (err ? reject(err) : resolve()));
      });
    }
  });

  test("pickFreePort returns a free start port", async () => {
    const picked = await pickFreePort(49152, "127.0.0.1", 20);
    assert.ok(picked >= 49152);
  });

  test("chooseListenPort starts at PORT and skips a bound one", async () => {
    const blocker = createServer();
    await new Promise<void>((resolve, reject) => {
      blocker.listen(0, "127.0.0.1", () => resolve());
      blocker.once("error", reject);
    });
    const addr = blocker.address();
    if (!addr || typeof addr === "string") throw new Error("no address");
    const used = addr.port;
    try {
      const picked = await chooseListenPort({ PORT: String(used) }, "127.0.0.1");
      assert.notEqual(picked, used);
      assert.ok(picked > used);
    } finally {
      await new Promise<void>((resolve, reject) => {
        blocker.close((err) => (err ? reject(err) : resolve()));
      });
    }
  });
});
