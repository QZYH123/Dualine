# Gloss ship report

Branch `feature/gloss-reader-v1`. Version `0.1.0`. Not pushed, not merged to `main`.

Usable locally, documented, checked, packaged cleanly. Not pushed, not merged, not a hosted app.

## 1. Architecture

The six module boundaries from v1 were kept. No framework rewrite and no change to the reading ritual.

| Module | Path | Decision |
|---|---|---|
| reader | `src/reader/*` | **Keep.** Ritual and sync unchanged. Quiet chrome was added later (sample chip, warn strip, chapter select, Esc whisper, keyboard reverse on glossed lines) without a layout redesign. |
| gloss model | `src/lib/gloss.ts` | **Keep.** Parser + document model, shared by browser and server. Not split. |
| fixtures | `src/fixtures/shortly.ts`, `examples/shortly/` | **Keep.** Bundled sample for `npm run dev` / preview without an API. |
| server | `server/index.ts`, `server/projects.ts` | **Tighten.** `handle()` takes an explicit root; catalog reports `root` + `rootStatus`. |
| validate | `server/validate.ts` | **Keep as SSOT.** CLI `check:gloss` and API `warnings` still share `checkRefs` / `collectRefs`. `inspectRoot()` / `resolveProjectsDir()` sit next to `projectsRoot()`. |
| load | `src/lib/load.ts` | **Tighten.** I/O stays here; policy moved to `src/lib/load-decision.ts` so node:test can cover fallback without Vite `?raw` fixtures. |

What was not done: splitting `useReadingSync`, rewriting the API as a framework, adding a project picker as a product surface.

The client never imports `server/`. The server imports `src/lib/gloss.ts` for parse/model and `src/lib/notice.ts` for the Windows-path shape check (browser-safe; no `node:fs`). Load policy is duplicated as a *type* of `rootStatus` (`ok` \| `missing` \| `not-directory`) on both sides so the browser does not take a filesystem dependency.

Fallback rule (the load-decision contract):

- API unreachable **and** nothing was asked for, or the ask is `shortly` → bundled sample.
- API unreachable **and** `?project=` is some other id → notice, never shortly.
- Projects dir missing / not a directory → notice, even if an id was asked for.
- Dir exists but is empty → notice, not the sample.
- Named project missing, API up → notice; if the catalog has other projects, list them as links.
- No `?project=` and the catalog is ok → first listed id (sorted by id). Not shortly unless it sorts first.

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

Tests went from 39 to 60 (`node:test`) at the time of this report, and have grown since (see §5). Coverage includes load decisions, `handle()` against explicit roots, `inspectRoot`, `check:gloss` via `runCheck`, and path-normalization cases.

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

The catalog is sorted by id. With no `?project=`, the first listed id opens — not shortly unless it sorts first. Use `?project=shortly` (or another id) for a specific project.

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
- Broken anchors show as a one-line strip under the masthead (click the count to expand). `check:gloss` still prints the full list.
- Narrow viewports are not a goal. Below ~1000px the reader asks for a wider window (≥1100px) instead of stacking; the contents rail appears at ≥1320px.
- Production JS is a single ~746 kB chunk (Shiki). Acceptable for local use; not split.
- The bundled sample is only `examples/shortly/` files imported via Vite `?raw`. A gloss that points outside those files will not match the fixture (the CLI warns when checking `examples/`).
- `HOST=0.0.0.0` serves local file contents; keep the API loopback unless you mean it.

## 5. Checks

Ran on this machine after the changes, before this report:

- `npm run check` — typecheck, `check:gloss` (`1 gloss checked, 37 refs, 0 problems`), tests under `tests/` (count has grown since the first ship pass; run `npm test` for the current total).
- `npm run build` — `tsc -b && vite build` succeeded; output in `dist/` (gitignored).
- Headless Chrome against `npm run preview:all` / `npm run preview`:
  - `/` with API on repo `examples/` (only shortly) → shortly reader
  - a multi-project root with no `?project=` → first catalog id (sorted by id); use `?project=shortly` for the sample
  - `/?project=nope` → 找不到项目, path, catalog link to shortly
  - blank / unset `GLOSS_PROJECTS_DIR` → repo `examples/` (shortly), not a cwd-empty notice; a real empty folder still says 这个目录下没有项目
  - missing dir → 找不到项目目录 (including with `?project=my-app`, no sample)
  - preview without API, `?project=my-app` → API 未运行； `/` → bundled sample
  - `GET /api/health` through the preview proxy returns `{ ok, root, rootStatus }`

`npm pack --dry-run` lists source, examples, tests, LICENSE, README — not `node_modules`, not `dist`, not operator prompt files.
