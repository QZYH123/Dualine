import { existsSync, statSync } from "node:fs";
import { extname, join, resolve, sep } from "node:path";

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".map": "application/json",
};

export type StaticResolve =
  | { status: 200; file: string; contentType: string }
  | { status: 404 | 403 | 405 | 400 };

export function contentTypeFor(file: string): string {
  return TYPES[extname(file).toLowerCase()] ?? "application/octet-stream";
}

/** True when a raw URL or path has a `..` segment (including `%2e%2e`). */
export function pathHasDotDot(raw: string): boolean {
  const pathOnly = raw.split(/[?#]/, 1)[0] ?? raw;
  let decoded = pathOnly;
  try {
    decoded = decodeURIComponent(pathOnly);
  } catch {
    return true;
  }
  return decoded.split(/[/\\]/).some((part) => part === "..");
}

function inside(root: string, abs: string): boolean {
  const base = resolve(root);
  const file = resolve(abs);
  return file === base || file.startsWith(base + sep);
}

function existingFile(abs: string): string | null {
  try {
    if (statSync(abs).isFile()) return abs;
  } catch {
    /* missing */
  }
  return null;
}

/**
 * Map a URL path onto a file under `distDir`. Missing paths fall back to
 * `index.html` (SPA). Never returns a path outside `distDir`.
 */
export function resolveStatic(
  method: string,
  pathname: string,
  distDir: string,
): StaticResolve {
  if (method !== "GET" && method !== "HEAD") return { status: 405 };
  if (pathHasDotDot(pathname)) return { status: 404 };

  const root = resolve(distDir);
  const rel = pathname.replace(/^\/+/, "");
  if (rel.includes("\0")) return { status: 404 };

  const candidate = rel === "" ? root : resolve(root, rel);
  if (!inside(root, candidate)) return { status: 404 };

  const file =
    existingFile(candidate) ??
    (existsSync(candidate) && statSync(candidate).isDirectory()
      ? existingFile(join(candidate, "index.html"))
      : null);
  if (file && inside(root, file)) {
    return { status: 200, file, contentType: contentTypeFor(file) };
  }

  const index = join(root, "index.html");
  if (existingFile(index)) {
    return { status: 200, file: index, contentType: contentTypeFor(index) };
  }
  return { status: 404 };
}
