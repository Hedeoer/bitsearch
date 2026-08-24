# BitSearch Documentation

> Remote MCP server aggregating `search_engine`, Tavily, and Firecrawl behind a unified HTTP/SSE interface with key pool management, automatic failover, and an admin operations console. `search_engine` supports OpenAI, Anthropic, and Gemini-style upstream formats.

## Overview

- [Project Overview](overview/project-overview.md) -- Identity, tech stack, repository layout, capabilities, and design philosophy.

## Architecture

- [MCP Server](architecture/mcp-server-architecture.md) -- HTTP+SSE transport, session lifecycle, tool invocation flow, and authentication.
- [Search Providers](architecture/search-providers-architecture.md) -- Three-provider routing, key rotation, failover logic, and planning engine.
- [Key Pool Management](architecture/key-pool-architecture.md) -- Key import, LRU rotation, quota sync, health checks, and AES-256-GCM encryption.
- [Admin Console](architecture/admin-console-architecture.md) -- React 19 SPA architecture, component tree, state management, and Tailwind v4 theme system.
- [Admin Design System](architecture/admin-design-system.md) -- 方向 A「暖光工作台」视觉规范：token 角色、排版、组件、布局、Motion 哲学（唯一事实源）。

## Guides

- [Adding MCP Tools](guides/adding-mcp-tools.md) -- Register a new tool in `register-tools.ts` with Zod schema and handler.
- [Configuring Search Providers](guides/configuring-search-providers.md) -- Set up providers, routing strategy, API keys, and search model selection.
- [Managing API Keys](guides/managing-api-keys.md) -- Import, monitor, sync quotas, disable, and delete keys in the pool.
- [Admin Console Development](guides/admin-console-development.md) -- Add panels, wire state, connect backend APIs, and follow Tailwind v4 / design-system conventions.
- [Using BitSearch with Agent Skills](guides/using-bitsearch-with-agent-skills.md) -- Replace the long BitSearch companion prompt with one standard `bitsearch-research` skill template.
- [Testing BitSearch with Natural Chat Prompts](guides/testing-bitsearch-with-natural-chat-prompts.md) -- Run one realistic conversation that exercises search, source follow-up, fetch, map, crawl, batch scrape, extract, and optional planning behavior.

## External References

- [Agent Skills Reference Snapshot](external/agentskills/INDEX.md) -- BitSearch-maintained summaries of the first-party `agentskills.io` pages used to redesign the skill template.

## Reference

- [Coding Conventions](reference/coding-conventions.md) -- TypeScript strict ESM, file naming, import patterns, and style rules.
- [Git Conventions](reference/git-conventions.md) -- Conventional Commits format, branch strategy, and PR guidelines.
- [MCP Tools Reference](reference/mcp-tools-reference.md) -- All 20 tools with parameter tables, types, return shapes, and large-result pagination behavior.
- [Key Pool Data Model](reference/key-pool-data-model.md) -- `provider_keys` schema, computed fields, health states, and quota JSON structure.
- [Admin API Endpoints](reference/admin-api-endpoints.md) -- 26 REST endpoints across auth, dashboard, providers, keys, and activity.
