#!/usr/bin/env node
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const cli = join(here, "../dist-server/server/cli.js");
if (!existsSync(cli)) {
  console.error("还没有编译 server。在 Dualine 仓库里跑 npm run build。");
  console.error("Server build missing. Run npm run build in the Dualine checkout.");
  process.exit(1);
}
const { runCli } = await import(pathToFileURL(cli).href);
process.exit(await runCli(process.argv.slice(2)));
