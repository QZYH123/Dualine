/*
 * Sample project, bundled as a fixture so the reader works without a server.
 * The same files live on disk under examples/shortly and can be served by the API.
 */
import glossSrc from "../../examples/shortly/gloss.md?raw";
import indexTs from "../../examples/shortly/src/index.ts?raw";
import serverTs from "../../examples/shortly/src/server.ts?raw";
import slugTs from "../../examples/shortly/src/slug.ts?raw";
import storeTs from "../../examples/shortly/src/store.ts?raw";
import validateTs from "../../examples/shortly/src/validate.ts?raw";
import { buildProject, type Project } from "../lib/gloss";

export function loadShortlyFixture(): Project {
  return buildProject("shortly", glossSrc, {
    "src/index.ts": indexTs,
    "src/server.ts": serverTs,
    "src/slug.ts": slugTs,
    "src/store.ts": storeTs,
    "src/validate.ts": validateTs,
  });
}
