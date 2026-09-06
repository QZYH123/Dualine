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
| L2 | deferred | Glossed code lines not keyboard-activatable. |
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
