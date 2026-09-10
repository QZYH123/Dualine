/*
 * Syntax highlighting, editorial style.
 *
 * Shiki does the tokenising; we do the colouring. The theme below uses
 * sentinel hex values that map to CSS classes, so the real colours live
 * in tokens.css alongside the rest of the palette.
 */
import { createHighlighterCore, type HighlighterCore, type ThemeRegistrationRaw } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import typescript from "@shikijs/langs/typescript";
import javascript from "@shikijs/langs/javascript";
import json from "@shikijs/langs/json";

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

let highlighterPromise: Promise<HighlighterCore> | null = null;

export function getHighlighter(): Promise<HighlighterCore> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighterCore({
      themes: [paperTheme],
      langs: [typescript, javascript, json],
      engine: createJavaScriptRegexEngine(),
    });
  }
  return highlighterPromise;
}

export interface Token {
  text: string;
  cls: TokenClass;
  italic: boolean;
}

export type TokenLine = Token[];

export function tokenize(hl: HighlighterCore, code: string, lang: string): TokenLine[] {
  const loaded = hl.getLoadedLanguages();
  const useLang = loaded.includes(lang) ? lang : "typescript";
  const lines = hl.codeToTokensBase(code, { lang: useLang, theme: "gloss-paper" });
  return lines.map((line) =>
    line.map((t) => ({
      text: t.content,
      cls: CLASS_BY_COLOR[(t.color ?? "").toUpperCase()] ?? "fg",
      italic: (t.fontStyle ?? 0) % 2 === 1,
    })),
  );
}
