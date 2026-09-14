# Decisions — Round 11 onward: from demo to tool

Owner: Fable (product + UI). Implementation: `backend` (Grok 4.6 xhigh-fast) unless marked *Fable*.
Each entry: what, why, what we deliberately do not do. Newest at the bottom.

## Where v0.1 stands (2026-09-15)

Ten UX rounds. The reading ritual is right and calm; tests green; own gloss reads itself.
What still keeps people from *relying* on it:

1. **Opening costs a clone.** Reading your own project means cloning Dualine, `npm install`, an env var, two ports, then a URL with `?project=`. That is a demo path, not a tool path.
2. **Anchors rot.** Dualine's own `gloss.md` already shows *5 处锚点无法落到代码* after a few commits. `gloss.lock` knows the code text, so it knows where the code went — but it only says "wrong", never "moved to L23–L64".
3. **Only TS/JS/JSON highlight.** Vibe-coded projects are Python, Go, Rust, Vue, CSS, shell… everything else is grey text.
4. **Getting the first gloss is a cliff.** A folder without `gloss.md` is a dead end with a notice; the `write-gloss` skill lives in *this* repo, not in the user's.

The ritual does not change. Everything below removes friction around it.

## D1 — `dualine` CLI, one process, one port

`dualine [dir]` (default `.`) serves the built UI and the API from **one** port, opens the browser, and treats `dir` as the single project. Subcommands: `check`, `export`, `init`. `npm run dev:all` stays for hacking on Dualine itself.

- Single-folder mode: the folder name may be `MyApp`; the id is the slugified name (fallback `project`). No `?project=` needed.
- `package.json` gets `bin`, `dist/` in `files`, `prepack` builds. **`private: true` stays** until the owner decides to publish; flipping it is one line. `npx github:QZYH123/Dualine` and `npm link` work meanwhile.
- Not doing: a daemon, remote clone, a project picker.

## D2 — Anchors that report where the code went

`check:gloss --fix` (and `dualine check --fix`): for each ref whose locked text no longer sits at the recorded lines, search the file for that exact block; a **unique** match rewrites the line numbers in `gloss.md` and the lock. Ambiguous or absent → still a problem, listed. The API's `warnings` carry `suggest: {start,end}` when the text is found; the warn strip shows *已挪到 L23–L64 · dualine check --fix*.

- UI stays read-only. Writing is a CLI act you can diff and commit.
- Not doing: fuzzy/AI relocation. Exact text only; that is what a lock is for.

## D3 — Highlight any language, lazily

Grammar chosen by file extension, loaded on demand (Shiki dynamic import). Unknown → plain. Frontmatter `lang` becomes a hint for the default only. Main chunk must shrink, not grow.

## D4 — `dualine init` and the no-gloss screen

`dualine init [dir]` writes a starter `gloss.md` (name from folder, one chapter with one real anchor into the first source file it finds) and installs `write-gloss/SKILL.md` into the project's `.cursor/skills/`. It prints the one-line prompt to hand an agent. The reader's no-gloss notice says the same thing, copyable. Dualine still does not generate prose.

## Later (not this round unless A–D land cleanly)

- D5 Multiple notes per project (`gloss/*.md`, quiet switcher in the masthead, `?note=`). Large repos are read one subsystem at a time.
- D6 Night paper (*Fable*). `prefers-color-scheme` variant of the same ink/paper/vermilion; no theme UI.
- Reading position, export, live *已更新* already exist; leave them.

## Log

- 2026-09-15 Round 11 opened on `feature/round11-tool`. D1–D4 delegated to `backend`; D1+D3 first in parallel (disjoint files), D2 next, D4 last. Dogfood D2 on this repo's own gloss.
- 2026-09-15 D1–D4 landed (153 tests). Verified end-to-end by hand: `dualine init /tmp/pyapp` → `dualine check` (lock written) → `dualine /tmp/pyapp` shows Python highlighted on one port, no warn strip. Main chunk 756 → 405 kB. D2 dogfood: hoisting an import in `gloss.ts` shifted five anchors; `check --fix` moved all five.
- **D2 addendum — the lock is a baseline, not a gate.** A fresh project has nothing to drift from, so the first clean `check` writes `gloss.lock` instead of failing on its absence. The reader's warn strip only speaks about anchors that do not land or whose code changed; lock bookkeeping (`not in lock`) stays in the CLI. Reason: a writer who adds an anchor and opens the reader must not be greeted by a warning about a file they have never heard of.
- **D2 addendum — lock keeps hashes.** Relocation recovers the faced text by finding a same-length window with the same hash; exact moves only. No schema change, no literal code stored in the lock.
- D5 (multiple notes, `gloss/<id>.md`, `?note=`) promoted to this round: friction is gone, so the next ceiling is "one note per project" for real repos. IA: notes appear in the rail above 目录 and as `<optgroup>`s in the mid-width select; nothing new when a project has one note.
