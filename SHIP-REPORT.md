# Gloss ship report

Branch `feature/gloss-reader-v1`. Version `0.1.0`. Not pushed, not merged to `main`.

Publishable enough: usable locally, documented, checked, packaged cleanly.

## 1. Architecture

The six module boundaries from v1 were kept. No framework rewrite and no change to the reading ritual.

| Module | Path | Decision |
|---|---|---|
| reader | `src/reader/*` | **Keep.** Ritual, sync, chrome untouched aside from a quiet empty code pane. |
| gloss model | `src/lib/gloss.ts` | **Keep.** Parser + document model, shared by browser and server. Not split. |
| fixtures | `src/fixtures/shortly.ts`, `examples/shortly/` | **Keep.** Bundled sample for `npm run dev` / preview without an API. |
| server | `server/index.ts`, `server/projects.ts` | **Tighten.** `handle()` takes an explicit root; catalog reports `root` + `rootStatus`. |
| validate | `server/validate.ts` | **Keep as SSOT.** CLI `check:gloss` and API `warnings` still share `checkRefs` / `collectRefs`. Added `inspectRoot()` next to `projectsRoot()`. |
| load | `src/lib/load.ts` | **Tighten.** I/O stays here; policy moved to `src/lib/load-decision.ts` so node:test can cover fallback without Vite `?raw` fixtures. |

What was not done: splitting `useReadingSync`, rewriting the API as a framework, surfacing `warnings` in the reader, adding a project picker as a product surface.

The client never imports `server/`. The server imports only `src/lib/gloss.ts` for parse/model. Load policy is duplicated as a *type* of `rootStatus` (`ok` \| `missing` \| `not-directory`) on both sides so the browser does not take a filesystem dependency.

Fallback rule (the load-decision contract):

- API unreachable **and** nothing was asked for, or the ask is `shortly` → bundled sample.
- API unreachable **and** `?project=` is some other id → notice, never shortly.
- Projects dir missing / not a directory → notice, even if an id was asked for.
- Dir exists but is empty → notice, not the sample.
- Named project missing, API up → notice; if the catalog has other projects, list them as links.

## 2. What changed

Commits on this branch after the previous README polish:

| Commit | Theme |
|---|---|
| `171d34a` `chore: add MIT license, Node 20 engines, and ignore operator files` | Packaging |
| `7e92d7c` `feat(api): distinguish missing, empty, and unreadable project dirs` | Catalog robustness |
| `e80fe2c` `feat(load): never silently substitute the sample for a real project` | Load policy |
| `271284d` `feat(ui): error notices with path, catalog links, and empty code pane` | Empty/error UX |
| `9f505bc` `refactor(check): export runCheck and report missing vs not-a-directory` | CLI + tests |
| `f075adc` `fix(preview): proxy /api during vite preview` | Production local stack |
| `1efaf54` `docs: document catalog errors, preview:all, and packing` | README |
| *(this file)* | Ship report |

Tests went from 39 to 60 (`node:test`). New coverage: load decisions, `handle()` against explicit roots, `inspectRoot`, `check:gloss` via `runCheck`.

## 3. How to run and how to publish

Requires **Node 20+**.

```sh
npm install
npm run dev:all          # web http://localhost:5173  ·  API 127.0.0.1:8787
```

Own projects:

```sh
GLOSS_PROJECTS_DIR=~/glosses npm run dev:all
# open http://localhost:5173/?project=my-app
npm run check:gloss -- ~/glosses
```

Checks and production bundle:

```sh
npm run check            # typecheck + check:gloss + test
npm run build            # dist/
npm run preview:all      # dist on :4173 + API on :8787 (after build)
```

`vite preview` now proxies `/api` the same way as `vite dev`. Without the API, `/` (or `?project=shortly`) shows the bundled sample; any other `?project=` says the API is not running.

**This is local-first.** The static files in `dist/` are not a hosted app. Reading a disk project always needs the local API (`127.0.0.1:8787` unless `PORT` / `HOST` / `GLOSS_API` say otherwise). Do not expose it without setting `HOST` deliberately.

Pack / tag (not done here, and nothing was published):

```sh
npm pack                 # source tarball, MIT, no dist/ or node_modules
git tag v0.1.0           # when you want a release
```

`package.json` is `"private": true`. There is no npm library publish story.

## 4. Remaining known limits

- Gloss prose is written by hand. Nothing generates it from code.
- One project per screen; switching is by URL. Error screens may list other projects in the folder. There is still no picker and no remote clone.
- API `warnings` are not shown in the reader; run `check:gloss`.
- Narrow viewports are not a goal. Below ~1100px the two pages do not fit (contents rail at ≥1320px).
- Production JS is a single ~746 kB chunk (Shiki). Acceptable for local use; not split.
- The bundled sample is only `examples/shortly/` files imported via Vite `?raw`. A gloss that points outside those files will not match the fixture (the CLI warns when checking `examples/`).
- `HOST=0.0.0.0` serves local file contents; keep the API loopback unless you mean it.

## 5. Checks

Ran on this machine after the changes, before this report:

- `npm run check` — typecheck, `check:gloss` (`1 gloss checked, 37 refs, 0 problems`), **60 tests pass**.
- `npm run build` — `tsc -b && vite build` succeeded; output in `dist/` (gitignored).
- Headless Chrome against `npm run preview:all` / `npm run preview`:
  - `/` with API → shortly reader
  - `/?project=nope` → 找不到项目, path, catalog link to shortly
  - empty `GLOSS_PROJECTS_DIR` → 这个目录下没有项目
  - missing dir → 找不到项目目录 (including with `?project=my-app`, no sample)
  - preview without API, `?project=my-app` → API 未运行； `/` → bundled sample
  - `GET /api/health` through the preview proxy returns `{ ok, root, rootStatus }`

`npm pack --dry-run` lists source, examples, tests, LICENSE, README — not `node_modules`, not `dist`, not operator prompt files.
