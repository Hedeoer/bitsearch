# Architecture of MCP Server

## 1. Identity

- **What it is:** An HTTP-based Model Context Protocol (MCP) server embedded within the bitsearch Express application, exposing 13 tools for web search, content extraction, configuration, and search planning.
- **Purpose:** Provides a standardized MCP interface so LLM clients (e.g., Claude Code) can invoke bitsearch capabilities over HTTP+SSE without stdio coupling.

## 2. Core Components

- `src/server/mcp/register-tools.ts` (`createMcpServer`): Factory that instantiates `McpServer` and registers all 13 tools with Zod input schemas. Contains helper functions for Grok config resolution, extra source fetching, and key-pool-routed web fetch/map operations.
- `src/server/mcp/transport-router.ts` (`handleMcpPost`, `handleMcpGet`, `handleMcpDelete`): Session-aware HTTP handlers that manage `StreamableHTTPServerTransport` instances in an in-memory Map keyed by session ID.
- `src/server/app.ts` (`createApp`, lines 53-61): Mounts the three MCP HTTP methods at `/mcp` with authentication middleware.
- `src/server/http/middleware.ts` (`requireMcpAuth`, `requireAllowedOrigin`): Two-layer auth: Bearer token validation and Origin whitelist check.
- `src/server/services/planning-engine.ts` (`processPlanningPhase`): Stateful 6-phase planning workflow engine persisted in SQLite, used by all `plan_*` tools.
- `src/server/providers/fetch-router.ts` (`runWithKeyPool`): Provider failover router that cycles through Tavily/Firecrawl keys, used by `web_fetch` and `web_map` tools.

## 3. Execution Flow (LLM Retrieval Map)

### 3.1 Server Initialization

- **1.** `src/server/main.ts:5-13` loads bootstrap config and creates the Express app via `createApp()`.
- **2.** `src/server/app.ts:53-61` mounts `POST /mcp`, `GET /mcp`, `DELETE /mcp` with `requireMcpAuth` and `requireAllowedOrigin` middleware chained before each handler.

### 3.2 MCP Session Lifecycle

- **1. Initialize:** Client sends POST to `/mcp` without `mcp-session-id` header, body is an MCP `initialize` JSON-RPC request.
- **2. Transport Creation:** `transport-router.ts:16-32` (`createTransport`) creates a `StreamableHTTPServerTransport` with UUID session ID generator, calls `createMcpServer(context)` and connects.
- **3. Session Storage:** On `onsessioninitialized` callback, the transport is stored in the `transports` Map (line 7).
- **4. Subsequent Requests:** Client includes `mcp-session-id` header; `handleMcpPost` (line 50-54) looks up existing transport and delegates.
- **5. SSE Streaming:** `handleMcpGet` (line 64-72) provides SSE channel for server-initiated messages on an existing session.
- **6. Cleanup:** `handleMcpDelete` (line 74-82) triggers transport close; `onclose` callback removes session from Map.

### 3.3 Tool Invocation (web_search example)

- **1.** MCP SDK deserializes JSON-RPC call and routes to the `web_search` handler in `register-tools.ts:228-307`.
- **2.** Handler calls `requireGrokConfig` (line 85-98) to load Grok provider config and API key from database.
- **3.** `searchWithGrok` and `getExtraSources` run in parallel via `Promise.all` (line 265-268).
- **4.** Results are split/merged via `source-utils.js`, cached in SQLite via `saveSearchSession`, and logged via `logSearchRequest`.
- **5.** Returns structured JSON with `session_id`, `content`, and `sources_count`.

### 3.4 Authentication Flow

- **1. Bearer Token:** `middleware.ts:24-33` compares `Authorization` header against `context.bootstrap.mcpBearerToken` (from `MCP_BEARER_TOKEN` env var, dev default: `"bitsearch-dev-token"`). Returns 401 on mismatch.
- **2. Origin Check:** `middleware.ts:35-45` reads `allowedOrigins` from system settings. Passes if: no Origin header, empty whitelist, or Origin is in list. Returns 403 on mismatch.

## 4. Tool Inventory (13 Tools)

### Search Tools (4)

| Tool | Purpose | Key Parameters |
|------|---------|----------------|
| `web_search` | Deep web search via Grok API with optional extra sources | `query`, `platform?`, `model?`, `extra_sources?` |
| `get_sources` | Retrieve cached sources from a prior `web_search` | `session_id` |
| `web_fetch` | Extract URL content as Markdown via Tavily/Firecrawl | `url` |
| `web_map` | Map website structure, return discovered URLs | `url`, `instructions?`, `max_depth?`, `max_breadth?`, `limit?`, `timeout?` |

### Configuration Tools (3)

| Tool | Purpose | Key Parameters |
|------|---------|----------------|
| `get_config_info` | Return server config and test Grok connectivity | (none) |
| `switch_model` | Change default Grok model | `model` |
| `toggle_builtin_tools` | Stub; returns error for remote deployment | `action?` |

### Planning Tools (6)

| Tool | Phase | Key Parameters |
|------|-------|----------------|
| `plan_intent` | 1 - Intent analysis | `thought`, `core_question`, `query_type`, `time_sensitivity`, `session_id?`, `confidence?` |
| `plan_complexity` | 2 - Complexity assessment | `session_id`, `thought`, `level` (1-3), `estimated_sub_queries`, `estimated_tool_calls`, `justification` |
| `plan_sub_query` | 3 - Query decomposition | `session_id`, `thought`, `id`, `goal`, `expected_output`, `boundary`, `depends_on?` |
| `plan_search_term` | 4 - Search strategy | `session_id`, `thought`, `term`, `purpose`, `round`, `approach?`, `fallback_plan?` |
| `plan_tool_mapping` | 5 - Tool selection | `session_id`, `thought`, `sub_query_id`, `tool`, `reason`, `params_json?` |
| `plan_execution` | 6 - Execution order | `session_id`, `thought`, `parallel_groups`, `sequential`, `estimated_rounds` |

Planning phases required per complexity level: Level 1 = phases 1-3, Level 2 = phases 1-5, Level 3 = all 6 phases. Defined in `src/server/services/planning-engine.ts:19-29`.

## 5. Design Rationale

- **HTTP+SSE over stdio:** Enables remote deployment; MCP clients connect over the network rather than spawning a local process.
- **Per-session McpServer:** Each session gets its own `McpServer` instance via `createTransport`, providing isolation but sharing the same `AppContext`.
- **In-memory session Map:** Simple session management without external state stores; acceptable given single-process deployment model.
- **Zod-only validation at MCP boundary:** MCP tool inputs are validated with Zod schemas; downstream services rely on TypeScript types.
