import { readFileSync } from "node:fs";
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  inspectRoot,
  isValidProjectId,
  listProjects,
  loadProject,
  projectStamp,
  projectsRoot,
  resolveProjectDir,
} from "./projects.js";
import { pathHasDotDot, resolveStatic, type StaticResolve } from "./static.js";
import { serveScope } from "./validate.js";

export interface HandleResult {
  status: number;
  body: unknown;
  headers?: Record<string, string>;
}

export interface HandleOptions {
  single?: boolean;
}

export interface ApiServerOptions {
  root?: string;
  single?: boolean;
  distDir?: string | null;
}

function sendJson(
  res: ServerResponse,
  status: number,
  body: unknown,
  extraHeaders?: Record<string, string>,
): void {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(json),
    ...extraHeaders,
  });
  res.end(json);
}

export function isApiPath(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, "") || "/";
  return path === "/api" || path.startsWith("/api/");
}

export function handle(
  method: string,
  pathname: string,
  root = projectsRoot(),
  opts?: HandleOptions,
): HandleResult {
  const single = opts?.single === true;
  const path = pathname.replace(/\/+$/, "") || "/";

  if (method !== "GET") {
    return {
      status: 405,
      body: { error: "method not allowed" },
      headers: { Allow: "GET" },
    };
  }

  if (path === "/api/health") {
    const { root: abs, status } = inspectRoot(root);
    return {
      status: 200,
      body: { ok: true, root: abs, rootStatus: status, single },
    };
  }

  if (path === "/api/projects") {
    const { root: abs, status } = inspectRoot(root);
    return {
      status: 200,
      body: {
        projects: status === "ok" ? listProjects(abs, { single }) : [],
        root: abs,
        rootStatus: status,
        single,
      },
    };
  }

  const revMatch = /^\/api\/projects\/([^/]+)\/rev$/.exec(path);
  if (revMatch) {
    let id: string;
    try {
      id = decodeURIComponent(revMatch[1]);
    } catch {
      return { status: 400, body: { error: "invalid id" } };
    }
    if (!isValidProjectId(id)) {
      return { status: 400, body: { error: "invalid id" } };
    }
    const dir = resolveProjectDir(id, root, { single });
    if (!dir) return { status: 404, body: { error: "not found" } };
    return { status: 200, body: { rev: projectStamp(dir) } };
  }

  const projectMatch = /^\/api\/projects\/([^/]+)$/.exec(path);
  if (projectMatch) {
    let id: string;
    try {
      id = decodeURIComponent(projectMatch[1]);
    } catch {
      return { status: 400, body: { error: "invalid id" } };
    }
    if (!isValidProjectId(id)) {
      return { status: 400, body: { error: "invalid id" } };
    }
    const project = loadProject(id, root, { single });
    if (!project) return { status: 404, body: { error: "not found" } };
    return { status: 200, body: project };
  }

  return { status: 404, body: { error: "not found" } };
}

function sendStatic(res: ServerResponse, result: StaticResolve): number {
  if (result.status !== 200) {
    const headers: Record<string, string> = {
      "Content-Type": "text/plain; charset=utf-8",
    };
    if (result.status === 405) headers.Allow = "GET";
    const body = result.status === 405 ? "method not allowed" : "not found";
    res.writeHead(result.status, {
      ...headers,
      "Content-Length": Buffer.byteLength(body),
    });
    res.end(body);
    return result.status;
  }
  const buf = readFileSync(result.file);
  res.writeHead(200, {
    "Content-Type": result.contentType,
    "Content-Length": buf.length,
  });
  res.end(buf);
  return 200;
}

export function createApiServer(opts: ApiServerOptions = {}): Server {
  const fallback = serveScope();
  const root = opts.root ?? fallback.root;
  const single = opts.single ?? fallback.single;
  const distDir = opts.distDir === undefined ? fallback.distDir : opts.distDir;

  return createServer((req: IncomingMessage, res: ServerResponse) => {
    const method = req.method ?? "GET";
    const rawUrl = req.url ?? "/";
    let pathname = rawUrl;
    let status = 500;
    try {
      const url = new URL(rawUrl, "http://127.0.0.1");
      pathname = url.pathname;
      if (isApiPath(pathname)) {
        const result = handle(method, pathname, root, { single });
        status = result.status;
        sendJson(res, result.status, result.body, result.headers);
      } else if (distDir) {
        if (pathHasDotDot(rawUrl)) {
          status = sendStatic(res, { status: 404 });
        } else {
          status = sendStatic(res, resolveStatic(method, pathname, distDir));
        }
      } else {
        const result = handle(method, pathname, root, { single });
        status = result.status;
        sendJson(res, result.status, result.body, result.headers);
      }
    } catch (err) {
      status = 500;
      const error = err instanceof Error ? err.message : "internal error";
      sendJson(res, 500, { error });
    } finally {
      console.log(`${method} ${pathname} ${status}`);
    }
  });
}

export function listenHttp(
  server: Server,
  port: number,
  host: string,
): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const onError = (err: NodeJS.ErrnoException) => {
      server.off("error", onError);
      reject(err);
    };
    server.once("error", onError);
    server.listen(port, host, () => {
      server.off("error", onError);
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        reject(new Error("no listen address"));
        return;
      }
      resolvePort(addr.port);
    });
  });
}

function listenAsMain(server: Server): void {
  const port = Number(process.env.PORT ?? 8787);
  const host = process.env.HOST ?? "127.0.0.1";
  const scope = serveScope();

  server.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      console.error(
        `api: port ${port} is in use — stop the other process or run with PORT=<n>`,
      );
      process.exit(1);
    }
    console.error(err.message);
    process.exit(1);
  });

  server.listen(port, host, () => {
    const kind = scope.single ? "project" : "projects";
    const extra = scope.distDir ? `  dist: ${scope.distDir}` : "";
    console.log(
      `api listening on http://${host}:${port}  (${kind}: ${scope.root})${extra}`,
    );
  });

  let closing = false;
  const shutdown = () => {
    if (closing) return;
    closing = true;
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 1000).unref();
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

const entry = process.argv[1];
if (entry && resolve(entry) === fileURLToPath(import.meta.url)) {
  listenAsMain(createApiServer());
}
