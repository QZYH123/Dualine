# Gloss · 对照

A reader for understanding a codebase you vibe-coded: prose on the left, the real code it explains on the right, and the two never lose each other.

*Gloss* — a gloss is the explanatory note a reader writes beside a difficult text. 对照 (duìzhào) is the bilingual "facing-page" edition, where the original and its translation sit side by side. Here the code is the original and the prose is its translation.

## The reading ritual

1. **Read the prose.** It is a continuous essay in chapters, not a wall of files.
2. **The code follows.** A reading line sits about a third of the way down the viewport. Whichever passage has most recently crossed it is *current*; the code pane brings the lines that passage faces level with it and dims everything else. As you scroll, both pages move together; when the current passage changes, the code eases into place. A hairline **bridge** runs from the passage to its lines.
3. **Anchors are the fine ties.** Underlined phrases point at exact line ranges. Hover one to light up only those lines. Click to **pin** it — the code stays put while you keep reading; `Esc` (or the chip in the code pane) releases.
4. **The code answers back.** Lines the prose speaks about have a firmer line number. Hover one to light up the phrase that explains it; click it and the prose comes to that passage and pins the anchor, so you can read the explanation with the code held still.
5. **Look around.** Scrolling with the pointer over the code pane scrolls the code by itself; scrolling the prose snaps it back into alignment.

## Run

Requires Node 20.19+ or 22.12+ (Vite 8).

```sh
npm install
npm run check        # typecheck + this repo's examples
npm run dev:all      # web on http://localhost:5173, API on 127.0.0.1:8787
```

Then open the URL. This repo's `examples/` only has shortly, so `/` is that paired read. A folder of several projects still opens the first listed id — use `?project=shortly` (or another id) when you mean a specific one.

The two start together and stop together (`Ctrl-C` once). If the API's port is taken it says so and both sides exit; run with another port — `PORT=8790 npm run dev:all` — and the web side follows automatically.

`npm run dev` alone also works: the reader falls back to the bundled sample project (the one under `examples/shortly/`) when there is no API to ask, and the terminal shows a single quiet line about it instead of a stack trace. `npm run api` runs the API alone.

To serve the production bundle the same way — static files plus the local API:

```sh
npm run build
npm run preview:all    # web on http://localhost:4173, API on 127.0.0.1:8787
```

`vite preview` proxies `/api` like the dev server. Without the API, `npm run preview` shows the bundled sample. Reading any other project still needs the API; this is a local-first tool, not a hosted app.

Designed for viewports ≥ 1100px wide; the contents rail appears at ≥ 1320px. Below about 1000px the reader says so instead of stacking the two pages. Between 1000px and 1320px, a compact chapter control in the masthead stands in for the rail.

## Read your own project

There is no file picker, on purpose. The API reads a **folder of projects** from disk, and the URL says which one to face:

```
~/glosses/                ← GLOSS_PROJECTS_DIR
  my-app/                 ← project id: lowercase letters, digits, - or _
    gloss.md              ← the prose (see "Writing a gloss")
    src/…                 ← the code the prose points at
```

Point the env at that outer folder, not at `my-app` itself — a path that already has `gloss.md` is one project, not the catalog.

```sh
GLOSS_PROJECTS_DIR=~/glosses npm run dev:all
```

Then open `http://localhost:5173/?project=my-app`. The catalog is sorted by id; with no `?project=`, the first listed id opens. That is not always shortly — use the query for a specific project (e.g. `?project=shortly`). The wordmark goes to `/`, which is that same first id. If that project has broken anchors, the warn strip says so and adds a quiet line that this is the catalog default. Files are read on every request, so edit `gloss.md`, reload, and the anchors move with you. Only the files the gloss refers to, plus everything under `src/`, are sent to the browser (text files up to 512 KB, at most 200 of them).

Before reading, check that every anchor lands:

```sh
npm run check:gloss -- ~/glosses        # or GLOSS_PROJECTS_DIR=~/glosses npm run check:gloss
```

When the screen has nothing to face it says so in one line — 找不到项目, 找不到项目目录, API 未运行, or 这个目录下没有项目 — with the path (or the recovery command) underneath, instead of quietly showing the sample. `API 未运行` points at `npm run dev:all` and asks you to refresh once it is up; `返回` is home, not a retry of the same id. If the API can list other projects in the folder, those names appear as links. The sample is used only when the API is unreachable *and* you did not ask for a different project.

The API binds to `127.0.0.1` and serves file contents from the folder you point it at; keep it local. If you must expose it, `HOST=0.0.0.0` is explicit.

`GLOSS_PROJECTS_DIR` is trimmed, then resolved from the current working directory (`./foo` becomes `$PWD/foo`). A leading `~/` expands to the home directory. Prefer an absolute path. Unset or blank falls back to this repo's `examples/`, not the current directory. A Windows drive path pasted on Linux or macOS is not converted; the notice names what was pasted and asks for a path on this system.

## Writing a gloss

A project is a folder with a `gloss.md` and its source files (see `examples/shortly/`). The prose is Markdown with one extension: a link whose target is `path#L<start>-L<end>` is an **anchor**.

```md
---
name: shortly
tagline: 一个短链接服务
lang: typescript
---

# shortly 是怎么工作的

Lead paragraph, shown under the title.

## 它做什么

整个服务是[三个 HTTP 接口](src/server.ts#L18-L59)……
```

- `#` — document title; the paragraph after it is the lead.
- `##` — chapter (numbered automatically 一、二、三…).
- Every paragraph faces one span: its first anchor, or an explicit `@[src/x.ts#L1-L9]` at the start, or — if it has neither — the span of the previous paragraph.
- `` `code` ``, `**strong**`, `*em*` work as usual. Write a space between CJK and Latin.
- Paths are relative to the project folder and must stay inside it. Line numbers are 1-based and inclusive.

Write like a good commentary: name the real structures, say why they exist, and point at the lines. Every claim that matters should have an anchor.

## Check

```sh
npm run check          # typecheck + this repo's examples via check:gloss + test
npm test               # node:test suites under tests/
npm run check:gloss    # every anchor → a real file and a line range inside it
npm run build          # production bundle in dist/
npm run preview:all    # after build: dist on :4173 + API on :8787
```

`check:gloss` looks at `examples/` by default, or the folder given as an argument / in `GLOSS_PROJECTS_DIR`. It prints one line per broken anchor (`c3.p7.a2 → src/server.ts#L90: file has 87 lines`), and exits `1` when anything is broken or the folder is empty, `2` when the folder does not exist or is not a directory. `npm run check` always validates this repo's `examples/`, even if `GLOSS_PROJECTS_DIR` is set in the shell — use `npm run check:gloss -- ~/glosses` (or the env) for your own folder. The API reports the same lines as `warnings` on each project, so the CLI and the server never disagree about what is broken — they share one validator (`server/validate.ts`).

## API

| | |
|---|---|
| `GET /api/health` | `{ ok: true, root, rootStatus }` |
| `GET /api/projects` | `{ projects: [{ id, name, tagline, lang }], root, rootStatus }` — `rootStatus` is `ok`, `missing`, or `not-directory` |
| `GET /api/projects/:id` | `{ id, name, tagline, lang, gloss, files, warnings }` — `gloss` is the Markdown source, `files` maps project-relative paths to contents |

| env | default | |
|---|---|---|
| `GLOSS_PROJECTS_DIR` | this repo's `examples/` when unset or blank | folder of projects, one subfolder each; a set value is trimmed, `~/` is expanded, then resolved from the current working directory — prefer an absolute path |
| `PORT` | `8787` | API port; the Vite proxy follows it |
| `HOST` | `127.0.0.1` | API bind address |
| `GLOSS_API` | `http://127.0.0.1:$PORT` | where Vite proxies `/api` in `dev` and `preview` |

Project ids must match `^[a-z0-9][a-z0-9-_]*$`; anything else is `400`. Paths in a gloss that escape the project folder (including through symlinks) are refused, and binary files are never sent.

## Layout

```
src/
  lib/gloss.ts          document model + gloss.md parser (browser and server)
  lib/highlight.ts      Shiki, one restrained theme
  lib/load.ts           ?project= → API catalog → project or a quiet notice
  lib/load-decision.ts  fallback policy (no silent sample for a real project)
  reader/               Masthead · Rail · Prose · CodePane · useReadingSync
  styles/tokens.css     paper, ink, 朱 — the whole visual system
  styles/reader.css
  fixtures/shortly.ts   the sample, bundled from examples/shortly via ?raw
server/
  index.ts              the API (node:http, tsx)
  projects.ts           folder → project: discovery, file walk, limits
  validate.ts           anchors → files → line ranges; shared with check:gloss
scripts/check-gloss.ts  the CLI validator
tests/                  node:test — parser, validator, loader, API
examples/shortly/       sample project: gloss.md + src/
```

## Visual system

- **Paper & ink**, one accent: 朱 (cinnabar), the colour classical commentaries were written in. It marks only what is *tied*: anchors, the current passage, the faced lines, the bridge.
- **Type**: Source Serif 4 + Noto Serif SC for prose (designed as a pair), IBM Plex Mono for code and chrome.
- **Motion** only when it clarifies the mapping: the code sliding into alignment, nothing else.

## Not yet

- The gloss is written by hand. Nothing here generates prose from code; that is the point of v1 — get the reading right first.
- One project per screen; switching is by URL. There is no picker and no remote clone. When a named project is missing, the notice lists whatever else the API can see in the folder.
- Narrow viewports are not a goal yet. Below about 1000px a notice asks for a wider window rather than stacking the two pages.
- Broken anchors appear as a one-line strip under the masthead; click the count to expand the list. When `/` opened the first listed project, the strip also says so and points at `?project=<id>`. `check:gloss` still prints the full list.

## Publish

MIT. Version `0.1.0`. `private: true` — this is a local app, not an npm library.

```sh
npm pack               # source tarball: reader, server, examples, tests (no lockfile)
npm run build          # static assets in dist/ (gitignored)
```

The tarball is source, not a library — there is no `bin`. Extract it (`tar xf gloss-0.1.0.tgz && cd package && npm install && npm run dev:all`) or clone this repo for a pinned `package-lock.json`. `npm pack` never includes the lockfile; `npm install` then resolves the ranges in `package.json`. The production bundle still talks to the local API for any project that is not the bundled sample. Bind remains `127.0.0.1` unless `HOST` is set. Tag `v0.1.0` when you want a release; do not expect a hosted service.
