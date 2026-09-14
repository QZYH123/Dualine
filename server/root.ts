import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Dualine checkout — works from `server/*.ts` and from `dist-server/server/*.js`. */
export function packageRoot(fromFile: string = fileURLToPath(import.meta.url)): string {
  let dir = dirname(fromFile);
  for (let i = 0; i < 8; i++) {
    const pkg = join(dir, "package.json");
    if (existsSync(pkg)) {
      try {
        const name = (JSON.parse(readFileSync(pkg, "utf8")) as { name?: string }).name;
        if (name === "dualine") return dir;
      } catch {
        /* keep walking */
      }
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return resolve(dirname(fromFile), "..");
}
