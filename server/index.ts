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

export interface HandleResult {
  status: number;
  body: unknown;
  headers?: Record<string, string>;
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

export function handle(
  method: string,
  pathname: string,
  root = projectsRoot(),
): HandleResult {
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
    return { status: 200, body: { ok: true, root: abs, rootStatus: status } };
  }

  if (path === "/api/projects") {
    const { root: abs, status } = inspectRoot(root);
    return {
      status: 200,
      body: {
        projects: status === "ok" ? listProjects(abs) : [],
        root: abs,
        rootStatus: status,
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
    const dir = resolveProjectDir(id, root);
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
    const project = loadProject(id, root);
    if (!project) return { status: 404, body: { error: "not found" } };
    return { status: 200, body: project };
  }

  return { status: 404, body: { error: "not found" } };
}

export function createApiServer(): Server {
  return createServer((req: IncomingMessage, res: ServerResponse) => {
    const method = req.method ?? "GET";
    let pathname = req.url ?? "/";
    let status = 500;
    try {
      const url = new URL(pathname, "http://127.0.0.1");
      pathname = url.pathname;
      const result = handle(method, pathname, projectsRoot());
      status = result.status;
      sendJson(res, result.status, result.body, result.headers);
    } catch (err) {
      status = 500;
      const error = err instanceof Error ? err.message : "internal error";
      sendJson(res, 500, { error });
    } finally {
      console.log(`${method} ${pathname} ${status}`);
    }
  });
}

function listenAsMain(server: Server): void {
  const port = Number(process.env.PORT ?? 8787);
  const host = process.env.HOST ?? "127.0.0.1";

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
    console.log(`api listening on http://${host}:${port}  (projects: ${projectsRoot()})`);
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
