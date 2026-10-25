# Provenance

- Source: the `nestjs-best-practices` skill (v1.1.0 upstream layout, licence MIT as declared
  in `SKILL.md`), copied from the reference monorepo's local skills directory.
- Copied: `SKILL.md`, `AGENTS.md`, `rules/` (40 rules). These are unmodified.
- Not copied: `scripts/`, `.github/`, `.gitignore`. These are packaging for building
  `AGENTS.md` and are not needed to use the skill.
- Where a rule conflicts with this repo's conventions (see `CLAUDE.md`), the repo wins.
  For example, the rules show class-validator DTOs, while this repo validates with zod
  through `nestjs-zod`.
