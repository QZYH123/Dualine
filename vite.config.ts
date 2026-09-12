import { readFileSync } from "node:fs";
import type { ServerResponse } from "node:http";
import react from "@vitejs/plugin-react";
import { createLogger, defineConfig, type Logger, type Plugin } from "vite";

const exportPayloadPath = process.env.GLOSS_EXPORT_PAYLOAD;
const exportOutDir = process.env.GLOSS_EXPORT_OUT;

function exportPayloadPlugin(payloadPath: string): Plugin {
  return {
    name: "gloss-export-payload",
    transformIndexHtml(html) {
      const json = readFileSync(payloadPath, "utf8").replace(/</g, "\\u003c");
      const tag = `<script>window.__GLOSS_EXPORT__=${json}</script>`;
      return html.replace('<div id="root"></div>', `${tag}\n    <div id="root"></div>`);
    },
  };
}

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

const apiProxy = {
  "/api": {
    target: apiTarget,
    changeOrigin: true,
    configure(
      proxy: { on: (event: "error", fn: (...args: unknown[]) => void) => void },
    ) {
      proxy.on("error", (_err: unknown, _req: unknown, res: unknown) => {
        if (res && typeof res === "object" && "req" in res && !(res as ServerResponse).headersSent) {
          const httpRes = res as ServerResponse;
          httpRes.writeHead(502, { "Content-Type": "application/json" });
          httpRes.end(JSON.stringify({ error: "api unreachable" }));
        }
      });
    },
  },
};

export default defineConfig({
  base: exportOutDir ? "./" : "/",
  plugins: [react(), exportPayloadPath ? exportPayloadPlugin(exportPayloadPath) : null].filter(
    (p): p is Plugin => p !== null,
  ),
  customLogger,
  build: exportOutDir ? { outDir: exportOutDir, emptyOutDir: true } : undefined,
  server: {
    port: 5173,
    strictPort: true,
    host: true,
    proxy: apiProxy,
  },
  preview: {
    port: 4173,
    host: true,
    proxy: apiProxy,
  },
});
