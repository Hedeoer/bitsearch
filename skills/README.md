# BitSearch Agent Skills Templates

This directory contains BitSearch skill templates written against the open Agent Skills standard from `agentskills.io`.

These templates are distribution artifacts, not live client state for this repository. To use them, copy the desired skill folder into one of these locations:

- Cross-client project scope: `<project>/.agents/skills/`
- Cross-client user scope: `~/.agents/skills/`
- Native client scope when needed, such as `~/.claude/skills/` or `~/.codex/skills/`

Included template:

- `bitsearch-research` - a standard BitSearch skill for uncertain or time-sensitive information research, fact verification, evidence gathering, targeted retrieval, structured extraction, and Planning Engine-driven complex investigations through the BitSearch MCP server

Recommended validation:

```bash
skills-ref validate skills/bitsearch-research
```

See [llmdoc/guides/using-bitsearch-with-agent-skills.md](../llmdoc/guides/using-bitsearch-with-agent-skills.md) for installation guidance and the local snapshot of the Agent Skills standard.
