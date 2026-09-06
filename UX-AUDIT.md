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
