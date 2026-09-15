import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { after, describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { runCheck } from "../scripts/check-gloss.js";
import {
  InitError,
  anchorSpan,
  detectProject,
  majorityLang,
  pickEntry,
  renderStarter,
  runInit,
  skillSourcePath,
} from "../server/init.js";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const tmp = mkdtempSync(join(tmpdir(), "gloss-init-"));

after(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe("pickEntry", () => {
  test("prefers the documented entry order, then sorted walk", () => {
    const all = [
      "lib/util.ts",
      "cmd/foo/main.go",
      "app.py",
      "index.ts",
      "main.go",
      "src/app.ts",
      "src/main.ts",
      "src/index.ts",
      "z.py",
    ];
    assert.equal(pickEntry(all), "src/index.ts");
    assert.equal(
      pickEntry(all.filter((f) => f !== "src/index.ts")),
      "src/main.ts",
    );
    assert.equal(
      pickEntry(all.filter((f) => !f.startsWith("src/index") && !f.startsWith("src/main"))),
      "src/app.ts",
    );
    assert.equal(pickEntry(["lib/util.ts", "cmd/foo/main.go", "app.py", "index.ts", "main.go", "z.py"]), "main.go");
    assert.equal(pickEntry(["lib/util.ts", "cmd/foo/main.go", "app.py", "index.ts", "z.py"]), "index.ts");
    assert.equal(pickEntry(["lib/util.ts", "cmd/foo/main.go", "app.py", "z.py"]), "app.py");
    assert.equal(pickEntry(["lib/util.ts", "cmd/foo/main.go", "z.py"]), "cmd/foo/main.go");
    assert.equal(pickEntry(["lib/util.ts", "z.py"]), "lib/util.ts");
    assert.equal(pickEntry(["z.py", "a.py"]), "a.py");
    assert.equal(pickEntry(["src/index.test.ts", "src/index.ts"]), "src/index.ts");
    assert.equal(pickEntry(["README.md", "app/main.py"]), "app/main.py");
    assert.equal(pickEntry(["README.md", "notes.md"]), null);
  });

  test("prefers cli.py over __init__.py; a lone package __init__.py still wins", () => {
    assert.equal(pickEntry(["app/__init__.py", "app/cli.py"]), "app/cli.py");
    assert.equal(pickEntry(["pkg/__init__.py"]), "pkg/__init__.py");
  });

  test("explicit src/index still wins over src/server when the index is a thin barrel", () => {
    assert.equal(
      pickEntry(["src/index.ts", "src/server.ts"], {
        nonBlankLines: { "src/index.ts": 2, "src/server.ts": 8 },
      }),
      "src/index.ts",
    );
  });
});

describe("majorityLang", () => {
  test("picks the most common source language; markdown does not count", () => {
    assert.equal(majorityLang(["a.py", "b.py", "c.ts"]), "python");
    assert.equal(majorityLang(["a.ts", "b.ts", "c.js", "d.js", "e.js"]), "javascript");
    assert.equal(majorityLang(["app/main.py", "README.md", "docs/x.md"]), "python");
    assert.equal(majorityLang(["README.md", "gloss.md"]), null);
    assert.equal(majorityLang([]), null);
  });
});

describe("anchorSpan / renderStarter", () => {
  test("1-line file is #L1; longer files cap at L20", () => {
    assert.equal(anchorSpan(1), "#L1");
    assert.equal(anchorSpan(5), "#L1-L5");
    assert.equal(anchorSpan(20), "#L1-L20");
    assert.equal(anchorSpan(30), "#L1-L20");
  });

  test("renders the starter with lang and a real anchor", () => {
    const got = renderStarter({
      slug: "some-py-project",
      lang: "python",
      entry: "app/main.py",
      lines: 30,
    });
    assert.equal(
      got,
      `---
name: some-py-project
tagline: 一句话说它是什么
lang: python
---

# some-py-project 是怎么工作的

两三句导语：读完这篇，你会摸清什么。导语不带锚点，不驱动代码栏。

## 它做什么

从入口讲起。[程序从这里开始](app/main.py#L1-L20)。把这句话换成真正的解释：每个要紧的说法都指向几行代码，没有锚点的段落继承上一段的代码。
`,
    );
    assert.doesNotMatch(got, /\r/);
  });

  test("1-line entry uses #L1", () => {
    const got = renderStarter({
      slug: "one",
      lang: "python",
      entry: "main.py",
      lines: 1,
    });
    assert.match(got, /\[程序从这里开始\]\(main\.py#L1\)/);
    assert.doesNotMatch(got, /#L1-L1/);
  });

  test("no-source variant omits lang and the anchor sentence", () => {
    const got = renderStarter({
      slug: "empty-app",
      lang: null,
      entry: null,
      lines: 0,
    });
    assert.equal(
      got,
      `---
name: empty-app
tagline: 一句话说它是什么
---

# empty-app 是怎么工作的

两三句导语：读完这篇，你会摸清什么。导语不带锚点，不驱动代码栏。

## 它做什么

从入口讲起。这个文件夹里没找到源文件，先把第一枚锚点指向真实行号。
`,
    );
    assert.doesNotMatch(got, /^lang:/m);
  });
});

describe("detectProject", () => {
  test("slug from folder; skips junk dirs; src/index wins", () => {
    const dir = join(tmp, "My App");
    mkdirSync(join(dir, "src"), { recursive: true });
    mkdirSync(join(dir, "node_modules", "dep"), { recursive: true });
    mkdirSync(join(dir, "dist"), { recursive: true });
    mkdirSync(join(dir, "build"), { recursive: true });
    mkdirSync(join(dir, "export", "assets"), { recursive: true });
    mkdirSync(join(dir, "vendor"), { recursive: true });
    mkdirSync(join(dir, "__pycache__"), { recursive: true });
    mkdirSync(join(dir, ".hidden"), { recursive: true });
    writeFileSync(join(dir, "src/index.ts"), "export const a = 1;\n");
    writeFileSync(join(dir, "src/main.ts"), "export const b = 1;\n");
    writeFileSync(join(dir, "README.md"), "# hi\n");
    writeFileSync(join(dir, "node_modules/dep/index.js"), "module.exports = 1;\n");
    writeFileSync(join(dir, "dist/out.js"), "console.log(1);\n");
    writeFileSync(join(dir, "build/out.js"), "console.log(1);\n");
    writeFileSync(join(dir, "export/assets/app.js"), "console.log(1);\n");
    writeFileSync(join(dir, "vendor/lib.js"), "module.exports = 1;\n");
    writeFileSync(join(dir, "__pycache__/x.py"), "x = 1\n");
    writeFileSync(join(dir, ".hidden/x.py"), "x = 1\n");
    const got = detectProject(dir);
    assert.equal(got.slug, "my-app");
    assert.equal(got.lang, "typescript");
    assert.equal(got.entry, "src/index.ts");
    assert.equal(got.lines, 1);
  });

  test("Python app package faces cli.py, not __init__.py", () => {
    const dir = join(tmp, "py-cli-app");
    mkdirSync(join(dir, "app"), { recursive: true });
    writeFileSync(join(dir, "app/__init__.py"), '"""app package."""\n');
    writeFileSync(join(dir, "app/cli.py"), "def main():\n    print('hi')\n");
    const got = detectProject(dir);
    assert.equal(got.entry, "app/cli.py");
  });

  test("lone package __init__.py is still the entry", () => {
    const dir = join(tmp, "py-pkg-only");
    mkdirSync(join(dir, "pkg"), { recursive: true });
    writeFileSync(join(dir, "pkg/__init__.py"), '"""pkg."""\n');
    const got = detectProject(dir);
    assert.equal(got.entry, "pkg/__init__.py");
  });

  test("explicit src/index.ts wins over src/server.ts even as a 2-line barrel", () => {
    const dir = join(tmp, "ts-barrel");
    mkdirSync(join(dir, "src"), { recursive: true });
    writeFileSync(join(dir, "src/index.ts"), 'export * from "./server";\nexport * from "./util";\n');
    writeFileSync(
      join(dir, "src/server.ts"),
      "export function listen() {\n  return 8787;\n}\n",
    );
    const got = detectProject(dir);
    assert.equal(got.entry, "src/index.ts");
  });

  test("skips a frozen export/ tree when picking the entry and language", () => {
    const dir = join(tmp, "py-after-export");
    mkdirSync(join(dir, "lib"), { recursive: true });
    mkdirSync(join(dir, "export", "lib-py", "assets"), { recursive: true });
    writeFileSync(join(dir, "lib/util.py"), "def greet():\n    return 1\n");
    writeFileSync(join(dir, "export/lib-py/index.html"), "<html></html>\n");
    writeFileSync(
      join(dir, "export/lib-py/assets/app.js"),
      "console.log(1);\nconsole.log(2);\nconsole.log(3);\n",
    );
    const got = detectProject(dir);
    assert.equal(got.entry, "lib/util.py");
    assert.equal(got.lang, "python");
  });
});

describe("runInit e2e", () => {
  test("python project: template, skill, refuse, --force, then check", () => {
    const dir = join(tmp, "some-py-project");
    mkdirSync(join(dir, "app"), { recursive: true });
    const py = Array.from({ length: 30 }, (_, i) => `print(${i + 1})`).join("\n") + "\n";
    writeFileSync(join(dir, "app/main.py"), py);
    writeFileSync(join(dir, "README.md"), "# some-py-project\n");

    const first = runInit(dir);
    assert.equal(first.skillStatus, "installed");
    const gloss = readFileSync(first.glossPath, "utf8");
    assert.equal(
      gloss,
      renderStarter({
        slug: "some-py-project",
        lang: "python",
        entry: "app/main.py",
        lines: 30,
      }),
    );
    assert.match(gloss, /lang: python/);
    assert.match(gloss, /app\/main\.py#L1-L20/);
    assert.doesNotMatch(gloss, /\r/);

    const skillDest = join(dir, ".cursor/skills/write-gloss/SKILL.md");
    assert.equal(readFileSync(skillDest, "utf8"), readFileSync(skillSourcePath(REPO), "utf8"));

    assert.throws(() => runInit(dir), (err: unknown) => {
      assert.ok(err instanceof InitError);
      assert.match(err.message, /gloss\.md 已存在，加 --force 覆写/);
      assert.match(err.message, /already exists/);
      assert.equal(err.exitCode, 1);
      return true;
    });

    writeFileSync(join(dir, "gloss.md"), "# stale\n");
    writeFileSync(skillDest, "stale skill\n");
    const again = runInit(dir, { force: true });
    assert.equal(again.skillStatus, "installed");
    assert.equal(
      readFileSync(again.glossPath, "utf8"),
      renderStarter({
        slug: "some-py-project",
        lang: "python",
        entry: "app/main.py",
        lines: 30,
      }),
    );
    assert.equal(readFileSync(skillDest, "utf8"), readFileSync(skillSourcePath(REPO), "utf8"));

    assert.equal(runCheck([dir]), 0);
    assert.ok(existsSync(join(dir, "gloss.lock")));
  });

  test("refuses when gloss.md is a directory, even with --force", () => {
    const dir = join(tmp, "gloss-dir");
    mkdirSync(dir, { recursive: true });
    mkdirSync(join(dir, "gloss.md"));
    writeFileSync(join(dir, "main.py"), "print(1)\n");
    assert.throws(() => runInit(dir), (err: unknown) => {
      assert.ok(err instanceof InitError);
      assert.match(err.message, /gloss\.md 是一个目录/);
      return true;
    });
    assert.throws(() => runInit(dir, { force: true }), (err: unknown) => {
      assert.ok(err instanceof InitError);
      assert.match(err.message, /is a directory/);
      return true;
    });
  });

  test("package.json files lists the write-gloss skill", () => {
    const pkg = JSON.parse(readFileSync(join(REPO, "package.json"), "utf8")) as {
      files: string[];
    };
    assert.ok(pkg.files.includes(".cursor/skills/write-gloss"));
  });
});
