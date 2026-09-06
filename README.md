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
npm run dev:all      # web on http://localhost:5173, API on :8787
```

Or separately: `npm run dev` (frontend only — falls back to the bundled sample project when the API is not running) and `npm run api`.

Designed for viewports ≥ 1100px wide; the contents rail appears at ≥ 1320px.

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

Validate anchors against the files: `npm run check:gloss` (or read `warnings` from the API).

## API

`GET /api/projects` · `GET /api/projects/:id` → `{ id, name, tagline, lang, gloss, files, warnings }` · `GET /api/health`.
Projects are discovered under `examples/` (override with `GLOSS_PROJECTS_DIR`).

## Layout

```
src/
  lib/gloss.ts          document model + gloss.md parser
  lib/highlight.ts      Shiki, one restrained theme
  lib/load.ts           API → fixture fallback
  reader/               Masthead · Rail · Prose · CodePane · useReadingSync
  styles/tokens.css     paper, ink, 朱 — the whole visual system
  styles/reader.css
server/                 the API (node:http, tsx)
examples/shortly/       sample project: gloss.md + src/
```

## Visual system

- **Paper & ink**, one accent: 朱 (cinnabar), the colour classical commentaries were written in. It marks only what is *tied*: anchors, the current passage, the faced lines, the bridge.
- **Type**: Source Serif 4 + Noto Serif SC for prose (designed as a pair), IBM Plex Mono for code and chrome.
- **Motion** only when it clarifies the mapping: the code sliding into alignment, nothing else.
