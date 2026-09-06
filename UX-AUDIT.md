# Gloss UX audit — feature/gloss-reader-v1

Date: 2026-09-06 (UTC+8). Real journeys at http://127.0.0.1:5173; screenshots in audit-shots/; code review of reader/load/server/check/docs.

Status legend for Phase 3: **open** · **fixed** · **deferred**.

---

## Journey results

### 1. First open `/` — understand in 5 seconds?
**Verdict: mostly yes (open polish).**

- Loading state is a quiet `对照`, then the dual pane appears.
- Eyebrow, title, and lead say the code on the right follows the paragraph you read.
- Layout alone (prose | bridge | code) communicates the product in seconds.
- Screenshot: `audit-shots/01-home.png`

**Friction:** sample is Chinese-first; README is English. Seeable ritual, unreadable lead for EN-only users.

### 2. Scroll / anchors / reverse
**Verdict: works (open: small a11y).**

- Scroll advances passage; code + bridge follow (`02-scrolled.png`).
- Anchor hover/pin/Esc work (`02b`, `02c`).
- Reverse click from glossed line pins after scroll (`02d`, `02e`).

**Friction:** reverse is mouse-only; glossed lines not keyboard-activatable.

### 3. `/?project=does-not-exist`
**Verdict: clear + recoverable.**

- Title names the missing id; hint shows real path under projects root.
- Lists other projects as links; `返回` goes home (`03-missing-project.png`).

**Friction:** notice has no wordmark — feels unbranded.

### 4. Empty GLOSS_PROJECTS_DIR
**Verdict: clear.**
- Title says no projects; hint shows path; tip explains layout; no silent sample.
**Friction:** Back link reloads same notice (no-op).

### 5. Missing / not-a-directory GLOSS_PROJECTS_DIR
**Verdict: clear; no silent sample.**
- Missing and not-directory notices show path + tip (05-missing-dir.png, 05d-not-directory.png).
- Named projects also get the dir notice, never shortly.
**Friction:** Back link no-op.

### 6. Preview / dev without API
**Verdict: mostly honest.**
- Home and project=shortly show bundled sample when API is down.
- Other project ids show API-not-running notice plus recovery command (06c-no-api-other.png).
**Friction:** source=sample is unused; UI looks live while serving a frozen fixture.

### 7. Mobile / narrow / mid width
**Verdict: mid OK; narrow painful.**
- 1440 good; 1320 rail gone; 1100 readable; 900 tight; 700 prose ~212px nearly unusable; ~480 probe visibility failures.
- CSS only shrinks; never stacks or warns. No Contents substitute below 1320px.
- Screenshots: 07-w*.png, 07-narrow-*.png

### 8. README to working session
**Verdict: yes.** Two commands: install deps, then start dev:all. Optional projects dir env. Node 20+ noted.

---

## Module review (user-facing smells)

### src/reader/*
- Sync / pin / reverse are solid under probe.
- Rail label Contents is English amid Chinese chrome.
- load source never reaches Masthead/Reader — missed honesty chip.
- API warnings never reach the reader (README admits Not yet) — authors can miss broken anchors.

### src/lib/load*.ts
- Policy clear and tested; empty/missing/not-directory/unreachable behave as designed.
- Falls back to literal GLOSS_PROJECTS_DIR/... when catalog.root absent (only hurts stale API).

### server/*
- inspectRoot + rootStatus on health/list is the right shape.
- Long-lived tsx without restart can serve stale handlers after pull — restart footgun, not a logic defect.

### check:gloss / validate
- examples: 1 gloss, 37 refs, 0 problems.
- Shared validate.ts with API warnings — good SSOT.

### Packaging / docs
- README matches fallback and preview:all behaviour.
- Narrow viewports are not a goal yet is honest but leaves users without an in-product hint.

---

## Issue list (severity to proposed fix)

### Blocker
None for the designed desktop ritual. Reading on >=1100px with dev:all feels solid.

### High

1. **[H1] Narrow viewport silently ruins reading** — below ~1000px prose collapses (~212px at 700) with no message.
   **Fix:** below ~1000px show a calm full-page notice (对照需要更宽的窗口 · ≥1100px). Prefer notice over stacking for v1 so the ritual stays honest.

2. **[H2] Contents vanish below 1320px with no replacement** — chapter navigation becomes pure scroll.
   **Fix:** compact chapter control in the masthead when the rail is hidden.

### Medium

3. **[M1] Sample fallback looks identical to live API** — source===sample unused.
   **Fix:** quiet masthead chip 示例 when loading from fixture.

4. **[M2] Notice back link is a no-op on empty / missing / not-directory**.
   **Fix:** hide back unless it helps (keep for not-found / unreachable).

5. **[M3] Broken anchors invisible while reading** — API warnings ignored by UI.
   **Fix:** one-line strip under masthead when warnings.length > 0; do not block reading.

6. **[M4] Notice screens feel unbranded** — no wordmark.
   **Fix:** small Gloss · 对照 wordmark above the notice title.

### Low

7. **[L1] Rail label Contents vs Chinese chrome** — use 目录 or bilingual.
8. **[L2] Glossed code lines not keyboard accessible.**
9. **[L3] English README to Chinese-only first sample** — optional EN subtitle; defer if it fights voice.
10. **[L4] Very narrow (~480) failures** — covered by H1 gate.

---

## Phase 3 status (update after fixes)

| id | status | notes |
|----|--------|-------|
| H1 | fixed | Below 1000px: full-page notice「对照需要更宽的窗口 · ≥ 1100px」. Dual pane stays at ≥1000. |
| H2 | fixed | Compact `<select>` in the masthead when the rail hides (`max-width: 1320px`). |
| M1 | fixed | Quiet `示例` chip when `source === "sample"`. |
| M2 | fixed | `返回` only for not-found and unreachable; hidden on empty / no-dir. |
| M3 | fixed | One-line sticky strip under the masthead; reading is not blocked. |
| M4 | fixed | Gloss · 对照 wordmark above notice titles (including the viewport gate). |
| L1 | fixed | Rail label is 目录; aria-label stays 章节. |
| L2 | fixed | Round 4: glossed lines are keyboard-activatable (role=button, Enter/Space). |
| L3 | deferred | voice choice; do not rush |
| L4 | fixed | Covered by the H1 gate. |

---

## Screenshot index

- 01-home.png — first open
- 02-scrolled.png — scroll sync
- 02b-anchor-hover.png / 02c-pinned.png — anchor pin
- 02d-code-hover.png / 02e-reverse-click.png — reverse
- 03-missing-project.png — missing project
- 05-missing-dir.png / 05d-not-directory.png — bad projects dir
- 06-no-api-home.png / 06c-no-api-other.png — API down
- 07-w*.png / 07-narrow-*.png — width ladder

---

## Fix priority for Phase 2 (Grok Build)

Do **H1, H2, M1, M2, M4** first (user-visible, small diffs, no architecture churn). **M3** if still inside budget (thread warnings from load to Reader). Defer L2/L3.

Keep architecture. Conventional commits on feature/gloss-reader-v1. No push. Run the project check script before finishing.


## Phase 3 re-test (executor, after Grok)

- Project check script: typecheck + gloss check (37 refs, 0 problems) + 63/63 tests green.
- Home 1440: bridge + focus OK; sample chip absent when API live (correct).
- Scroll to chapter 2 / index.ts; reverse click pins.
- Missing project: wordmark + path + shortly link + back.
- Width: 1320 chapter select on / rail off; at 999px gate shows wider-window notice (retest/07-w999.png).
- API down: masthead shows sample chip (retest/06-sample-chip.png); other project gets API notice + back.
- Remaining open after Phase 3: L1 (fixed in Round 2). Deferred: L2 keyboard reverse, L3 EN sample subtitle.
- Desktop journeys feel solid; mobile intentionally gated — not claiming publish-done.


---

## Round 2 — deeper journeys (2026-09-06 UTC+8)

Probed at http://127.0.0.1:5173 with live API (`GLOSS_PROJECTS_DIR=/tmp/gloss-projects` for fixtures `audit-many`, `audit-long`, `audit-bad`) and production preview at http://127.0.0.1:4173. Screenshots: `audit-shots/round2/`.

### Journey notes

1. **First-time (README → open)** — Essay lead already says the code follows the passage. No separate in-chrome “what next” tip; pin/`Esc` only appear after the first pin. Acceptable for v1; do not bolt on a tour.
2. **Pin then scroll** — Pin holds through prose scroll; code-pane chip `已固定 Esc 释放` stays visible; global `Esc` works even when focus is on the wordmark. Bridge hides after a few pixels of scroll (intentional). Masthead shows `已固定` without `Esc` (chip carries the hint).
3. **Many chapters (14)** — At 1440×900 all rail items fit. At 1440×700 last chapters clip and `.rail { overflow: hidden }` prevents scrolling (`03d-many-short.png`). Mid-width chapter `<select>` works and jumps correctly; chapter label hides when select shows.
4. **Long code line** — Horizontal overflow works; focus wash remains. **Line numbers scroll away** with the text (`04b-long-hscroll.png`) — easy to lose place.
5. **Warning strip (real broken gloss)** — Shows `2 处锚点无法落到代码` (count collapse). Readable as a presence signal; **contrast ~3.2:1** on paper (ink-3) — too soft for a warning. Detail list not expandable (deferred).
6. **Keyboard** — Tab reaches wordmark → rail buttons → anchors. `Esc` unpins globally. Glossed code lines still mouse-only (L2 deferred). No focus trap found.
7. **Contrast / fatigue** — Prose measure and leading still calm. Soft chrome (`ink-4` rail label ~2:1, meta ~2:1) is intentional whisper; warning strip should not whisper.
8. **`preview:all` / vite preview:4173** — Same shortly session as dev (focus + bridge). Warnings and missing-project notices behave. Not worse than dev for these paths (404 console on missing project is the API response).

### Round 2 issues

| id | sev | status | issue | proposed fix |
|----|-----|--------|-------|--------------|
| L1 | must | fixed | Rail label still `Contents` amid Chinese chrome | Visible label is 目录; `aria-label` stays 章节; dropped uppercase on the label |
| R2-3a | medium | fixed | Many chapters clip; rail not scrollable | `.rail { overflow-x: hidden; overflow-y: auto }` + thin quiet scrollbar |
| R2-4a | medium | fixed | Line numbers leave the pane on horizontal scroll | sticky `.line__num` with opaque paper/wash; accent `::before` on the number so it stays |
| R2-7c | medium | fixed | Warning strip contrast ~3.2:1 | strip text is `--ink-2` (~7.9:1); still one line |
| R2-1 | low | deferred | No first-open ritual tip beyond essay lead | leave; lead is enough |
| R2-2b | low | deferred | Masthead `已固定` omits Esc | chip already teaches Esc |
| R2-2e | low | deferred | Bridge drops while pinned | intentional; do not fight sync |
| R2-5c | low | deferred | Multi-warning count-only strip | optional expand later |
| R2-6c / L2 | low | deferred | Glossed lines not keyboard-activatable | keep deferred |
| R2-7d | low | deferred | Rail label whisper contrast | fine for label; fixed copy is enough |

### Round 2 fix priority (Grok Build)

Do **L1, R2-3a, R2-4a, R2-7c**. Leave lows deferred. Conventional commits on `feature/gloss-reader-v1`. No push. Re-test with fixtures; run full check.

## Round 2 re-test (Grok Build)

- Project check: typecheck + gloss check (37 refs, 0 problems) + 63/63 tests green.
- L1: shortly rail label is `目录`; `aria-label="章节"`.
- R2-3a: audit-many at 1440×700 — last chapter starts clipped; `rail.scrollTop` brings 十四 into view (`audit-shots/round2/retest/03e-many-scrolled.png`).
- R2-4a: audit-long h-scroll — `.line__num` stays flush to the pane left; focus accent remains; `white-space: pre` kept (`04b-long-hscroll.png`).
- R2-7c: audit-bad strip still one line (32px); text `--ink-2` contrast ~7.9:1 vs paper.
- Regressions probed: shortly pin + reverse click; 1200px chapter `<select>`; 999px width gate; missing-project wordmark + back.
- Still deferred: L2 keyboard reverse, L3 EN sample subtitle, R2-1 / R2-2b / R2-2e / R2-5c / R2-6c / R2-7d.
- Not claiming publish-done.


## Round 2 executor verify (after Grok)

Independent Playwright against fixtures (`GLOSS_PROJECTS_DIR=/tmp/gloss-projects`):
- L1 label `目录`; sync after scroll still moves chapter/file/focus with `code.style.top` (transform none).
- Pin + Esc OK; many-rail scroll reaches chapter 14 at 700px height.
- Long-line h-scroll: sticky numVisible; warn strip contrast ~7.91.
- Shots: `audit-shots/round2/verify/`. Full check: typecheck + 37 refs/0 problems + 63/63 tests.
- Still iterating: deferred lows remain; not claiming finished.


## Round 3 — user-shoes by module (2026-09-06 UTC+8)

Probed at http://127.0.0.1:5173 with live API (`GLOSS_PROJECTS_DIR=/tmp/gloss-projects` for `shortly`, `audit-many`, `audit-long`, `audit-bad`) plus temporary APIs for empty / relative / missing / file-as-dir roots. Screenshots: `audit-shots/round3/` (untracked).

### Journey notes

1. **Onboarding / wrong path copy** — Notices already show the *resolved absolute* path. Relative `./foo` and `glosses` become `$PWD/…` and say 找不到项目目录. A file path says 项目路径不是一个目录 and names the file. Empty `GLOSS_PROJECTS_DIR=""` was **cwd**, not the README default `examples/` — the table implied unset and blank were the same. Tip said “指向一个文件夹” without “绝对路径”.
2. **Pin + Esc** — Code-pane chip `已固定 Esc 释放` is still the primary teacher. Masthead was only `已固定`. Quiet `Esc` kbd added beside it; chip unchanged. No tour.
3. **Catalog** — Missing-project links (`/?project=<id>`) all 200; click opens the project. After API restart onto a missing root, a stale listed link reloads to 找不到项目目录 (honest, not a blank/dead page). Empty dir / missing dir / not-a-directory still honest; 返回 still hidden on empty / no-dir.
4. **Performance** — `audit-long` vertical scroll spam ~16ms frames (max 17, 0 over 32ms); horizontal long-line scroll fine. No sync rewrite.
5. **A11y** — Tab order: wordmark → rail → anchors; chapter `<select>` at mid width; pin chip is in tab order when visible. Wordmark used to paint a column-wide UA ring (`justify-self: stretch`). 朱 `:focus-visible` on wordmark / rail / pin / notices; wordmark hugs its text. `prefers-reduced-motion`: html scroll `auto`, code/bridge align off; chapter jump now uses `auto` too. Glossed code lines still mouse-only (L2).
6. **Docs** — README `dev:all` / `check` / `preview:all` match `package.json`. SHIP-REPORT still claimed warnings were not shown in the reader (stale since M3). No dead relative markdown links.

### Round 3 issues

| id | sev | status | issue | proposed / done |
|----|-----|--------|-------|-----------------|
| R3-1a | medium | fixed | Blank `GLOSS_PROJECTS_DIR` was cwd, not repo `examples/` | `projectsRoot()` treats unset **or blank** as `examples/` |
| R3-1e | low | fixed | no-dir tip did not say absolute path | 「把 GLOSS_PROJECTS_DIR 设成文件夹的绝对路径」; README says cwd-resolve, prefer absolute |
| R3-5d | medium | fixed | Wordmark focus ring spanned the masthead column | `.wordmark { justify-self: start }` + 朱 ring |
| R3-5a | low | fixed | Rail / pin / notice used UA rings or none | 朱 `:focus-visible` to match anchors |
| R3-5c | low | fixed | Chapter `scrollIntoView({smooth})` ignored reduced motion | `auto` when `prefers-reduced-motion: reduce` |
| R2-2b | low | fixed | Masthead `已固定` omitted Esc | Quiet `<kbd>Esc</kbd>` next to the label; chip stays primary |
| R2-5c | low | fixed | Multi-warn strip was count-only | Click-expand overlay under the one-line strip |
| R3-3 | — | ok | Catalog links live; stale-after-restart recovers honestly | no code change |
| R3-4a | — | ok | audit-long scroll not janky | no sync rewrite |
| R2-1 | low | deferred | No first-open in-chrome tip | essay lead already says the code follows; no tour |
| L2 / R2-6c | low | deferred | Glossed code lines not keyboard-activatable | leave; do not rush reverse a11y |
| L3 | low | deferred | EN sample subtitle | voice choice |
| R2-2e | low | deferred | Bridge drops while pinned after scroll | intentional |
| R2-7d | low | deferred | Rail label whisper contrast | fine for a label |

### Round 3 re-test

- Project check: typecheck + gloss check (37 refs, 0 problems) + **65/65** tests green.
- Blank env → API root is repo `examples/`; `/` opens shortly, not a cwd-empty notice.
- Relative `./foo`: title 找不到项目目录, hint `/…/foo`, tip names 绝对路径.
- File-as-dir `/etc/hosts`: 项目路径不是一个目录 + path + same tip.
- Pin: masthead `已固定 Esc`; chip `已固定 Esc 释放`; Esc unpins. Mid-width (1200) not cluttered next to the chapter select.
- audit-bad: strip stays 32px, centered, caret; click lists both warnings; click again collapses; header height unchanged.
- Wordmark focus ~103px wide, 朱; rail 朱 ring. Catalog links still work.
- Still deferred: L2, L3, R2-1, R2-2e, R2-7d.
- Not claiming publish-done.


---

## Round 4 — dig harder from user shoes (2026-09-06 UTC+8)

Probed at http://127.0.0.1:5173 with live API (`GLOSS_PROJECTS_DIR=/tmp/gloss-projects` for `shortly`, `audit-many`, `audit-long`, `audit-bad`) plus temporary APIs for spaces / `~/` / whitespace / Windows-style roots. Screenshots: `audit-shots/round4/` (untracked).

### Journey notes

1. **Home/path — weird inputs** — Spaces in the folder name work (`/tmp/gloss with spaces` opened `mini`). Trailing slash normalizes. Leading/trailing whitespace around a valid absolute path was **not** trimmed: `"  /tmp/gloss-projects  "` became `$PWD/  /tmp/gloss-projects  ` and the notice showed that fake path. Quoted `~/gloss-r4-tilde` was cwd-prefixed to `$PWD/~/gloss-r4-tilde` (shell-unexpanded `~` is a real footgun; README examples use `~/`). A Windows drive path pasted on Linux was likewise buried under `$PWD/C:/…`. Tip still said “绝对路径” without naming Windows. Cheap honest fixes: trim, expand `~` / `~/`, leave drive/UNC paths as pasted, and a calm Windows tip. Do not invent WSL conversion.

2. **Reading — long session + mid width** — After pinning and scrolling every chapter at 1440, masthead stayed one line (wordmark · shortly · tagline · 已固定 Esc · chapter). At 1150 and 1100, chapter label hides, `<select>` appears, pin + select sit together with ~245px gap; no overflow. Warn strip lives under the masthead, not inside it. No masthead redesign.

3. **Code pane — selection / copy / highlight** — `user-select` is `auto` on line text (`none` only on numbers). Programmatic select + `execCommand('copy')` works. A drag across a glossed line selected the text and did **not** pin (Chrome withholds click after a real drag). Still cheap to ignore click when the selection is a Range, so a smaller drag cannot reverse-pin by accident. Hover on a glossed line lights the matching anchor and the ↩ hint; leaving to the title clears both. Unpin clears the pin chip. Chapter jump from a hovered line does not leave a stale hover on the new file. (After unpin with the pointer still on a prose anchor, `is-hover` / `is-focus` on that span is expected, not a leak.)

4. **Prose — very long paragraph** — Token `--prose-measure: 612px`; longest shortly passage ~544px at 1440 (~32 CJK chars at 17px, leading 1.9, justify). At 1150 the same passage is ~430px — tighter wrap, still readable. Not clearly uncomfortable; no measure tweak.

5. **Sample vs real** — API live on shortly from `examples/` (via `/tmp/gloss-projects/shortly`): no 示例 chip. API down on `/` and `?project=shortly`: chip `示例` visible, tagline hidden by `:has(.masthead__chip)`. Other id: `API 未运行` + `npm run dev:all` + 返回. Remaining chrome (eyebrow 对照笔记, dual pane) is the product, not a live-disk lie.

6. **Docs** — README already said blank env → `examples/` and described the warn strip. SHIP-REPORT still said 60 tests, blank env → empty-dir notice, and “chrome untouched”. Aligned both; kept local-first, no publish-done claim.

7. **L2 vs L3** — L2 is a small, clean diff (role=button, tabIndex=0, Enter/Space, keep mouse path, 朱 `:focus-visible`, calm `aria-label` 第 n 行，回到正文). L3 (EN subtitle on the Chinese lead) would fight voice; left deferred.

8. **R1–R3 smoke** — Narrow gate at 999, 目录 rail, sticky nums, Esc unpin + masthead Esc, warn expand, 1200 chapter select, 朱 wordmark: still green. Probe crashed on `.wordmark` matching both the hidden viewport-notice mark and the session link — locator issue, not a product bug.

### Round 4 issues

| id | sev | status | issue | proposed / done |
|----|-----|--------|-------|-----------------|
| R4-1c | medium | fixed | Whitespace around a valid path was not trimmed; notice showed `$PWD/  /tmp/…` | `resolveProjectsDir` trims before resolve |
| R4-1d | medium | fixed | Quoted `~/…` cwd-prefixed, notice looked like a missing real folder | expand `~` and `~/` to homedir |
| R4-1e | low | fixed | Windows drive path cwd-prefixed; tip did not name Windows | leave drive/UNC as pasted; tip 「这是 Windows 路径；请改成当前系统上的绝对路径」 |
| R4-1a | — | ok | Spaces in path | no change |
| R4-1b | — | ok | Trailing slash already normalized | no change |
| R4-2 | — | ok | Mid-width pin + chapter select not cramped | no masthead CSS |
| R4-3a | — | ok | Code text is selectable / copyable | `user-select: auto` |
| R4-3b | low | fixed | Drag-select on a glossed line could still reverse-pin on a small drag | click no-ops when the selection is a Range |
| R4-3d | — | ok | Hover clears on leave; unpin / chapter jump do not leak | no sync rewrite |
| R4-4 | — | ok | Long paragraph measure comfortable at 1440; tighter but readable at 1150 | no measure tweak |
| R4-5 | — | ok | 示例 chip honest (present iff sample; absent when API live) | no change |
| R4-6 | low | fixed | SHIP-REPORT vs README: test count, blank env, chrome “untouched” | docs aligned; local-first |
| L2 / R2-6c | low | fixed | Glossed lines mouse-only | role=button, tabIndex=0, Enter/Space, 朱 focus ring |
| L3 | low | deferred | EN sample subtitle | would fight Chinese-first voice |
| R2-1 | low | deferred | No first-open in-chrome tip | essay lead already says the code follows |
| R2-2e | low | deferred | Bridge drops while pinned after scroll | intentional |
| R2-7d | low | deferred | Rail label whisper contrast | fine for a label |

### Round 4 re-test

- Project check: typecheck + gloss check (37 refs, 0 problems) + **67/67** tests green.
- Whitespace around `/tmp/gloss-projects` opens shortly; hint is the real absolute path.
- `~/…` (quoted) expands to `$HOME/…` and opens when that folder exists.
- `C:/Users/foo/glosses` notice: hint is the pasted drive path (not `$PWD/C:/…`); tip names Windows.
- Spaces in path and trailing slash still open.
- Glossed line: Tab focuses (朱 number tick + wash); Enter/Space reverse-pin after the same scroll-settle as a mouse click; drag-select copies text and does not pin.
- Mid-width 1150 pin + select: no overflow. Long passage measure unchanged.
- Sample chip: absent with live API on shortly; present when API down on `/`.
- R1–R3: 999 gate, 目录, sticky nums, Esc whisper, warn expand, 1200 select, 朱 wordmark.
- Still deferred: L3, R2-1, R2-2e, R2-7d.
- Not claiming publish-done.


---

## Round 5 — reading ritual + onboard (2026-09-06 UTC+8)

Read-only probe at http://127.0.0.1:5173 with live API (`GLOSS_PROJECTS_DIR=/tmp/gloss-projects` for `shortly`, `audit-many`, `audit-long`, `audit-bad`). Authoritative notes: `audit-shots/round5-reading/FINDINGS.md` and `audit-shots/round5-onboard/findings.json`. Write pass: Grok Build on `feature/gloss-reader-v1`. Screenshots: `audit-shots/round5-reading/` (probe) and `audit-shots/round5/retest/` (after fix). Not claiming publish-done / ship-ready.

### Journey notes

1. **Pin / unpin / Esc** — Before first pin, no Esc chrome. After pin: masthead `已固定 Esc` plus code chip `已固定 Esc 释放`. Esc, chip click, and second click on the same anchor all unpin. Duplicate Esc teachers (R5-3) are mild chrome noise; left as intentional redundancy after Round 3.
2. **Scroll sync + reverse** — Unpinned sync still moves `code.style.top`, chapter, and file. Reverse mouse and L2 keyboard (Enter/Space on `.line.has-gloss`) pin after scroll settle. Hover hint `L… · 回到正文 ↩` is honest about the span. Narrowest-span reverse (`hitAtLine`) is unchanged.
3. **Chapter rail + mid-width select** — @1440 rail `目录` + 8 items; @≤1320 rail hides and masthead `<select>` appears. Pin + select still fit through 1100. **Ritual break before the write pass:** jumping chapter while pinned kept the old pin (new prose, frozen old span).
4. **Fatigue** — Prose 17px / 1.9 / ~612px still calm after a chapter tour. Remaining edges are local (dual Esc, rail whisper, chip occlusion, bridge-while-pinned).
5. **Onboard / first open `/`** — Catalog is sorted by id. Bare `/` on a multi-project root opens the first listed id (`audit-bad` on the audit fixture), not shortly. A warn strip and empty code pane on first open (R5-1b) are that project's broken gloss, not a silent sample. Cheap honesty: docs say so and tell readers to use `?project=shortly`. Product catalog order unchanged. (Round 4 re-test's “`/tmp/gloss-projects` opens shortly” was a named shortly session, not bare `/`.)

### Round 5 issues

| id | sev | status | issue | proposed / done |
|----|-----|--------|-------|-----------------|
| R5-1 | medium | **fixed** | Chapter jump (rail or mid-width select) while pinned kept the old pin: prose moved, code frozen on the previous span | `unpin()` at the start of `onSelectChapter` (same handler for rail + select) |
| R5-2 | medium | **fixed** | `server.ts` L18 reverse preferred chapter 八 (`#L18` one-liner) over chapter 一 `L18–59` | shortly gloss: chapter 八 缩短接口 is now `src/server.ts#L19-L30` (handler body). `hitAtLine` untouched. L18 → 一; L19 → 八 |
| R5-1a | medium | **docs** | Bare `/` opens the alphabetically-first catalog id (can be `audit-bad`), not shortly | README, SHIP-REPORT, `load.ts` comment: catalog sorted by id; first listed id opens with no query; use `?project=shortly` for a specific project. No product reorder, no shortly preference |
| R5-1b | medium | deferred | First-open can show warn strip / empty code pane | follows from first-id default when that project is broken; use the query |
| R5-1c | low | deferred | No first-open in-chrome tip | same as R5-4 / R2-1 |
| R5-3 | low | deferred | Esc taught twice (masthead + chip) | chip stays primary; masthead whisper stays from R3 |
| R5-3e | low | deferred | Empty hint uses a literal id placeholder | copy polish |
| R5-4 | low | deferred | No in-chrome pin/Esc tip before first pin | same as R2-1; essay lead is enough |
| R5-5 | low | deferred | Bridge drops after a few px of pinned prose scroll | R2-2e; do not fight sync |
| R5-5e | low | deferred | `$HOME` in the env is not expanded; tip stays generic | leave; prefer an absolute path |
| R5-6 | low | deferred | Rail label `目录` whisper contrast | R2-7d |
| R5-6b | low | deferred | Split `api`+`dev` needs a `GLOSS_API` whisper in README | `dev:all` is the documented path |
| R5-6f | — | note | README localhost vs loopback mix | harmless |
| R5-7 | low | deferred | Pin chip can cover the last visible code lines | polish only if users complain |
| R5-8 | — | ok | L2 keyboard reverse still present | closed in Round 4 |
| R5-9 | — | ok | Unpinned scroll sync; pin holds code | no change |
| R5-10 | — | ok | Mid-width pin + select; 999 gate | R4-2 still holds |
| R5-11 | — | ok | ~2 min reading fatigue | no redesign |
| R5-12 | — | ok | Pin via prose; unpin via Esc / chip / toggle | no change |
| L3 | low | deferred | EN sample subtitle | would fight Chinese-first voice |

### Round 5 re-test (Grok Build)

- Project check: typecheck + gloss check (37 refs, 0 problems) + **68/68** tests green (one new shortly reverse-index assertion).
- **R5-1 rail @1440:** pin chapter 一 `L18–59` → rail 五 存下来 → pin/chip/masthead Esc clear; code follows `store.ts` L29 (`03-rail-while-pinned.png`).
- **R5-1 select @1200:** pin → `<select>` 四 短码从哪里来 → pin clears; code follows `slug.ts` L1 (`05-select-while-pinned.png`).
- **R5-2:** hover on `server.ts` L18 hints `L18–59 · 回到正文`; click reverse-pins chapter 一 `三个 HTTP 接口` / span `L18–59`. L19 reverse still reaches chapter 八 / `L19–30`.
- **R5-1a:** README / SHIP-REPORT / `load.ts` comment state the catalog is sorted by id; first listed id opens with no `?project=`; use `?project=shortly` for the sample. Product list order unchanged (`readdirSync(root).sort()`).
- Smoke: Esc unpin; L2 Enter reverse-pin; 1100 pin + select no overflow; 999 gate 「对照需要更宽的窗口」.
- Still deferred: R5-3 dual Esc, R5-4 / R2-1 / R5-1c first-open tip, R5-5 / R2-2e bridge, R5-6 / R2-7d rail whisper, R5-7 chip occlusion, L3, R5-1b first-open warn/empty on a broken first id, R5-3e empty-hint placeholder, R5-5e `$HOME` in tip, R5-6b `GLOSS_API` whisper. Note: R5-6f localhost vs loopback.
- Local-only. No push, no merge to main. Not claiming publish-done.


---

## Round 6 — user-perspective polish (2026-09-06 UTC+8)

Probed at http://127.0.0.1:5173 with live API (`GLOSS_PROJECTS_DIR=/tmp/gloss-projects` for `audit-bad`, `audit-long`, `audit-many`, `shortly`) plus temporary APIs for empty / single / relative own-dirs. Playwright shots: `audit-shots/round6/` and `audit-shots/round6/retest/` (untracked). Write pass: Grok Build on `feature/gloss-reader-v1`. Not claiming publish-done / ship-ready.

### Journey notes

1. **R5-1b first-open `/`** — Catalog is still sorted by id. Bare `/` opens `audit-bad`: warn strip `2 处锚点无法落到代码`, code pane `没有可对照的文件` (current passage faces a missing file). Docs already said first listed id; the screen itself did not. Wordmark from `?project=shortly` lands on the same home. Product order unchanged; no shortly preference, no redirect. Cheap honesty: when there is no `?project=` *and* the strip is showing, a quiet extra `目录第一项 · 用 ?project=<id> 指定`. Explicit `?project=audit-bad` keeps the real warnings and omits the hint.

2. **Packing / publish** — `npm pack --dry-run` ships 41 files (reader, server, examples, tests, LICENSE, README). No `bin` (README uses `npm run`). Engines Node 20+ match. `package.json` `files` listed `package-lock.json`, but npm never puts the lockfile in the tarball — extract + `npm install` floats ranges. Clone is the pinned path. Removed the lockfile from `files`; README/SHIP-REPORT say so.

3. **Check cmds** — Default `check:gloss` on this repo is still `1 gloss checked, 37 refs, 0 problems`. Tests 69/69 after the hint constant. `GLOSS_PROJECTS_DIR=/tmp/gloss-projects npm run check:gloss` fails on audit-bad (2 problems) — honest for the CLI. The same env used to make `npm run check` fail, while docs treated check as the product self-check. `npm run check` now runs `GLOSS_PROJECTS_DIR= npm run check:gloss` so it always validates `examples/`. Own folders stay `npm run check:gloss -- ~/glosses`. SHIP-REPORT does not hard-code the test count.

4. **Own-dir** — Empty root lists zero projects (`rootStatus: ok`). Single project `mini` is the catalog default. Relative `GLOSS_PROJECTS_DIR` becomes an absolute `catalog.root`. Missing relative path is cwd-resolved `missing`. Reload after editing `gloss.md` picks up the new tagline. Empty-notice hint still uses a literal `<id>` placeholder (R5-3e, still low).

5. **Long-session chrome** — Pin + chapter tour: masthead stays 56px. @1320/1200/1100 pin + chapter `<select>` do not overflow. @999 gate 「对照需要更宽的窗口 · ≥ 1100px」. Warn strip keyboard: Tab to the count, Enter expands both warnings, Enter again collapses; hint stays. Esc unpins (class `is-visible`, not opacity mid-fade). Pin chip can still cover the lower code viewport (R5-7); focused span starts at the reading line, so it is polish, not a ritual break.

6. **A11y leftovers** — Focus order at 1440: wordmark → warn strip → rail → anchors. @1200: wordmark → chapter `<select>` (visually-hidden label `章节`) → prose. Warn strip is a native button when expandable. L2 keyboard reverse not reopened.

### Round 6 issues

| id | sev | status | issue | proposed / done |
|----|-----|--------|-------|-----------------|
| R5-1b | medium | **fixed** | Bare `/` (and wordmark home) can open a broken first id with warn strip + empty code pane and no in-chrome explanation that this is the catalog default | Quiet `目录第一项 · 用 ?project=<id> 指定` on the existing warn strip when `?project=` is absent. Warnings stay. No reorder, no shortly hardcode, no redirect |
| R6-1 | medium | **fixed** | `npm run check` inherited `GLOSS_PROJECTS_DIR` and failed on the audit fixture while docs described a green examples self-check | `check` script runs `GLOSS_PROJECTS_DIR= npm run check:gloss`; CLI + env still check own folders |
| R6-2 | medium | **fixed** | `files` listed `package-lock.json` but `npm pack` omits it — extract+install is unpinned | Drop lockfile from `files`; README/SHIP-REPORT: pack is source without a lockfile; clone for the pin; no `bin` |
| R6-3 | — | ok | Own-dir empty / single / relative / reload | no product change |
| R6-4 | — | ok | Mid-width pin+select; 999 gate; chapter tour; warn expand | no chrome redesign |
| R6-5 | — | ok | Warn strip keyboard; chapter select label `章节` | no change |
| R5-3 | low | deferred | Esc taught twice (masthead + chip) | chip stays primary |
| R5-4 / R2-1 / R5-1c | low | deferred | No in-chrome pin/Esc tip before first pin | essay lead is enough; R5-1b is a different tip |
| R5-5 / R2-2e | low | deferred | Bridge drops after a few px of pinned prose scroll | do not fight sync |
| R5-6 / R2-7d | low | deferred | Rail label `目录` whisper contrast | fine for a label |
| R5-7 | low | deferred | Pin chip can cover the last visible code lines | still polish; focused span is aligned to the reading line |
| R5-3e | low | deferred | Empty hint uses a literal `<id>` placeholder | copy polish |
| R5-5e | low | deferred | `$HOME` in the env is not expanded; tip stays generic | prefer an absolute path |
| R5-6b | low | deferred | Split `api`+`dev` needs a `GLOSS_API` whisper in README | `dev:all` is the documented path |
| L3 | low | deferred | EN sample subtitle | would fight Chinese-first voice |

### Round 6 re-test (Grok Build)

- Project check with `GLOSS_PROJECTS_DIR=/tmp/gloss-projects`: typecheck + gloss check (`1 gloss checked, 37 refs, 0 problems`) + **69/69** tests green (one new `CATALOG_DEFAULT_HINT` assertion). Standalone `GLOSS_PROJECTS_DIR=/tmp/gloss-projects npm run check:gloss` still reports audit-bad's 2 problems.
- **R5-1b @1440:** `/` strip is `2 处锚点无法落到代码 · 目录第一项 · 用 ?project=<id> 指定` (`retest/01-bare-home.png`). `?project=audit-bad` has the count only (`01b-explicit-audit-bad.png`). Wordmark from shortly still opens audit-bad, now with the hint (`02b-wordmark-home.png`). Hint still visible at 1100 (`03-w1100-hint.png`).
- Smoke: shortly live, no sample chip, no warn; Esc unpins; @1200 pin + select, no overflow, label `章节`; @999 gate; warn strip Enter expand/collapse with hint still in the button.
- Pack: `files` no longer lists `package-lock.json`; dry-run still has index.html, src, server, examples, tests.
- Still deferred: R5-3 dual Esc, R5-4 / R2-1 / R5-1c first-open pin tip, R5-5 / R2-2e bridge, R5-6 / R2-7d rail whisper, R5-7 chip occlusion, L3, R5-3e empty-hint placeholder, R5-5e `$HOME` in tip, R5-6b `GLOSS_API` whisper. Note: R5-6f localhost vs loopback.
- Local-only. No push, no merge to main. Not claiming publish-done.


---

## Round 7 — user-perspective polish (2026-09-06 UTC+8)

Probed at http://127.0.0.1:5173 with live API (`GLOSS_PROJECTS_DIR=/tmp/gloss-projects` for `audit-bad`, `audit-long`, `audit-many`, `shortly`) plus temporary APIs for empty / single / relative / project-as-root / invalid-id own-dirs. Pack path: `npm pack` → `tar xf` → `package/` → `npm install` → `check` / `build` / vite+API on free ports. Playwright shots: `audit-shots/round7/` and `audit-shots/round7/retest/` (untracked). Write pass: Grok Build on `feature/gloss-reader-v1` @ `90dec78` plus this round's commits. Paths/notice split was not reopened. Not claiming publish-done / ship-ready.

### Journey notes

1. **R6 still holds** — Bare `/` opens `audit-bad` with `目录第一项 · 用 ?project=<id> 指定`. Explicit `?project=audit-bad` is count-only. `GLOSS_PROJECTS_DIR=/tmp/gloss-projects npm run check` stays on `examples/` (`1 gloss checked, 37 refs, 0 problems`); the same env on `check:gloss` still reports audit-bad's 2 problems. `package.json` `files` and `npm pack --dry-run` omit the lockfile.

2. **Packing extract → install → run** — Tarball has 42 files (reader, server, examples, tests, LICENSE, README, tsconfigs). No `bin`, no lockfile. Extract + `npm install` + `npm run check` + `npm run build` all green. A stranger vite+API on free ports lists `examples/shortly`. README extract command matches. **Engines were a lie:** `package.json` said `>=20` while Vite 8.2 requires `^20.19.0 || >=22.12.0`. Cheap honesty: pin engines to that range; README/SHIP-REPORT say 20.19+ or 22.12+.

3. **Honesty leftovers** — Live shortly: no `示例` chip, no warn. API down on `/`: chip `示例`. Other id: `API 未运行` + `npm run dev:all` + 返回. L2 keyboard reverse and L3 EN subtitle not reopened. Docs vs pack (no lockfile, no bin, `check` pinned to examples) still match after R6.

4. **Own-dir daily** — Empty root, single `mini`, relative path → absolute `catalog.root`, reload after `gloss.md` edit: all still work. New footguns: pointing `GLOSS_PROJECTS_DIR` at a folder that already has `gloss.md` (lists zero children), and a sole `MyApp` folder (invalid id, skipped). Both showed `这个目录下没有项目` with a fake hint `…/<id>/gloss.md` (R5-3e). Cheap empathy, no API shape change: hint is the real root; tip names the child-folder + lowercase-id rule. README says not to point the env at the project itself.

5. **Long-session chrome** — Pin + chapter tour: masthead 56px. @1320/1200/1100 pin + `<select>` do not overflow. @999 gate. Warn strip Enter expand/collapse, catalog-default hint stays. Esc unpins. Pin chip can still cover later lines of a long focus span (R5-7); the reading line is higher up — still polish, not Med.

### Round 7 issues

| id | sev | status | issue | proposed / done |
|----|-----|--------|-------|-----------------|
| R5-1b | medium | **pass** (R6) | Bare `/` catalog-default hint | still green; not reopened |
| R6-1 | medium | **pass** (R6) | `npm run check` pinned to examples | still green with audit env set; CLI still sees audit-bad |
| R6-2 | medium | **pass** (R6) | pack omits lockfile | `files` and dry-run still omit it |
| R7-pack | — | ok | extract → install → check/build/dev-run | 42 files, no bin, no lockfile; stranger path works |
| R7-1 | medium | **fixed** | Empty catalog used a fake `…/<id>/gloss.md` hint; pointing at a project folder or an invalid id looked the same as a blank dir | Hint is the real `catalog.root`. Tip: `每个项目一个子文件夹（小写字母、数字、- 或 _），内含 gloss.md`. README: env is the outer folder, not the project itself. Promotes R5-3e. No catalog reorder, no auto-open |
| R7-2 | medium | **fixed** | Invalid folder id (`MyApp`) skipped → generic empty | same tip as R7-1 (id rule on the screen). `check:gloss` still prints the unservable id |
| R7-3 | medium | **fixed** | `engines` / README said Node 20+; Vite 8 needs 20.19+ or 22.12+ | `"node": "^20.19.0 \|\| >=22.12.0"`; README + SHIP-REPORT aligned |
| R7-chrome | — | ok | Mid-width pin+select; 999 gate; chapter tour; warn expand | no chrome redesign |
| R7-honesty | — | ok | sample chip / API-down notice / docs vs check-pack | no change |
| R5-3 | low | deferred | Esc taught twice (masthead + chip) | chip stays primary |
| R5-4 / R2-1 / R5-1c | low | deferred | No in-chrome pin/Esc tip before first pin | essay lead is enough |
| R5-5 / R2-2e | low | deferred | Bridge drops after a few px of pinned prose scroll | do not fight sync |
| R5-6 / R2-7d | low | deferred | Rail label `目录` whisper contrast | fine for a label |
| R5-7 | low | deferred | Pin chip can cover the last visible code lines | still polish; focused span is aligned to the reading line |
| R5-5e | low | deferred | `$HOME` in the env is not expanded; tip stays generic | prefer an absolute path |
| R5-6b | low | deferred | Split `api`+`dev` needs a `GLOSS_API` whisper in README | `dev:all` is the documented path |
| L3 | low | deferred | EN sample subtitle | would fight Chinese-first voice |

### Round 7 re-test (Grok Build)

- Project check: typecheck + gloss check (`1 gloss checked, 37 refs, 0 problems`) + **71/71** tests green (two new `noticeCopy` empty assertions).
- **R7-1 / R7-2:** empty / project-as-root / `MyApp` notices name the real folder (no `<id>`) and the child-id rule (`retest/01-empty.png`, `02-as-project.png`, `03-bad-id.png`).
- **R7-3:** `package.json` engines match Vite 8; README/SHIP-REPORT say 20.19+ or 22.12+.
- **R6 verify:** bare `/` hint; explicit audit-bad count-only; check pin; pack lockfile omitted.
- Smoke: shortly live, no sample chip; Esc unpins; @1200 pin + select, no overflow; @999 gate.
- Pack: extract + install + check + build + vite `/api/projects` → shortly.
- Still deferred: R5-3 dual Esc, R5-4 / R2-1 / R5-1c first-open pin tip, R5-5 / R2-2e bridge, R5-6 / R2-7d rail whisper, R5-7 chip occlusion, L3, R5-5e `$HOME` in tip, R5-6b `GLOSS_API` whisper. Note: R5-6f localhost vs loopback. R5-3e closed by R7-1.
- Local-only. No push, no merge to main. Not claiming publish-done.


---

## Round 8 — user-perspective polish (2026-09-06 UTC+8)

Probed at http://127.0.0.1:5173 with live API (`GLOSS_PROJECTS_DIR=/tmp/gloss-projects` for `audit-bad`, `audit-long`, `audit-many`, `shortly`) plus temporary APIs for empty / project-as-root / invalid-id / examples-only. Real API stop/restart on :8787. Playwright shots: `audit-shots/round8/` and `audit-shots/round8/retest/` (untracked). Write pass: Grok Build on `feature/gloss-reader-v1` @ `ccd1a33` plus this round's commits. Paths/notice split was not reopened. Not claiming publish-done / ship-ready.

### Journey notes

1. **R5–R7 still hold** — Pin then chapter jump (rail @1440 and select @1200) unpins; shortly L18 reverse stays on chapter 一 `L18–59`; @1100 pin+select no overflow; @999 gate. Bare `/` has `目录第一项 · 用 ?project=<id> 指定`; explicit `?project=audit-bad` is count-only; `npm run check` pins examples (`1 gloss checked, 37 refs, 0 problems`) while `check:gloss` with the audit env still reports audit-bad's 2 problems; pack dry-run omits the lockfile (42 files). Empty / project-as-root / `MyApp` notices name the real root and the child-id rule. Engines `^20.19.0 || >=22.12.0`. API down on `/` shows `示例`; other id is `API 未运行`. Esc unpins (`is-visible` clears).

2. **Fresh-user ritual** — Clone path (API on this repo's `examples/` only): `/` opens shortly, no sample chip, pin works. README Run had install + `dev:all` + the URL, but not `check`, and did not say this repo's `/` is shortly (that sentence lived later, next to the API-down sample fallback). Cheap docs: Run is install → check → `dev:all` → open the URL; this repo's `examples/` only has shortly; a multi-project folder still opens the first listed id — use `?project=`. No shortly hardcode, no catalog reorder.

3. **API stop / restart while reading** — Mid-session, with no reload, the loaded project stays (pin held, no sample flip). The page does not poll; that is honest, not a live connection. Reload while down on a named id is the unreachable notice. After the API is back, the notice stays until reload — reload of the same URL restores the asked project (pin is session state, gone). **Stranded:** the notice already named `npm run dev:all` but did not say to refresh, so a reader who started the API sat on the empty screen. `返回` is home (`/`), not a retry: while the API is still down that is the bundled sample with `示例`; after restart it is the catalog default. Same as the wordmark. Cheap: tip `起来后刷新这一页`. No auto-refresh, no poll.

4. **Catalog switching** — Query `audit-bad` → `shortly` → `audit-many`: warn / chip / pin / title match the URL. Wordmark from `audit-many` lands on `audit-bad` with the catalog-default hint. Missing id lists the other four as links; the shortly link is a clean live read. No stale strip or sample chip.

5. **Deferred, not promoted** — R5-7: the pin chip can cover later lines of a long focus span (first-pin `L18–59` covers ~L33–34 at the viewport floor). The reading line is higher; still polish. R5-5e `$HOME` (only `~/` expands; README prefers an absolute path). R5-6b `GLOSS_API` (in the API table; Run documents `dev:all`). Dual Esc, bridge-while-pinned, L3 left.

### Round 8 issues

| id | sev | status | issue | proposed / done |
|----|-----|--------|-------|-----------------|
| R5-1 / R5-2 / R5-10 | — | **pass** (R5) | pin+chapter jump unpins; L18 teaching span; mid-width pin+select; 999 gate | still green |
| R5-1b / R6-1 / R6-2 | — | **pass** (R6) | bare `/` hint; explicit audit-bad count-only; check pinned to examples; pack omits lockfile | still green |
| R7-1 / R7-2 / R7-3 | — | **pass** (R7) | empty / project-as-root / invalid-id real root + child-id tip; engines; sample chip / API-down; Esc | still green |
| R8-switch | — | ok | query / wordmark / other-projects / bare `/` among audit-bad, shortly, audit-many | no stale warn/pin/chip/title |
| R8-1 | medium | **fixed** | Named-project API-down notice had the recovery command but no refresh hint; after restart the screen stayed until the reader already knew to reload. `返回` stays home (not a retry) | `NOTICE_UNREACHABLE_TIP` = `起来后刷新这一页`. README: `API 未运行` asks you to refresh; `返回` is home. No poll, no auto-recover |
| R8-2 | medium | **fixed** | README Run skipped `check` and did not say this repo's `/` is shortly | Run: install → check → `dev:all` → open the URL. This repo's `examples/` only has shortly; use `?project=` for a specific id. No catalog reorder |
| R8-silent | — | ok | Mid-session API death without reload keeps the loaded project | no poll; reload is the refresh |
| R5-3 | low | deferred | Esc taught twice (masthead + chip) | chip stays primary |
| R5-4 / R2-1 / R5-1c | low | deferred | No in-chrome pin/Esc tip before first pin | essay lead is enough |
| R5-5 / R2-2e | low | deferred | Bridge drops after a few px of pinned prose scroll | do not fight sync |
| R5-6 / R2-7d | low | deferred | Rail label `目录` whisper contrast | fine for a label |
| R5-7 | low | deferred | Pin chip can cover the last visible lines of a long focus span | still polish; focused span starts at the reading line |
| R5-5e | low | deferred | `$HOME` in the env is not expanded; tip stays generic | prefer an absolute path; `~/` already expands |
| R5-6b | low | deferred | Split `api`+`dev` needs a `GLOSS_API` whisper in README | `dev:all` is the documented path; table already lists `GLOSS_API` |
| L3 | low | deferred | EN sample subtitle | would fight Chinese-first voice |

### Round 8 re-test (Grok Build)

- Project check: typecheck + gloss check (`1 gloss checked, 37 refs, 0 problems`) + **72/72** tests green (one new `noticeCopy` unreachable assertion).
- **R8-1:** `?project=audit-many` with API aborted: title `API 未运行，读不到这个项目`, hint `npm run dev:all`, tip `起来后刷新这一页`, `返回` still `/` (`retest/01-unreachable-tip.png`). Same URL with API up is audit-many (`retest/02-audit-many-live.png`).
- **R8-2:** README Run has `npm run check` and says this repo's `/` is shortly.
- **R6 / R7 verify:** bare `/` hint; explicit audit-bad count-only; shortly live, Esc unpins; @1200 pin+select; @999 gate; API down on `/` shows `示例`.
- Still deferred: R5-3 dual Esc, R5-4 / R2-1 / R5-1c first-open pin tip, R5-5 / R2-2e bridge, R5-6 / R2-7d rail whisper, R5-7 chip occlusion, L3, R5-5e `$HOME` in tip, R5-6b `GLOSS_API` whisper. Note: R5-6f localhost vs loopback.
- Local-only. No push, no merge to main. Not claiming publish-done.

