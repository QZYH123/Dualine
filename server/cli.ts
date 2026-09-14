import { existsSync, readFileSync, statSync } from "node:fs";
import { spawn } from "node:child_process";
import { join } from "node:path";
import { runCheck } from "../scripts/check-gloss.js";
import { exportProject } from "../scripts/export-gloss.js";
import { parseArgv, type CliArgs } from "./args.js";
import { createApiServer, listenHttp } from "./index.js";
import { pickFreePort, portFromEnv } from "./port.js";
import { packageRoot } from "./root.js";
import { resolveProjectsDir } from "./validate.js";

export { parseArgv } from "./args.js";
export { pickFreePort, portFromEnv } from "./port.js";
export { packageRoot } from "./root.js";

const HELP = `dualine [dir]             打开对照阅读（默认当前目录）
dualine check [dir]       核对锚点与 gloss.lock
dualine export [dir]      冻成静态页
dualine init [dir]        起草 gloss.md（尚未实现）

  --no-open               不要打开浏览器
  --out <dir>             export 输出目录
  --accept                check 通过后重写锁
  --help, --version
`;

export function readVersion(pkgRoot = packageRoot()): string {
  const raw = JSON.parse(readFileSync(join(pkgRoot, "package.json"), "utf8")) as {
    version?: string;
  };
  return raw.version ?? "0.0.0";
}

export function openBrowser(url: string): void {
  const plat = process.platform;
  try {
    const child =
      plat === "darwin"
        ? spawn("open", [url], { stdio: "ignore", detached: true })
        : plat === "win32"
          ? spawn("cmd", ["/c", "start", "", url], { stdio: "ignore", detached: true })
          : spawn("xdg-open", [url], { stdio: "ignore", detached: true });
    child.on("error", () => {
      /* opening the browser is optional */
    });
    child.unref();
  } catch {
    /* non-fatal */
  }
}

function isGlossFile(dir: string): boolean {
  const gloss = join(dir, "gloss.md");
  try {
    return existsSync(gloss) && statSync(gloss).isFile();
  } catch {
    return false;
  }
}

async function serve(args: Extract<CliArgs, { cmd: "serve" }>): Promise<number> {
  const dir = resolveProjectsDir(args.dir);
  try {
    if (!statSync(dir).isDirectory()) {
      console.error(`not a directory: ${dir}`);
      return 1;
    }
  } catch {
    console.error(`directory not found: ${dir}`);
    return 1;
  }
  if (!isGlossFile(dir)) {
    console.error("这个目录没有 gloss.md。先跑 dualine init。");
    console.error("No gloss.md here. Run dualine init first.");
    return 1;
  }

  const pkgRoot = packageRoot();
  const distDir = join(pkgRoot, "dist");
  if (!existsSync(join(distDir, "index.html"))) {
    console.error("还没有 dist/。在 Dualine 仓库里跑 npm run build。");
    console.error("No dist/ yet. Run npm run build in the Dualine checkout.");
    return 1;
  }

  const host = process.env.HOST?.trim() || "127.0.0.1";
  const fromEnv = portFromEnv();
  let port: number;
  try {
    port = fromEnv ?? (await pickFreePort(8787, host));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(message);
    return 1;
  }

  const server = createApiServer({ root: dir, single: true, distDir });
  try {
    const bound = await listenHttp(server, port, host);
    const url = `http://${host}:${bound}`;
    console.log(url);
    if (args.open) openBrowser(url);
  } catch (err) {
    const code = err && typeof err === "object" && "code" in err ? (err as { code: string }).code : "";
    if (code === "EADDRINUSE") {
      console.error(
        `api: port ${port} is in use — stop the other process or run with PORT=<n>`,
      );
    } else {
      const message = err instanceof Error ? err.message : String(err);
      console.error(message);
    }
    return 1;
  }

  await new Promise<void>((resolveClose) => {
    let closing = false;
    const shutdown = () => {
      if (closing) return;
      closing = true;
      server.close(() => resolveClose());
      setTimeout(() => resolveClose(), 1000).unref();
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  });
  return 0;
}

export async function runCli(argv: string[]): Promise<number> {
  const args = parseArgv(argv);
  switch (args.cmd) {
    case "help":
      console.log(HELP);
      return 0;
    case "version":
      console.log(readVersion());
      return 0;
    case "error":
      console.error(args.message);
      return 1;
    case "init":
      console.log("not yet");
      return 1;
    case "check":
      return runCheck([args.dir, ...(args.accept ? ["--accept"] : [])]);
    case "export":
      try {
        const dest = await exportProject(args.dir, args.out);
        console.log(`exported ${dest}`);
        return 0;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`export:gloss: ${message}`);
        return 1;
      }
    case "serve":
      return serve(args);
  }
}
