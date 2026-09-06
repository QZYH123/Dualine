# AGENTS.md — Prose ↔ Code reader

## Mission
Help people understand a project after vibe coding: **prose tied to real code**, in a reading layout that feels calm and precise. Design elegance beats feature count.

## Models / roles
- **Main agent:** Claude Fable — product design, visual system, frontend, interaction.
- **Subagent `backend`:** `cursor-grok-4.6-xhigh-fast` — APIs, repo parsing, prose↔code mapping data, persistence. Use proactively for all non-UI implementation.

## Non-negotiables
1. Design first. One exquisite primary reading screen > many half-built pages.
2. Prose and code must stay **linked** (anchors / hover / scroll sync)—not two unrelated columns.
3. No generic “AI SaaS” look (default Inter-on-white, purple gradients, noisy cards).
4. No secrets in the repo. Use env vars.
5. Conventional Commits; work on `feature/*` branches for new work (never push straight to `main` without review when a remote exists).
6. Chinese UI copy is welcome; tone: calm, precise, not cute.

## Working loop with humans
- Prefer small demos you can open in the browser.
- When stuck on product taste, pause and ask rather than shipping a loud UI.
- After meaningful UI, note how to run and where to look.

## Skills
See `.cursor/skills/` — especially `prose-code-reader` and `design-pass`.
