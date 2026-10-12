# Changelog (misc)

## Unreleased

### Misc-squad

- Relocated the packaged `write-gloss` skill from `.cursor/skills/write-gloss` to `skills/write-gloss`, so agent working files stay off main. `dualine init` still copies it into user projects (`.cursor/`, `.claude/`, `.agents/`). This fixes `npm run check` after `AGENTS.md` and `.cursor/` were removed.
