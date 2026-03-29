# BitSearch

## 1. Identity

- **What it is:** A remote MCP (Model Context Protocol) server that gives AI agents web search, content extraction, and site mapping capabilities through a unified HTTP/SSE interface.
- **Purpose:** Aggregates multiple search providers (`search_engine`, Tavily, Firecrawl) behind a single MCP endpoint with automatic failover, API key pool management, and operational observability.

## 2. High-Level Description

BitSearch is a split frontend/backend TypeScript monorepo. The **server** layer exposes 13 MCP tools over Streamable HTTP transport, routing requests across three search providers with key-pool-based failover and LRU key rotation. The **web** layer is a React admin console ("Aether Console") for managing provider configurations, API key inventories, system settings, and request activity. A **shared** contracts module provides type-safe interfaces consumed by both sides. All data is persisted in an embedded SQLite database using the native `node:sqlite` synchronous API.

## 3. Tech Stack

| Layer        | Technology                                              |
| ------------ | ------------------------------------------------------- |
| Runtime      | Node.js with native `node:sqlite` (DatabaseSync)       |
| Language     | TypeScript (strict, ESM)                                |
| Server       | Express 5, `@modelcontextprotocol/sdk` ^1.17            |
| Frontend     | React 19, React Router 7, Vite 7                       |
| Database     | SQLite (WAL mode, 9 tables)                             |
| Security     | bcrypt, AES-256-GCM encryption, session cookies, Bearer tokens |
| Validation   | Zod (MCP tool inputs only)                              |

## 4. Repository Layout

- `src/server/` -- Express app, MCP transport, provider clients, repositories, services, database.
- `src/web/` -- React admin console (components, styles, API client).
- `src/shared/` -- `contracts.ts` defining all shared TypeScript interfaces and constants.
- `dist/` -- Build output (`dist/public` for Vite assets, `dist/server` for Node).
- `data/` -- Runtime SQLite database files (not committed).

## 5. Key Capabilities

- **Multi-provider search routing:** `search_engine` for AI-powered search; Tavily and Firecrawl for extraction, mapping, and supplemental search. Three fetch modes: `strict_tavily`, `strict_firecrawl`, `auto_ordered`.
- **API key pool management:** Bulk import, LRU rotation, health monitoring, quota synchronization, and per-key telemetry for Tavily and Firecrawl.
- **Query planning engine:** Six-phase workflow (intent, complexity, sub-queries, search terms, tool mapping, execution order) with complexity-based phase gating.
- **Activity tracking:** Two-level logging (request + attempt) with provider failover visibility, dashboard metrics, and configurable retention.
- **Admin console:** React Router 7 SPA with four workspace routes: `/overview`, `/providers`, `/keys`, `/activity`. Each workspace is a separate routed page component under `src/web/pages/`.

## 6. MCP Tools (20 total)

| Category       | Tools                                                                  |
| -------------- | ---------------------------------------------------------------------- |
| Core Search    | `web_search`, `get_sources`, `web_fetch`, `web_map`                    |
| Provider-Specific Retrieval | `tavily_crawl`, `firecrawl_crawl`, `firecrawl_crawl_status`, `firecrawl_batch_scrape`, `firecrawl_batch_scrape_status`, `firecrawl_extract`, `firecrawl_extract_status` |
| Configuration  | `get_config_info`, `switch_model`, `toggle_builtin_tools`              |
| Planning       | `plan_intent`, `plan_complexity`, `plan_sub_query`, `plan_search_term`, `plan_tool_mapping`, `plan_execution` |

## 7. Authentication Model

- **Admin UI:** Session-based with bcrypt password hashing, httpOnly cookies, sameSite/secure flags.
- **MCP API:** Bearer token (`MCP_BEARER_TOKEN` env var) plus configurable origin allowlist.

## 8. Design Philosophy

The admin UI follows the **"Aether Console"** design system: a dark technical cockpit theme with glassmorphic surfaces, IBM Plex typography, cyan primary accent (`#00d7f3`), and editorial dashboard layout. The intent is a high-trust operations console, not a generic SaaS settings page.
