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

/** `PORT` env wins when it is a positive integer; otherwise the caller should pick. */
export function portFromEnv(env: NodeJS.ProcessEnv = process.env): number | null {
  const raw = env.PORT?.trim();
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}
