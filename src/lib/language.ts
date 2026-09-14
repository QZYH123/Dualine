/*
 * Path → Shiki language id.
 *
 * Frontmatter `lang` is only a hint for files whose extension we do not
 * recognise. A `.py` file is Python even when the gloss says TypeScript.
 * Unknown / `.env`-like / no extension → null (plain text).
 */

/** Canonical Shiki bundled ids we map extensions onto. */
const EXT_LANG: Record<string, string> = {
  ts: "typescript",
  mts: "typescript",
  cts: "typescript",
  tsx: "tsx",
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  jsx: "jsx",
  json: "json",
  jsonc: "jsonc",
  json5: "json5",
  py: "python",
  go: "go",
  rs: "rust",
  vue: "vue",
  svelte: "svelte",
  astro: "astro",
  css: "css",
  scss: "scss",
  less: "less",
  html: "html",
  htm: "html",
  xml: "xml",
  svg: "xml",
  md: "markdown",
  mdx: "mdx",
  yaml: "yaml",
  yml: "yaml",
  toml: "toml",
  ini: "ini",
  sh: "shellscript",
  bash: "shellscript",
  zsh: "shellscript",
  fish: "fish",
  ps1: "powershell",
  bat: "bat",
  sql: "sql",
  java: "java",
  kt: "kotlin",
  kts: "kotlin",
  swift: "swift",
  c: "c",
  h: "c",
  cpp: "cpp",
  hpp: "cpp",
  cc: "cpp",
  cxx: "cpp",
  cs: "csharp",
  php: "php",
  rb: "ruby",
  dart: "dart",
  lua: "lua",
  zig: "zig",
  ex: "elixir",
  exs: "elixir",
  erl: "erlang",
  hs: "haskell",
  ml: "ocaml",
  scala: "scala",
  r: "r",
  jl: "julia",
  graphql: "graphql",
  gql: "graphql",
  proto: "proto",
  tf: "terraform",
  hcl: "hcl",
  dockerfile: "docker",
  makefile: "make",
  nix: "nix",
  vim: "viml",
  tex: "tex",
};

const BASENAME_LANG: Record<string, string> = {
  dockerfile: "docker",
  makefile: "make",
};

const CANONICAL = new Set<string>([
  ...Object.values(EXT_LANG),
  ...Object.values(BASENAME_LANG),
]);

function fileName(path: string): string {
  const norm = path.replace(/\\/g, "/");
  const i = norm.lastIndexOf("/");
  return i === -1 ? norm : norm.slice(i + 1);
}

function isEnvLike(name: string): boolean {
  return name === ".env" || name.startsWith(".env.");
}

/**
 * Shiki bundled language id for this path, or null for plain text.
 * Extension and basename matching is case-insensitive.
 */
export function languageForPath(path: string): string | null {
  if (!path) return null;
  const name = fileName(path);
  if (!name) return null;
  const lower = name.toLowerCase();
  if (isEnvLike(lower)) return null;
  const byBase = BASENAME_LANG[lower];
  if (byBase) return byBase;
  const dot = lower.lastIndexOf(".");
  if (dot <= 0) return null;
  return EXT_LANG[lower.slice(dot + 1)] ?? null;
}

/** True when the path is explicitly plain (no hint should override). */
function isExplicitlyPlain(path: string): boolean {
  const lower = fileName(path).toLowerCase();
  if (!lower) return true;
  if (isEnvLike(lower)) return true;
  if (BASENAME_LANG[lower]) return false;
  return lower.lastIndexOf(".") <= 0;
}

/** Frontmatter `lang` (or an alias / extension) → canonical Shiki id. */
export function resolveLanguageHint(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const key = raw.trim().toLowerCase();
  if (!key) return null;
  if (CANONICAL.has(key)) return key;
  if (EXT_LANG[key]) return EXT_LANG[key];
  if (BASENAME_LANG[key]) return BASENAME_LANG[key];
  // Any other Shiki-shaped id (e.g. `lang: clojure`) is tried on demand.
  if (/^[a-z][a-z0-9+-]*$/.test(key)) return key;
  return null;
}

/**
 * Language id stored on a project file: path wins; frontmatter hint only
 * applies to an unrecognised extension.
 */
export function resolveFileLanguage(path: string, hint?: string): string {
  const fromPath = languageForPath(path);
  if (fromPath) return fromPath;
  if (isExplicitlyPlain(path)) return "plaintext";
  return resolveLanguageHint(hint) ?? "plaintext";
}
