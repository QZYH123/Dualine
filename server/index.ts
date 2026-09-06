import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { isValidProjectId, listProjects, loadProject } from "./projects.js";

const PORT = Number(process.env.PORT ?? 8787);

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(json),
  });
  res.end(json);
}

function handle(
  method: string,
  pathname: string,
): { status: number; body: unknown } {
  const path = pathname.replace(/\/+$/, "") || "/";

  if (method !== "GET") {
    return { status: 404, body: { error: "not found" } };
  }

  if (path === "/api/health") {
    return { status: 200, body: { ok: true } };
  }

  if (path === "/api/projects") {
    return { status: 200, body: { projects: listProjects() } };
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
    const project = loadProject(id);
    if (!project) return { status: 404, body: { error: "not found" } };
    return { status: 200, body: project };
  }

  return { status: 404, body: { error: "not found" } };
}

const server = createServer((req: IncomingMessage, res: ServerResponse) => {
  const method = req.method ?? "GET";
  let pathname = req.url ?? "/";
  let status = 500;
  try {
    const url = new URL(pathname, "http://127.0.0.1");
    pathname = url.pathname;
    const result = handle(method, pathname);
    status = result.status;
    sendJson(res, result.status, result.body);
  } catch (err) {
    status = 500;
    const error = err instanceof Error ? err.message : "internal error";
    sendJson(res, 500, { error });
  } finally {
    console.log(`${method} ${pathname} ${status}`);
  }
});

server.listen(PORT, () => {
  console.log(`api listening on :${PORT}`);
});
