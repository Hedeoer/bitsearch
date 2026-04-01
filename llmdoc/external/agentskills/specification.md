# Specification Snapshot

- Source: <https://agentskills.io/specification>
- Retrieved: 2026-04-01

## Key points

- Standard directory layout is `skill-name/SKILL.md` with optional `scripts/`, `references/`, and `assets/`.
- Standard frontmatter fields are `name`, `description`, optional `license`, optional `compatibility`, optional `metadata`, and optional experimental `allowed-tools`.
- `name` must be lowercase with hyphens; `description` should describe both behavior and when to use the skill.
- Validation is supported through `skills-ref validate`.

## BitSearch implications

- Rename the merged template to a standard-compliant identifier: `bitsearch-research`.
- Remove Claude-specific fields such as `user-invocable`, `disable-model-invocation`, and `argument-hint`.
- Use `compatibility` for BitSearch MCP and network requirements.
