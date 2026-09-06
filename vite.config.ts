import type { ServerResponse } from "node:http";
import react from "@vitejs/plugin-react";
import { createLogger, defineConfig, type Logger } from "vite";

const viteLogger = createLogger();
let lastProxyWarnAt = 0;
const PROXY_WARN_MS = 5000;

const customLogger: Logger = {
  info: (msg, opts) => viteLogger.info(msg, opts),
  warn: (msg, opts) => viteLogger.warn(msg, opts),
  warnOnce: (msg, opts) => viteLogger.warnOnce(msg, opts),
  error(msg, opts) {
    if (msg.includes("http proxy error")) {
      const now = Date.now();
      if (now - lastProxyWarnAt >= PROXY_WARN_MS) {
        lastProxyWarnAt = now;
        viteLogger.warn(
          "\x1b[2mapi not reachable — the reader falls back to the bundled sample\x1b[0m",
        );
      }
      return;
    }
    viteLogger.error(msg, opts);
  },
  clearScreen: (type) => viteLogger.clearScreen(type),
  hasErrorLogged: (error) => viteLogger.hasErrorLogged(error),
  get hasWarned() {
    return viteLogger.hasWarned;
  },
};

const apiTarget =
  process.env.GLOSS_API || `http://127.0.0.1:${process.env.PORT || 8787}`;

export default defineConfig({
  plugins: [react()],
  customLogger,
  server: {
    port: 5173,
    strictPort: true,
    host: true,
    proxy: {
      "/api": {
        target: apiTarget,
        changeOrigin: true,
        configure(proxy) {
          proxy.on("error", (_err, _req, res) => {
            if (res && "req" in res && !(res as ServerResponse).headersSent) {
              const httpRes = res as ServerResponse;
              httpRes.writeHead(502, { "Content-Type": "application/json" });
              httpRes.end(JSON.stringify({ error: "api unreachable" }));
            }
          });
        },
      },
    },
  },
});
