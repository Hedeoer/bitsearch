# Using Scripts Snapshot

- Source: <https://agentskills.io/skill-creation/using-scripts>
- Retrieved: 2026-04-01

## Key points

- Scripts are optional, but when present they should be non-interactive, self-contained when possible, and documented with `--help`.
- Structured output is preferred over whitespace-aligned output for agent consumption.
- Compatibility notes should mention runtime requirements if scripts depend on external tools.

## BitSearch implications

- The initial BitSearch template does not need bundled scripts because the MCP server already supplies the primary capabilities.
- If BitSearch later adds eval or helper scripts, they should follow the non-interactive and structured-output guidance.
