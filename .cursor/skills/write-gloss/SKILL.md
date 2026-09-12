---
name: write-gloss
description: >
  Draft a Dualine/Gloss paired-reading note (gloss.md) from a codebase:
  chaptered commentary with path#Lstart-Lend anchors, then how to open it
  in Dualine. Use when the user asks to write a 对照文档 / 对照笔记, generate
  a gloss, author prose↔code notes for Gloss or Dualine, or runs /write-gloss.
---

# Write a Gloss

Dualine (Gloss · 对照) is a **reader**. This skill **authors** `gloss.md`. Do not add a generator to Dualine.

A finished gloss is a short guided pass: the reader grasps the system, not a file tree.

## Output

Write `gloss.md` at the root of the project being explained (alongside its source). Dualine treats that folder as one project.

```
<parent>/                 ← GLOSS_PROJECTS_DIR
  <id>/                   ← folder name is the project id
    gloss.md
    src/…                 ← or whatever the anchors point at
```

- `<id>` must match `^[a-z0-9][a-z0-9-_]*$`. Capitals, spaces, or a leading hyphen → Dualine skips the folder. If the repo name is invalid, say so and use a valid-id symlink or copy; do not silently rename a git checkout.
- Dualine's env points at **`<parent>`**, not at `<id>/`.
- Dualine sends (a) every file an anchor names, plus (b) everything under `src/`. A file outside `src/` that never appears in an anchor will not load.

Canonical quality: Dualine's `examples/shortly/gloss.md` (if that repo is available).

## Dialect

Markdown plus one extension. No `###`, no images, no HTML. `[label](url)` that is not an anchor is left as literal text — do not use ordinary Markdown links.

**Frontmatter** (optional, `key: value` lines only):

```md
---
name: shortly
tagline: 一个短链接服务
lang: typescript
---
```

**Structure**

- `#` title. The paragraph(s) after it, before the first `##`, are the lead (shown under the title; they do not drive the code pane).
- `##` chapter. Dualine numbers them 一、二、三…
- A blank line ends a passage. Soft-wrapped lines in one passage are joined with a space.

**Anchors** — a link whose target is `path#L<start>-L<end>`:

```md
整个服务是[三个 HTTP 接口](src/server.ts#L18-L59)
```

- Path is relative to the project folder, no spaces, must stay inside it.
- Line numbers are 1-based and inclusive. `#L15` is a one-line span. `#L9-L3` is stored as 3–9.

**Passage span** (what the code pane faces while this paragraph is current):

1. An explicit `@[src/x.ts#L1-L9]` at the very start of the passage (stripped from the prose), or else
2. The passage's **first** inline anchor, or else
3. The previous passage's span (inheritance crosses chapters).

Use `@[…]` only when the paragraph has no inline anchor but still needs its own span. Consecutive passages about the same span should inherit — do not repeat the same link in every paragraph.

Inline markup that works: `` `code` ``, `**strong**`, `*em*`. Put a space between CJK and Latin.

## How to write

Follow a request or data path, not the directory listing. Name real structures, say why they exist, point at the lines. Every claim that matters gets an anchor.

- Depth: between jargon dump and baby talk.
- Length: one sitting (about 6–10 chapters for a small app; one subsystem of a large repo, not the whole tree).
- First chapter: what it does. Then walk one path. Last chapter: what it does not do, with anchors on the natural extension points.
- Language: the user's language. Default Chinese if they are writing in Chinese.
- Tests, lockfiles, generated code, `node_modules`, and `dist` are out unless they are the subject.

**Line numbers are facts.** Before citing a span, read that file. After the draft, re-read every cited range and confirm the sentence still matches those lines. Never guess.

**Narrowest-span reverse.** Clicking a code line jumps to the **narrowest** anchor that covers it. If chapter 一 teaches `src/server.ts#L18-L59`, do not later add a one-line `#L18` — that line will steal the reverse jump. Point the later claim at the inner body (`#L19-L30`), not at the shared start line.

## Procedure

1. **Map.** Find entry points and the 3–8 files on the path you will narrate. If the user did not say what to explain, pick one coherent path (one request, one command, one screen) and say what you are covering.
2. **Outline** chapters as that path. Do not outline files.
3. **Draft** `gloss.md`. For each claim, read the file, then write the sentence with an accurate anchor.
4. **Check.**
   - Dualine checkout available: `npm run check:gloss -- <parent>` from that repo. Fix every `file has N lines` / missing-file line until `0 problems`.
   - Otherwise: for each `path#Lstart-Lend`, the file exists under the project folder, `1 ≤ start ≤ end ≤ line count`.
5. **Handoff** (see below). Do not start Dualine unless the user asked you to.

## Open in Dualine

Clone [QZYH123/Dualine](https://github.com/QZYH123/Dualine) if needed, then:

```sh
cd /path/to/Dualine
GLOSS_PROJECTS_DIR=/absolute/path/to/<parent> npm run dev:all
```

Open `http://localhost:5173/?project=<id>`. The catalog is sorted by id; with no query, the first listed id opens — always pass `?project=` when you mean a specific one. If `<parent>` has no child projects but `<parent>/gloss.md` exists and the folder name is a valid id, Dualine treats that folder as the one project — you can point `GLOSS_PROJECTS_DIR` at `<id>/` itself.

`check:gloss` uses the same parent folder:

```sh
npm run check:gloss -- /absolute/path/to/<parent>
```
