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
| L1 | open | Rail label still “Contents”; not in this pass. |
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

