# BitSearch Documentation

> Remote MCP server aggregating Grok, Tavily, and Firecrawl behind a unified HTTP/SSE interface with key pool management, automatic failover, and an admin operations console.

## Overview

- [Project Overview](overview/project-overview.md) -- Identity, tech stack, repository layout, capabilities, and design philosophy.

## Architecture

- [MCP Server](architecture/mcp-server-architecture.md) -- HTTP+SSE transport, session lifecycle, tool invocation flow, and authentication.
- [Search Providers](architecture/search-providers-architecture.md) -- Three-provider routing, key rotation, failover logic, and planning engine.
- [Key Pool Management](architecture/key-pool-architecture.md) -- Key import, LRU rotation, quota sync, health checks, and AES-256-GCM encryption.
- [Admin Console](architecture/admin-console-architecture.md) -- React 19 SPA architecture, component tree, state management, and CSS layer system.

## Guides

- [Adding MCP Tools](guides/adding-mcp-tools.md) -- Register a new tool in `register-tools.ts` with Zod schema and handler.
- [Configuring Search Providers](guides/configuring-search-providers.md) -- Set up providers, routing strategy, API keys, and Grok model selection.
- [Managing API Keys](guides/managing-api-keys.md) -- Import, monitor, sync quotas, disable, and delete keys in the pool.
- [Admin Console Development](guides/admin-console-development.md) -- Add panels, wire state, connect backend APIs, and follow CSS architecture.

## Reference

- [Coding Conventions](reference/coding-conventions.md) -- TypeScript strict ESM, file naming, import patterns, and style rules.
- [Git Conventions](reference/git-conventions.md) -- Conventional Commits format, branch strategy, and PR guidelines.
- [MCP Tools Reference](reference/mcp-tools-reference.md) -- All 13 tools with parameter tables, types, and return shapes.
- [Key Pool Data Model](reference/key-pool-data-model.md) -- `provider_keys` schema, computed fields, health states, and quota JSON structure.
- [Admin API Endpoints](reference/admin-api-endpoints.md) -- 26 REST endpoints across auth, dashboard, providers, keys, and activity.
