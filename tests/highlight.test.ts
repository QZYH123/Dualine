import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { ensureLanguage, getHighlighter, tokenize } from "../src/lib/highlight.js";
import { languageForPath, resolveFileLanguage } from "../src/lib/language.js";

const EXT_CASES: [string, string][] = [
  ["a.ts", "typescript"],
  ["a.tsx", "tsx"],
  ["a.mts", "typescript"],
  ["a.cts", "typescript"],
  ["a.js", "javascript"],
  ["a.jsx", "jsx"],
  ["a.mjs", "javascript"],
  ["a.cjs", "javascript"],
  ["a.json", "json"],
  ["a.jsonc", "jsonc"],
  ["a.json5", "json5"],
  ["a.py", "python"],
  ["a.go", "go"],
  ["a.rs", "rust"],
  ["a.vue", "vue"],
  ["a.svelte", "svelte"],
  ["a.astro", "astro"],
  ["a.css", "css"],
  ["a.scss", "scss"],
  ["a.less", "less"],
  ["a.html", "html"],
  ["a.htm", "html"],
  ["a.xml", "xml"],
  ["a.svg", "xml"],
  ["a.md", "markdown"],
  ["a.mdx", "mdx"],
  ["a.yaml", "yaml"],
  ["a.yml", "yaml"],
  ["a.toml", "toml"],
  ["a.ini", "ini"],
  ["a.sh", "shellscript"],
  ["a.bash", "shellscript"],
  ["a.zsh", "shellscript"],
  ["a.fish", "fish"],
  ["a.ps1", "powershell"],
  ["a.bat", "bat"],
  ["a.sql", "sql"],
  ["a.java", "java"],
  ["a.kt", "kotlin"],
  ["a.kts", "kotlin"],
  ["a.swift", "swift"],
  ["a.c", "c"],
  ["a.h", "c"],
  ["a.cpp", "cpp"],
  ["a.hpp", "cpp"],
  ["a.cc", "cpp"],
  ["a.cxx", "cpp"],
  ["a.cs", "csharp"],
  ["a.php", "php"],
  ["a.rb", "ruby"],
  ["a.dart", "dart"],
  ["a.lua", "lua"],
  ["a.zig", "zig"],
  ["a.ex", "elixir"],
  ["a.exs", "elixir"],
  ["a.erl", "erlang"],
  ["a.hs", "haskell"],
  ["a.ml", "ocaml"],
  ["a.scala", "scala"],
  ["a.r", "r"],
  ["a.jl", "julia"],
  ["a.graphql", "graphql"],
  ["a.gql", "graphql"],
  ["a.proto", "proto"],
  ["a.tf", "terraform"],
  ["a.hcl", "hcl"],
  ["a.dockerfile", "docker"],
  ["a.makefile", "make"],
  ["a.nix", "nix"],
  ["a.vim", "viml"],
  ["a.tex", "tex"],
];

describe("languageForPath", () => {
  test("maps the listed extensions to Shiki bundled ids", () => {
    for (const [path, lang] of EXT_CASES) {
      assert.equal(languageForPath(path), lang, path);
    }
  });

  test("uppercase extensions and nested paths", () => {
    assert.equal(languageForPath("src/App.TSX"), "tsx");
    assert.equal(languageForPath("SRC/HELLO.PY"), "python");
    assert.equal(languageForPath("lib\\main.GO"), "go");
  });

  test("Dockerfile / Makefile basenames", () => {
    assert.equal(languageForPath("Dockerfile"), "docker");
    assert.equal(languageForPath("docker/Dockerfile"), "docker");
    assert.equal(languageForPath("MAKEFILE"), "make");
    assert.equal(languageForPath("src/Makefile"), "make");
  });

  test("dotfiles, env-like, and no extension are plain", () => {
    assert.equal(languageForPath(".env"), null);
    assert.equal(languageForPath(".env.local"), null);
    assert.equal(languageForPath("config/.env.production"), null);
    assert.equal(languageForPath(".gitignore"), null);
    assert.equal(languageForPath("LICENSE"), null);
    assert.equal(languageForPath("src/unknown"), null);
    assert.equal(languageForPath(""), null);
  });

  test("unknown extension is null (hint applied elsewhere)", () => {
    assert.equal(languageForPath("notes.unknown"), null);
    assert.equal(languageForPath("a.foo"), null);
  });
});

describe("resolveFileLanguage (frontmatter is a hint)", () => {
  test("path wins over a TypeScript frontmatter hint", () => {
    assert.equal(resolveFileLanguage("app.py", "typescript"), "python");
    assert.equal(resolveFileLanguage("main.go", "typescript"), "go");
  });

  test("unknown extension uses the hint; env / no extension stay plain", () => {
    assert.equal(resolveFileLanguage("c.unknown", "python"), "python");
    assert.equal(resolveFileLanguage("c.unknown", "typescript"), "typescript");
    assert.equal(resolveFileLanguage(".env", "typescript"), "plaintext");
    assert.equal(resolveFileLanguage("LICENSE", "typescript"), "plaintext");
  });
});

describe("tokenize / ensureLanguage", () => {
  test("plain until the grammar loads, then tokens, same line count", async () => {
    const hl = await getHighlighter();
    const code = "def greet(name):\n    return 1\n";
    const before = tokenize(hl, code, "python");
    assert.equal(before.length, 3);
    assert.ok(before[0]?.every((t) => t.cls === "fg"));
    assert.equal(await ensureLanguage("python"), true);
    const after = tokenize(hl, code, "python");
    assert.equal(after.length, before.length);
    assert.ok(
      after.flat().some((t) => t.cls !== "fg"),
      "python should produce non-plain token classes",
    );
  });

  test("typescript tokens still map to CSS classes, not a theme", async () => {
    const hl = await getHighlighter();
    await ensureLanguage("typescript");
    const lines = tokenize(hl, 'const n: number = 1; // hi\n', "typescript");
    const classes = new Set(lines.flat().map((t) => t.cls));
    assert.ok(classes.has("keyword") || classes.has("type") || classes.has("number"));
    assert.ok(!classes.has("fg") || classes.size > 1);
  });
});
