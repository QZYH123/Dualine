/*
 * Syntax highlighting, editorial style.
 *
 * Shiki tokenises; we colour. The theme uses sentinel hex values that map
 * to CSS classes, so the real colours live in tokens.css. Grammars load
 * on demand — one Vite chunk per language — so the main bundle stays lean.
 */
import { createHighlighterCore, type HighlighterCore, type ThemeRegistrationRaw } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import type { LanguageRegistration } from "@shikijs/types";
import { languageForPath } from "./language.js";

export { languageForPath };

const SENTINEL = {
  fg: "#000001",
  comment: "#000002",
  keyword: "#000003",
  string: "#000004",
  number: "#000005",
  type: "#000006",
  function: "#000007",
  punct: "#000008",
} as const;

export type TokenClass = keyof typeof SENTINEL;

const CLASS_BY_COLOR: Record<string, TokenClass> = Object.fromEntries(
  Object.entries(SENTINEL).map(([k, v]) => [v.toUpperCase(), k as TokenClass]),
);

const paperTheme: ThemeRegistrationRaw = {
  name: "gloss-paper",
  type: "light",
  colors: { "editor.foreground": SENTINEL.fg, "editor.background": "#FFFFFF" },
  settings: [
    { settings: { foreground: SENTINEL.fg } },
    {
      scope: ["comment", "punctuation.definition.comment"],
      settings: { foreground: SENTINEL.comment, fontStyle: "italic" },
    },
    {
      scope: [
        "keyword",
        "storage.type",
        "storage.modifier",
        "keyword.control",
        "keyword.operator.new",
        "keyword.operator.expression",
        "variable.language.this",
        "support.type.primitive",
        "constant.language",
      ],
      settings: { foreground: SENTINEL.keyword },
    },
    {
      scope: ["string", "string.template", "punctuation.definition.string", "string.regexp"],
      settings: { foreground: SENTINEL.string },
    },
    {
      scope: ["constant.numeric"],
      settings: { foreground: SENTINEL.number },
    },
    {
      scope: [
        "entity.name.type",
        "entity.name.class",
        "entity.other.inherited-class",
        "support.class",
        "support.type",
        "entity.name.type.interface",
        "entity.name.type.alias",
      ],
      settings: { foreground: SENTINEL.type },
    },
    {
      scope: ["entity.name.function", "support.function", "meta.function-call entity.name.function"],
      settings: { foreground: SENTINEL.function },
    },
    {
      scope: [
        "keyword.operator",
        "punctuation",
        "meta.brace",
        "punctuation.definition.template-expression",
        "punctuation.separator",
        "punctuation.terminator",
        "punctuation.accessor",
        "punctuation.definition.parameters",
        "punctuation.definition.block",
        "meta.arrow storage.type.function.arrow",
        "storage.type.function.arrow",
      ],
      settings: { foreground: SENTINEL.punct },
    },
  ],
};

type LangModule = { default: LanguageRegistration[] };

/** Static `import()` so Vite emits one async chunk per grammar. */
const LANG_LOADERS: Record<string, () => Promise<LangModule>> = {
  typescript: () => import("@shikijs/langs/typescript"),
  tsx: () => import("@shikijs/langs/tsx"),
  javascript: () => import("@shikijs/langs/javascript"),
  jsx: () => import("@shikijs/langs/jsx"),
  json: () => import("@shikijs/langs/json"),
  jsonc: () => import("@shikijs/langs/jsonc"),
  json5: () => import("@shikijs/langs/json5"),
  python: () => import("@shikijs/langs/python"),
  go: () => import("@shikijs/langs/go"),
  rust: () => import("@shikijs/langs/rust"),
  vue: () => import("@shikijs/langs/vue"),
  svelte: () => import("@shikijs/langs/svelte"),
  astro: () => import("@shikijs/langs/astro"),
  css: () => import("@shikijs/langs/css"),
  scss: () => import("@shikijs/langs/scss"),
  less: () => import("@shikijs/langs/less"),
  html: () => import("@shikijs/langs/html"),
  xml: () => import("@shikijs/langs/xml"),
  markdown: () => import("@shikijs/langs/markdown"),
  mdx: () => import("@shikijs/langs/mdx"),
  yaml: () => import("@shikijs/langs/yaml"),
  toml: () => import("@shikijs/langs/toml"),
  ini: () => import("@shikijs/langs/ini"),
  shellscript: () => import("@shikijs/langs/shellscript"),
  fish: () => import("@shikijs/langs/fish"),
  powershell: () => import("@shikijs/langs/powershell"),
  bat: () => import("@shikijs/langs/bat"),
  sql: () => import("@shikijs/langs/sql"),
  java: () => import("@shikijs/langs/java"),
  kotlin: () => import("@shikijs/langs/kotlin"),
  swift: () => import("@shikijs/langs/swift"),
  c: () => import("@shikijs/langs/c"),
  cpp: () => import("@shikijs/langs/cpp"),
  csharp: () => import("@shikijs/langs/csharp"),
  php: () => import("@shikijs/langs/php"),
  ruby: () => import("@shikijs/langs/ruby"),
  dart: () => import("@shikijs/langs/dart"),
  lua: () => import("@shikijs/langs/lua"),
  zig: () => import("@shikijs/langs/zig"),
  elixir: () => import("@shikijs/langs/elixir"),
  erlang: () => import("@shikijs/langs/erlang"),
  haskell: () => import("@shikijs/langs/haskell"),
  ocaml: () => import("@shikijs/langs/ocaml"),
  scala: () => import("@shikijs/langs/scala"),
  r: () => import("@shikijs/langs/r"),
  julia: () => import("@shikijs/langs/julia"),
  graphql: () => import("@shikijs/langs/graphql"),
  proto: () => import("@shikijs/langs/proto"),
  terraform: () => import("@shikijs/langs/terraform"),
  hcl: () => import("@shikijs/langs/hcl"),
  docker: () => import("@shikijs/langs/docker"),
  make: () => import("@shikijs/langs/make"),
  nix: () => import("@shikijs/langs/nix"),
  viml: () => import("@shikijs/langs/viml"),
  tex: () => import("@shikijs/langs/tex"),
};

const PLAIN_LANGS = new Set(["", "plaintext", "text", "txt", "plain"]);

let highlighterPromise: Promise<HighlighterCore> | null = null;
const languageLoads = new Map<string, Promise<boolean>>();

export function getHighlighter(): Promise<HighlighterCore> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighterCore({
      themes: [paperTheme],
      langs: [],
      engine: createJavaScriptRegexEngine(),
    });
  }
  return highlighterPromise;
}

function languageReady(hl: HighlighterCore, lang: string): boolean {
  return hl.getLoadedLanguages().includes(lang);
}

async function importGrammar(lang: string): Promise<LanguageRegistration[] | null> {
  const known = LANG_LOADERS[lang];
  if (!known) return null;
  const mod = await known();
  return mod.default;
}

/**
 * Load a grammar if we know it. Resolves true when the highlighter can
 * tokenise `lang`. Safe to call repeatedly; concurrent callers share work.
 */
export function ensureLanguage(lang: string): Promise<boolean> {
  if (PLAIN_LANGS.has(lang)) return Promise.resolve(false);
  const pending = languageLoads.get(lang);
  if (pending) return pending;
  const work = (async () => {
    const hl = await getHighlighter();
    if (languageReady(hl, lang)) return true;
    try {
      const grammar = await importGrammar(lang);
      if (!grammar) return false;
      await hl.loadLanguage(grammar);
      return languageReady(hl, lang);
    } catch {
      return false;
    }
  })();
  languageLoads.set(lang, work);
  return work;
}

export interface Token {
  text: string;
  cls: TokenClass;
  italic: boolean;
}

export type TokenLine = Token[];

export function tokenizePlain(code: string): TokenLine[] {
  return code.split("\n").map((line) => (line ? [{ text: line, cls: "fg", italic: false }] : []));
}

export function tokenize(hl: HighlighterCore, code: string, lang: string): TokenLine[] {
  if (PLAIN_LANGS.has(lang) || !languageReady(hl, lang)) return tokenizePlain(code);
  try {
    const lines = hl.codeToTokensBase(code, { lang, theme: "gloss-paper" });
    return lines.map((line) =>
      line.map((t) => ({
        text: t.content,
        cls: CLASS_BY_COLOR[(t.color ?? "").toUpperCase()] ?? "fg",
        italic: (t.fontStyle ?? 0) % 2 === 1,
      })),
    );
  } catch {
    return tokenizePlain(code);
  }
}
