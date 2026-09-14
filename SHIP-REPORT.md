# Dualine ship report

Branch `feature/round11-tool`. Version `0.2.0`. Not pushed, not tagged, not on npm.

Usable as a local CLI. Documented, checked, packaged with a `bin`. Not published.

## 1. Architecture

The six module boundaries from v0.1 were kept. CLI, static serve, init, notes, lock/relocate, and lazy languages sit next to them. No framework rewrite and no change to the reading ritual.

| Module | Path | Decision |
|---|---|---|
| reader | `src/reader/*` | **Keep.** Ritual and sync unchanged. Quiet chrome was added later (sample chip, warn strip, chapter select, Esc whisper, keyboard reverse on glossed lines) without a layout redesign. |
| gloss model | `src/lib/gloss.ts` | **Keep.** Parser + document model, shared by browser and server. Not split. |
| fixtures | `src/fixtures/shortly.ts`, `examples/shortly/` | **Keep.** Bundled sample for `npm run dev` / preview without an API. |
| server | `server/index.ts`, `server/projects.ts` | **Tighten.** `handle()` takes an explicit root; catalog reports `root` + `rootStatus`. |
| validate | `server/validate.ts` | **Keep as SSOT.** CLI `check:gloss` and API `warnings` still share `checkRefs` / `collectRefs`. `inspectRoot()` / `resolveProjectsDir()` sit next to `projectsRoot()`. |
| load | `src/lib/load.ts` | **Tighten.** I/O stays here; policy moved to `src/lib/load-decision.ts` so node:test can cover fallback without Vite `?raw` fixtures. |
| cli | `bin/dualine.js`, `server/cli.ts`, `server/args.ts`, `server/port.ts` | **Add.** One process, one port. `dualine [dir]` serves `dist/` + API and opens the browser. Subcommands: `check`, `export`, `init`. Busy `PORT` walks forward. |
| static | `server/static.ts` | **Add.** Same process hosts `dist/` (SPA fallback to `index.html`). Path never leaves the dist root. |
| init | `server/init.ts` | **Add.** Writes a starter `gloss.md` and installs the write-gloss skill. Does not generate prose. |
| notes | `server/notes.ts`, `src/lib/notes.ts` | **Add.** Default note is `gloss` (`gloss.md`); extras are `gloss/<id>.md`. Types in `src/lib`; filesystem in `server`. |
| lock / relocate / fix | `server/lock.ts`, `server/relocate.ts`, `server/fix.ts` | **Add.** Target-keyed hashes; exact-text relocate; `--fix` rewrites line numbers only. |
| language | `src/lib/language.ts`, lazy `src/lib/highlight.ts` | **Add.** Grammar by file extension, loaded on demand. Unknown is plain. Frontmatter `lang` is a hint. |

What was not done: splitting `useReadingSync`, rewriting the API as a framework, adding a project picker as a product surface, a daemon, remote clone, fuzzy/AI relocation.

`dualine [dir]` (and `GLOSS_PROJECT_DIR`) is **single-folder mode**: that folder is the only project. The folder name is slugified to the id (`My App` → `my-app`; empty or still invalid → `project`). No `?project=` needed. Catalog mode (`GLOSS_PROJECTS_DIR`) is unchanged for hacking on Dualine.

Lock-key contract: one `gloss.lock` per project. Keys are the faced target (`path#Lstart-Lend`), with a note prefix when the note is not `gloss` (`api:src/x.ts#L1-L10`). Default-note keys stay unprefixed. v1 positional keys (`c1.p1.a1`, optional `note:` prefix) are read transparently; a rewrite writes v2. Spans store sha256 of the faced lines, not the text. A first clean `check` writes the file as a baseline; absence is not a failure.

The client never imports `server/`. The server imports `src/lib/gloss.ts` for parse/model, `src/lib/notes.ts` for note ids/keys, `src/lib/language.ts` for init/highlight, and `src/lib/notice.ts` for the Windows-path shape check (browser-safe; no `node:fs`). Load policy is duplicated as a *type* of `rootStatus` (`ok` \| `missing` \| `not-directory`) on both sides so the browser does not take a filesystem dependency. Catalog also reports `single` when the API is in single-folder mode.

Fallback rule (the load-decision contract):

- API unreachable **and** nothing was asked for, or the ask is `shortly` → bundled sample.
- API unreachable **and** `?project=` is some other id → notice, never shortly.
- Projects dir missing / not a directory → notice, even if an id was asked for.
- Dir exists but is empty → notice, not the sample.
- Named project missing, API up → notice; if the catalog has other projects, list them as links.
- No `?project=` and the catalog is ok → first listed id (sorted by id). Not shortly unless it sorts first.

Note rule (on top of that):

- Default note is `gloss` (`gloss.md`). `?note=` omitted opens it.
- Extra notes are `gloss/<id>.md` (basename is the id; `gloss/gloss.md` is ignored so it cannot collide).
- Unknown `?note=` → notice that lists the project's notes as links. Frozen export names `gloss/<id>.md`.

## 2. What changed

Commits on `feature/round11-tool` after `main` (`a267f3f`), grouped by theme:

| Commit | Theme |
|---|---|
| `f07aa8b` `feat(api): serve one folder as a slug id and host dist/` | CLI |
| `bf13e8c` `feat(cli): add dualine, check, export, and an init stub` | CLI |
| `41401e1` `feat(cli): write a starter gloss.md and install write-gloss` | CLI |
| `9cf9d77` `feat: point the empty and no-gloss notices at dualine init` | CLI |
| `13397b4` `feat(check): relocate locked spans and rewrite them with --fix` | check/lock |
| `56a9ebf` `refactor(gloss): hoist the language import; anchors relocated by check --fix` | check/lock |
| `bf3af9d` `feat(check): treat gloss.lock as a baseline, not a first-check gate` | check/lock |
| `d59bb82` `fix(lock): key gloss.lock spans by the faced target` | check/lock |
| `cf8df7b` `feat(highlight): load grammars on demand from the file path` | languages |
| `86a0001` `chore(tsconfig): include the path-to-language module` | languages |
| `5825874` `chore(tsconfig): include the lazy highlighter module` | languages |
| `e5e4961` `feat(server): list notes and load a chosen note` | notes |
| `a05347e` `feat(check): lock and check every note in a project` | notes |
| `c594634` `feat(reader): switch notes with ?note=` | notes |
| `23f507b` `feat(export): freeze every note in a project` | notes |
| `564ecba` `feat(ui): night paper follows prefers-color-scheme` | night |
| `747b4c8` `docs: open Round 11 — decisions for CLI, anchor relocation, languages, init` | docs |
| `2ff9264` `docs: note that highlighting loads any language lazily` | docs |
| `c7ac43b` `docs: show dualine one-liner and the new env vars` | docs |
| `0021834` `docs: mention dualine check --fix next to --accept` | docs |
| `df5dfa5` `docs: tell people to run dualine init instead of copying the skill` | docs |
| `15dce9e` `docs: write-gloss speaks the CLI; record D1–D4 verification and lock-as-baseline` | docs |
| `68154d8` `docs: mention topic notes and retarget own gloss` | docs |
| `2dc53c8` `docs(gloss): two chapters — one command, and anchors that age` | docs |
| `7db6df6` `docs: README leads with the dualine command` | docs |
| `2cfe9d9` `docs: record Round 11 CLI, notes, lock, and night audit` | docs |
| `997ee3d` `docs: record R11-8 lock refresh` | docs |
| `3091975` `docs: record Round 11 re-test count` | docs |
| `9530180` `docs: record R11-init as fixed` | docs |
| `d1f1b0c` `fix(ui): hide leftover catalog-default hint in single-folder mode` | audit fixes |
| `fef474f` `fix(ui): say 已挪到 on the one-line warn strip when a span moved` | audit fixes |
| `b7f55db` `fix(ui): single-folder missing-note hint is the project folder` | audit fixes |
| `f3ca2df` `fix(ui): single-folder empty notice names gloss.md` | audit fixes |
| `1d9b106` `fix(cli): try the next port when PORT is taken` | audit fixes |
| `5ca5067` `fix(ui): lift night whispers to 3:1 contrast` | audit fixes |
| `76f27d0` `fix(ui): frozen export missing-note hint is a relative path` | audit fixes |
| `4a48e04` `fix(lock): retarget faced spans after Round 11 edits` | audit fixes |
| `3504b48` `fix(init): prefer real entries over __init__.py` | audit fixes |
| `30882c0` `ci: run check and build on push` | ci |
| `1629915` `chore: v0.2.0` | version |
| *(this file)* | ship report |

Tests went from 72 to 185 (`node:test`). Main chunk 756 → **410.94 kB** (`dist/assets/index-CUxGIl9W.js`; gzip 135.59 kB). Grammars are extra chunks, loaded on demand.

## 3. How to run and how to publish

Requires **Node 20.19+ or 22.12+** (Vite 8).

Install once from the checkout (the package is still `private`; it is not on npm):

```sh
git clone https://github.com/QZYH123/Dualine.git
cd Dualine
npm install && npm run build && npm link
```

`npm link` writes `dualine` under that npm prefix. The prefix must be on `PATH`. `node bin/dualine.js` works without it.

Then, in any project folder:

```sh
dualine init           # starter gloss.md + write-gloss skill (if none yet)
dualine .              # one port; browser opens
dualine check .        # anchors + gloss.lock
dualine check . --fix  # unique exact-text moves: rewrite line numbers
dualine export .       # → export/<id>/  (open index.html, no server)
```

`dualine` is the single-folder path. No `?project=`, no second port. `PORT` (or 8787) walks forward when taken. `HOST` defaults to `127.0.0.1`.

Dev stack (hacking on Dualine itself):

```sh
npm install
npm run dev:all          # web http://localhost:5173  ·  API 127.0.0.1:8787
GLOSS_PROJECTS_DIR=$PWD npm run dev:all   # this repo as ?project=dualine
npm run check            # typecheck + examples/ + this repo's gloss + test
npm run build            # dist/ + dist-server/
npm run preview:all      # dist on :4173 + API on :8787 (after build)
```

`npm run check` always points `check:gloss` at this repo's `examples/`, then at `.`, even if `GLOSS_PROJECTS_DIR` is set. Own folders: `npm run check:gloss -- ~/glosses` or `dualine check ~/app`.

`vite preview` proxies `/api` the same way as `vite dev`. Without the API, `/` (or `?project=shortly`) shows the bundled sample; any other `?project=` says the API is not running.

**This is local-first.** Reading a disk project needs the local API. The CLI hosts `dist/` on that same port. Do not expose it without setting `HOST` deliberately.

Publish (not done here, and nothing was published):

`package.json` is still `"private": true`. Flip that one field and `npm publish` would put `dualine` on npm with `bin` + built `dist/` / `dist-server/` (`prepack` runs `build`). After that, `npx dualine` is the install. Until then there is no npm tarball and no `npx dualine` from the registry.

```sh
npm pack                 # source + built dist (prepack); MIT; no node_modules
git tag v0.2.0           # when you want a release — not tagged
```

`npm pack` never includes `package-lock.json`; clone the repo for pinned deps, or extract the tarball and `npm install` against the published ranges.

## 4. Remaining known limits

- Dualine does not generate prose from code. `init` writes a starter page; an agent (or a human) writes the essay.
- No remote clone. One folder per `dualine` process. Catalog switching is still by URL when using `GLOSS_PROJECTS_DIR`. No picker.
- Narrow viewports are not a goal. Below ~1000px the reader asks for a wider window (≥1100px) instead of stacking; the contents rail appears at ≥1320px.
- Relocation is exact text only (same-length window, same hash). Ambiguous or absent → still a problem. No fuzzy or AI retarget.
- Not on npm. `"private": true`. Not tagged. Not pushed.
- `npm link` writes the bin under the current npm prefix; that prefix must be on `PATH` (this agent's prefix was not). `node bin/dualine.js` works.
- One `gloss.lock` per project. Every note shares it (note-prefixed keys). There is no per-note lock file.
- `HOST=0.0.0.0` serves local file contents; keep the API loopback unless you mean it.

## 5. Checks

Round 11 (UX-AUDIT, `feature/round11-tool` @ `7db6df6`, then a write pass on the same branch). README as the only guide. `npm install && npm run build && npm link` — link wrote the bin under this agent's npm prefix, which was not on `PATH`; used that `dualine`. Three /tmp projects (Python, Go, TS with `gloss/api.md`). Playwright 1440×900 / 1200×900 + `color_scheme='dark'` once each. Exports via `dualine export` and Pages `npx tsx scripts/export-gloss.ts .` served statically.

Break cases run: move / `--fix` / text drift / insert chapter / delete `gloss.md` / unknown `?note=` / no-gloss refusal / init twice / `--force` / `My App` → `my-app` / `PORT` busy / `--help` `--version`.

After the write pass (R11-1…R11-7): `npm run check` / `npm run build` — **180/180** tests green. Re-test: moved span → strip `已挪到 L12–L16 · dualine check --fix 可全部挪好`; unknown `?note=` lists notes; delete `gloss.md` → 「这里还没有 gloss.md」; `PORT=9340` busy → `:9341`; night rail/999 hint ~3.5:1; frozen miss hint `gloss/nope.md`; `check:gloss -- .` → 41 refs, 0 problems. Pages `export/dualine/index.html` opens statically (title `dualine 是怎么对照的`, pin works, dark paper, 999 gate). Later: R11-8 lock refresh, R11-init entry heuristic.

For this report, on this machine:

- `npm test` — **185/185** pass (`node:test`).
- `npm run build` — `tsc -b && vite build` succeeded; main chunk `dist/assets/index-CUxGIl9W.js` **410.94 kB** (gzip 135.59 kB).
- Pages export from the Round 11 audit still stands: `export/dualine/index.html` opens with no server.

Local-only. No push, no tag, no npm publish.
