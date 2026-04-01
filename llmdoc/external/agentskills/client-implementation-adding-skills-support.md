# Adding Skills Support Snapshot

- Source: <https://agentskills.io/client-implementation/adding-skills-support>
- Retrieved: 2026-04-01

## Key points

- Progressive disclosure is the core client-side design principle.
- Cross-client discovery paths include `<project>/.agents/skills/` and `~/.agents/skills/`.
- Native client paths can coexist with `.agents/skills/`.
- Clients should disclose a catalog of `name`, `description`, and `location`, then load `SKILL.md` only when activated.

## BitSearch implications

- BitSearch docs should recommend `.agents/skills/` as the portable install target.
- Native paths such as `.claude/skills/` or `~/.codex/skills/` should be documented as compatibility fallbacks, not as the main distribution format.
