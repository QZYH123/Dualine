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

Requires Node 20+.

```sh
npm install
npm run dev:all      # web on http://localhost:5173, API on 127.0.0.1:8787
```

The two start together and stop together (`Ctrl-C` once). If the API's port is taken it says so and both sides exit; run with another port — `PORT=8790 npm run dev:all` — and the web side follows automatically.

`npm run dev` alone also works: the reader falls back to the bundled sample project (the one under `examples/shortly/`) when there is no API to ask, and the terminal shows a single quiet line about it instead of a stack trace. `npm run api` runs the API alone.

Designed for viewports ≥ 1100px wide; the contents rail appears at ≥ 1320px.

## Read your own project

There is no file picker, on purpose. The API reads a **folder of projects** from disk, and the URL says which one to face:

```
~/glosses/                ← GLOSS_PROJECTS_DIR
  my-app/                 ← project id: lowercase letters, digits, - or _
    gloss.md              ← the prose (see "Writing a gloss")
    src/…                 ← the code the prose points at
```

```sh
GLOSS_PROJECTS_DIR=~/glosses npm run dev:all
```

Then open `http://localhost:5173/?project=my-app`. With no `?project=`, the first project in the folder is opened. Files are read on every request, so edit `gloss.md`, reload, and the anchors move with you. Only the files the gloss refers to, plus everything under `src/`, are sent to the browser (text files up to 512 KB, at most 200 of them).

Before reading, check that every anchor lands:

```sh
npm run check:gloss -- ~/glosses        # or GLOSS_PROJECTS_DIR=~/glosses npm run check:gloss
```

When the screen has nothing to face it says so in one line — 找不到项目, API 未运行, or 这个目录下没有项目 — with the path to look at underneath, instead of quietly showing the sample.

The API binds to `127.0.0.1` and serves file contents from the folder you point it at; keep it local. If you must expose it, `HOST=0.0.0.0` is explicit.

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
npm run check          # typecheck + check:gloss + test
npm test               # node:test suites under tests/
npm run check:gloss    # every anchor → a real file and a line range inside it
npm run build          # production bundle in dist/
```

`check:gloss` looks at `examples/` by default, or the folder given as an argument / in `GLOSS_PROJECTS_DIR`. It prints one line per broken anchor (`c3.p7.a2 → src/server.ts#L90: file has 87 lines`), and exits `1` when anything is broken, `2` when the folder does not exist. The API reports the same lines as `warnings` on each project, so the CLI and the server never disagree about what is broken — they share one validator (`server/validate.ts`).

## API

| | |
|---|---|
| `GET /api/health` | `{ ok: true }` |
| `GET /api/projects` | `{ projects: [{ id, name, tagline, lang }] }` |
| `GET /api/projects/:id` | `{ id, name, tagline, lang, gloss, files, warnings }` — `gloss` is the Markdown source, `files` maps project-relative paths to contents |

| env | default | |
|---|---|---|
| `GLOSS_PROJECTS_DIR` | `examples/` | folder of projects, one subfolder each |
| `PORT` | `8787` | API port; the Vite proxy follows it |
| `HOST` | `127.0.0.1` | API bind address |
| `GLOSS_API` | `http://127.0.0.1:$PORT` | where Vite proxies `/api` in dev |

Project ids must match `^[a-z0-9][a-z0-9-_]*$`; anything else is `400`. Paths in a gloss that escape the project folder (including through symlinks) are refused, and binary files are never sent.

## Layout

```
src/
  lib/gloss.ts          document model + gloss.md parser (browser and server)
  lib/highlight.ts      Shiki, one restrained theme
  lib/load.ts           ?project= → API → sample fallback
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
- One project per screen; switching is by URL. There is no list, no picker, no remote clone.
- The reader does not surface the API's `warnings`; run `check:gloss`.
- Narrow viewports are not a goal yet. Below 1100px the two pages do not fit.
