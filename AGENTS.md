# AGENTS.md — Gloss (prose ↔ code reader)

## Mission
Help people understand a project after vibe coding: prose tied to real code, in a calm paired-reading experience.

## Who does what
- **Claude Fable 5.1 thinking-xhigh (main):** product design + frontend. Owns the reading ritual, information architecture, and UI. Trust its product judgment—do not second-guess taste in prompts.
- **`backend` subagent (`cursor-grok-4.6-xhigh-fast`) — always xhigh-fast; do not downshift:** backend code, fixtures wiring when mechanical, boilerplate, type chores, and any work that does **not** change product direction. Use proactively so Fable stays on high-leverage decisions.

## Token discipline (Fable)
Prefer short turns: decide product/UI, sketch structure, delegate mechanical implementation to `backend` when it will not dilute the design. Do not burn Fable context on long backend digressions.

## Non-negotiables
1. Paired reading: prose anchors ↔ code spans (not two unrelated panes).
2. Round 1 = one primary reading screen that works end-to-end.
3. No secrets in repo. Conventional Commits on `feature/*` when branching.
4. Chinese UI OK; calm tone.

## Skills
`.cursor/skills/prose-code-reader`, `.cursor/skills/design-pass` — reference, not dogma.


## Model intensity
Always use **xhigh** (Fable: `claude-fable-5-1-thinking-xhigh`; Grok backend: `cursor-grok-4.6-xhigh-fast`). Do not switch to high/medium to save tokens.
