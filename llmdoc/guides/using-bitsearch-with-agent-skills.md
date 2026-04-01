# Using BitSearch with Agent Skills

BitSearch already ships a long fallback companion prompt for generic MCP clients. For clients that support the open Agent Skills standard, the better default is `skill + mcp`: keep BitSearch connected as an MCP server, and load a standard BitSearch skill only when the task actually needs it.

This repository distributes one standard skill template in `skills/bitsearch-research/`.

## Why one standard skill

The current Agent Skills guidance favors coherent units over splitting tightly related instructions across multiple templates. For BitSearch, tool routing, evidence handling, search-engine-driven discovery, and retrieval workflow are all part of the same user task: research and verify uncertain or time-sensitive information with the BitSearch MCP server.

That is why the repository now distributes one merged skill:

- `bitsearch-research` - uncertain or time-sensitive information research, source-backed answers, search_engine-driven broad discovery, targeted retrieval, site traversal, batch scraping, structured extraction, and Planning Engine-driven complex investigations

## Why `skill + mcp`

- Lower token cost than keeping the full BitSearch companion prompt in every session.
- Better separation of concerns: the MCP server exposes search, grounding, retrieval, and planning capabilities; the skill explains how and when to use them together.
- Cross-vendor portability: the same skill can be used by Agent Skills-compatible clients such as Claude Code and Codex.
- Easier maintenance: the main `SKILL.md` stays compact and detailed rules live in `references/`.
- Better complex-task handling: the same skill can escalate from direct retrieval to the six-phase Planning Engine when the query needs decomposition and execution planning.

## Directory layout

```text
skills/
└── bitsearch-research/
    ├── SKILL.md
    └── references/
        ├── evidence-rules.md
        ├── gotchas.md
        ├── planning-engine.md
        ├── tool-selection.md
        ├── trigger-evals.json
        └── workflow-patterns.md
```

## Installation

### Portable install for compatible clients

Prefer the standard cross-client path:

```bash
mkdir -p .agents/skills
cp -R skills/bitsearch-research .agents/skills/
```

For user-wide installation:

```bash
mkdir -p ~/.agents/skills
cp -R skills/bitsearch-research ~/.agents/skills/
```

### Native client directories when needed

If a client does not scan `.agents/skills/`, copy the same folder to its native skills directory instead:

- Claude Code: `.claude/skills/` or `~/.claude/skills/`
- Codex: `~/.codex/skills/`

The template content stays the same; only the discovery location changes.

## Disable native web tools

If the client exposes built-in web tools, disable them locally when you want BitSearch to be the active search and retrieval layer. Otherwise the model may call native `WebSearch` or `WebFetch` instead of the BitSearch MCP tools, which bypasses BitSearch routing, source caching, and Planning Engine behavior.

BitSearch cannot change those local settings remotely. The `toggle_builtin_tools` MCP tool is only a remote-deployment stub and does not disable client-native tools.

### Claude Code

One-off session:

```bash
claude --disallowedTools WebSearch WebFetch
```

Persistent config in `~/.claude/settings.json`, `.claude/settings.json`, or `.claude/settings.local.json`:

```json
{
  "permissions": {
    "deny": ["WebSearch", "WebFetch"]
  }
}
```

### Codex

Current Codex CLI help documents native live web search through `--search`. When using BitSearch, do not start Codex with that flag, and remove it from any alias, wrapper, or launcher profile that injects it automatically.

Examples:

```bash
codex
```

```bash
codex -C /path/to/project
```

The current Codex CLI help does not document a separate native `WebFetch` toggle. In practice, keep native search disabled so BitSearch remains the only web-capable path.

## Skill design choices

- Standard frontmatter only: `name`, `description`, `license`, `compatibility`, and `metadata`
- No Claude-only fields such as `user-invocable`, `disable-model-invocation`, or slash-command assumptions
- One coherent workflow with progressive disclosure into `references/`
- Direct retrieval by default, with Planning Engine as the explicit upgrade path for complex tasks
- Trigger-oriented description plus bundled trigger-eval queries

## Local standard snapshot

The BitSearch design was reworked against a local summary snapshot of the first-party `agentskills.io` docs:

- [llmdoc/external/agentskills/INDEX.md](../external/agentskills/INDEX.md)

That snapshot records the source URLs, retrieval date, and the specific design implications adopted in this repository.

## Maintenance checklist

When the BitSearch skill changes:

1. Update `SKILL.md` only when the top-level procedure changes.
2. Update `references/` when routing, evidence, or workflow details change.
3. Update `trigger-evals.json` when the description or trigger coverage changes.
4. Re-check the Agent Skills standard snapshot when the upstream spec or best-practices docs change.
