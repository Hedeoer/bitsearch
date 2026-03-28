# MCP Tools Reference

## 1. Core Summary

The bitsearch MCP server exposes 13 tools across three categories: search (4), configuration (3), and planning (6). All tool input schemas are defined as Zod objects in `src/server/mcp/register-tools.ts`. All tools return MCP-compliant content arrays (text type). Planning tools share session state via `session_id` and return progress metadata.

## 2. Source of Truth

- **Primary Code:** `src/server/mcp/register-tools.ts` -- All 13 tool registrations with Zod schemas and handler implementations.
- **Planning Engine:** `src/server/services/planning-engine.ts` -- Phase processing logic, complexity-level phase requirements.
- **Provider Routing:** `src/server/providers/fetch-router.ts` -- Key pool failover used by `web_fetch` and `web_map`.
- **Related Architecture:** `/llmdoc/architecture/mcp-server-architecture.md` -- Full execution flow and session lifecycle.

## 3. Search Tools

### `web_search` (lines 228-307)
Deep web search via `search_engine`. Optionally fetches extra sources from Tavily/Firecrawl.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` | string | yes | -- | Search query |
| `platform` | string | no | `""` | Platform hint for search context |
| `model` | string | no | `""` | Override the default search model (uses system default if empty) |
| `extra_sources` | integer | no | `0` | Number of extra sources from Tavily/Firecrawl (min: 0) |

**Returns:** `{ session_id, content, sources_count }`

### `get_sources` (lines 309-333)
Retrieves cached sources from a previous `web_search` call.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `session_id` | string | yes | Session ID from a prior `web_search` result |

**Returns:** `{ session_id, sources, sources_count }` or `{ error: "session_id_not_found_or_expired" }`

### `web_fetch` (lines 335-346)
Extracts full content from a URL as Markdown. Routes through key pool to Tavily Extract or Firecrawl Scrape.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `url` | string (URL) | yes | Target URL to extract |

**Returns:** Markdown text content or error message.

### `web_map` (lines 348-383)
Maps website structure, returns discovered URLs. Routes through key pool to Tavily Map or Firecrawl Map.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `url` | string (URL) | yes | -- | Root URL to map |
| `instructions` | string | no | `""` | Crawl instructions |
| `max_depth` | integer | no | `1` | Max crawl depth (1-5) |
| `max_breadth` | integer | no | `20` | Max breadth per level (1-500) |
| `limit` | integer | no | `50` | Max URLs returned (1-500) |
| `timeout` | integer | no | `150` | Timeout in seconds (10-150) |

**Returns:** URL list text or error message.

## 4. Configuration Tools

### `get_config_info` (lines 385-435)
Returns server configuration and `search_engine` connectivity test. No parameters.

**Returns:** `{ settings, providers, key_pool_status, connection_test }`

### `switch_model` (lines 437-462)
Persists a new default search model to system settings.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `model` | string | yes | Search model identifier |

**Returns:** `{ status, previous_model, current_model, message }`

### `toggle_builtin_tools` (lines 464-486)
Stub tool. Always returns an error indicating remote MCP servers cannot modify local client settings.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `action` | string | no | `"status"` | Requested action |

**Returns:** Error with `isError: true`.

## 5. Planning Tools

All planning tools accept `session_id` (auto-generated on first call), `thought` (reasoning trace), `confidence` (0-1, default 1), and `is_revision` (boolean, default false). They return `{ session_id, completed_phases, complexity_level, plan_complete, phases_remaining, executable_plan }`.

### `plan_intent` (lines 488-524) -- Phase 1: Intent Analysis

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `core_question` | string | yes | Distilled core question |
| `query_type` | string | yes | Classification of query type |
| `time_sensitivity` | string | yes | Temporal relevance assessment |
| `domain` | string | no | Subject domain |
| `premise_valid` | boolean | no | Whether the query premise is valid |
| `ambiguities` | string | no | Comma-separated list of ambiguities |
| `unverified_terms` | string | no | Comma-separated unverified terms |

### `plan_complexity` (lines 526-551) -- Phase 2: Complexity Assessment

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `level` | integer (1-3) | yes | Complexity level; determines required phases |
| `estimated_sub_queries` | integer | yes | Expected number of sub-queries |
| `estimated_tool_calls` | integer | yes | Expected number of tool invocations |
| `justification` | string | yes | Reasoning for complexity level |

### `plan_sub_query` (lines 553-585) -- Phase 3: Query Decomposition

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | yes | Sub-query identifier |
| `goal` | string | yes | What this sub-query aims to answer |
| `expected_output` | string | yes | Expected result format |
| `boundary` | string | yes | Scope boundary |
| `depends_on` | string | no | Comma-separated dependency sub-query IDs |
| `tool_hint` | string | no | Suggested tool for this sub-query |

### `plan_search_term` (lines 587-627) -- Phase 4: Search Strategy

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `term` | string | yes | Search term text |
| `purpose` | string | yes | Why this term is needed |
| `round` | integer | yes | Execution round number (min: 1) |
| `approach` | string | no | Search approach description |
| `fallback_plan` | string | no | Fallback if term yields no results |

### `plan_tool_mapping` (lines 629-664) -- Phase 5: Tool Selection

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `sub_query_id` | string | yes | Which sub-query this mapping is for |
| `tool` | string | yes | Tool name to use |
| `reason` | string | yes | Why this tool was chosen |
| `params_json` | string | no | JSON string of tool parameters |

### `plan_execution` (lines 666-709) -- Phase 6: Execution Order

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `parallel_groups` | string | yes | Semicolon-separated groups; comma-separated IDs within groups |
| `sequential` | string | yes | Comma-separated sequential execution order |
| `estimated_rounds` | integer | yes | Total execution rounds (min: 1) |
