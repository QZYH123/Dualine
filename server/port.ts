import { createServer } from "node:net";

export function canListen(port: number, host: string): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();
    const finish = (ok: boolean) => {
      server.removeAllListeners();
      resolve(ok);
    };
    server.once("error", () => finish(false));
    server.listen(port, host, () => {
      server.close((err) => finish(!err));
    });
  });
}

/** First free TCP port at or after `start` on `host`. */
export async function pickFreePort(
  start: number,
  host = "127.0.0.1",
  span = 50,
): Promise<number> {
  const end = start + span;
  for (let port = start; port <= end; port++) {
    if (await canListen(port, host)) return port;
  }
  throw new Error(`no free port in ${start}–${end}`);
}

/** `PORT` env wins when it is a TCP port 1–65535; otherwise the caller should pick. */
export function portFromEnv(env: NodeJS.ProcessEnv = process.env): number | null {
  const raw = env.PORT?.trim();
  if (!raw || !/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 65535) return null;
  return n;
}

/** `http://host:port`, with brackets when `host` is bare IPv6. */
export function formatListenUrl(host: string, port: number): string {
  const hostPart = host.includes(":") && !host.startsWith("[") ? `[${host}]` : host;
  return `http://${hostPart}:${port}`;
}

/** Preferred port, then the next free one — `dualine` 被占时接着往后试. */
export async function chooseListenPort(
  env: NodeJS.ProcessEnv = process.env,
  host = "127.0.0.1",
): Promise<number> {
  return pickFreePort(portFromEnv(env) ?? 8787, host);
}
