# MCP Tools Reference

## 1. Core Summary

The bitsearch MCP server exposes 20 tools across four categories: search (4), provider-specific advanced retrieval (7), configuration (3), and planning (6). Tool schemas are defined in `src/server/mcp/register-tools.ts` and `src/server/mcp/provider-tools.ts`. Generic tools such as `web_fetch` and `web_map` use failover routing, while provider-specific tools execute only against their named provider. Planning tools share session state via `session_id` and return progress metadata.

## 2. Source of Truth

- **Primary Code:** `src/server/mcp/register-tools.ts` -- Main MCP server factory and built-in tool registrations.
- **Provider-Specific Tools:** `src/server/mcp/provider-tools.ts` -- Tavily / Firecrawl crawl, batch scrape, and extract tools.
- **Planning Engine:** `src/server/services/planning-engine.ts` -- Phase processing logic, complexity-level phase requirements.
- **Provider Routing:** `src/server/providers/fetch-router.ts` -- Key pool failover used by `web_fetch` and `web_map`.
- **Related Architecture:** `/llmdoc/architecture/mcp-server-architecture.md` -- Full execution flow and session lifecycle.

## 3. Search Tools

### `web_search`
Deep web search via `search_engine`. Optionally fetches extra sources from Tavily/Firecrawl.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` | string | yes | -- | Search query |
| `platform` | string | no | `""` | Platform hint for search context |
| `model` | string | no | `""` | Override the default search model (uses system default if empty) |
| `extra_sources` | integer | no | `0` | Number of extra sources from Tavily/Firecrawl (min: 0) |

**Returns:** `{ session_id, content, sources_count }`

### `get_sources`
Retrieves cached sources from a previous `web_search` call.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `session_id` | string | yes | Session ID from a prior `web_search` result |

**Returns:** `{ session_id, sources, sources_count }` or `{ error: "session_id_not_found_or_expired" }`

### `web_fetch`
Extracts full content from a URL as Markdown. Routes through key pool to Tavily Extract or Firecrawl Scrape.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `url` | string (URL) | yes | Target URL to extract |

**Returns:** Markdown text content or error message.

### `web_map`
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

## 4. Provider-Specific Advanced Retrieval Tools

These tools bypass `fetchMode` and always use their named provider.

### `tavily_crawl`
Synchronously traverses a site and returns extracted page content from Tavily.

Key parameters:

- `url`
- `instructions?`
- `chunks_per_source?`
- `max_depth?`
- `max_breadth?`
- `limit?`
- `select_paths?`
- `select_domains?`
- `exclude_paths?`
- `exclude_domains?`
- `allow_external?`
- `include_images?`
- `extract_depth?`
- `format?`
- `include_favicon?`
- `timeout?`
- `include_usage?`

**Returns:** `{ provider, base_url, results, response_time, usage, request_id }`

### `firecrawl_crawl`
Submits an asynchronous Firecrawl crawl job.

Key parameters:

- `url`
- `prompt?`
- `exclude_paths?`
- `include_paths?`
- `max_discovery_depth?`
- `sitemap?`
- `ignore_query_parameters?`
- `regex_on_full_url?`
- `limit?`
- `crawl_entire_domain?`
- `allow_external_links?`
- `allow_subdomains?`
- `delay?`
- `max_concurrency?`
- `webhook?`
- `scrape_options?`
- `zero_data_retention?`

**Returns:** `{ provider, tool: "crawl", status: "submitted", success, id, url }`

### `firecrawl_crawl_status`
Polls Firecrawl crawl job state.

**Returns:** `{ provider, tool: "crawl", id, status, total, completed, credits_used, expires_at, next, data }`

### `firecrawl_batch_scrape`
Submits an asynchronous Firecrawl batch scrape job for multiple URLs.

Key parameters:

- `urls`
- `webhook?`
- `max_concurrency?`
- `ignore_invalid_urls?`
- `formats?`
- `only_main_content?`
- `include_tags?`
- `exclude_tags?`
- `max_age?`
- `min_age?`
- `headers?`
- `wait_for?`
- `mobile?`
- `skip_tls_verification?`
- `timeout?`
- `parsers?`
- `actions?`
- `location?`
- `remove_base64_images?`
- `block_ads?`
- `proxy?`
- `store_in_cache?`
- `profile?`
- `zero_data_retention?`

**Returns:** `{ provider, tool: "batch_scrape", status: "submitted", success, id, url, invalid_urls }`

### `firecrawl_batch_scrape_status`
Polls batch scrape job state.

**Returns:** `{ provider, tool: "batch_scrape", id, status, total, completed, credits_used, expires_at, next, data }`

### `firecrawl_extract`
Submits an asynchronous structured extraction job.

Key parameters:

- `urls`
- `prompt?`
- `schema?`
- `enable_web_search?`
- `ignore_sitemap?`
- `include_subdomains?`
- `show_sources?`
- `scrape_options?`
- `ignore_invalid_urls?`

**Returns:** `{ provider, tool: "extract", status: "submitted", success, id, invalid_urls }`

### `firecrawl_extract_status`
Polls structured extraction job state.

**Returns:** `{ provider, tool: "extract", id, success, status, data, expires_at, tokens_used }`

## 5. Configuration Tools

### `get_config_info`
Returns server configuration and `search_engine` connectivity test. No parameters.

**Returns:** `{ settings, providers, key_pool_status, connection_test }`

### `switch_model`
Persists a new default search model to system settings.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `model` | string | yes | Search model identifier |

**Returns:** `{ status, previous_model, current_model, message }`

### `toggle_builtin_tools`
Stub tool. Always returns an error indicating remote MCP servers cannot modify local client settings.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `action` | string | no | `"status"` | Requested action |

**Returns:** Error with `isError: true`.

## 6. Planning Tools

All planning tools accept `session_id` (auto-generated on first call), `thought` (reasoning trace), `confidence` (0-1, default 1), and `is_revision` (boolean, default false). They return `{ session_id, completed_phases, complexity_level, plan_complete, phases_remaining, executable_plan }`.

### `plan_intent` -- Phase 1: Intent Analysis

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `core_question` | string | yes | Distilled core question |
| `query_type` | string | yes | Classification of query type |
| `time_sensitivity` | string | yes | Temporal relevance assessment |
| `domain` | string | no | Subject domain |
| `premise_valid` | boolean | no | Whether the query premise is valid |
| `ambiguities` | string | no | Comma-separated list of ambiguities |
| `unverified_terms` | string | no | Comma-separated unverified terms |

### `plan_complexity` -- Phase 2: Complexity Assessment

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `level` | integer (1-3) | yes | Complexity level; determines required phases |
| `estimated_sub_queries` | integer | yes | Expected number of sub-queries |
| `estimated_tool_calls` | integer | yes | Expected number of tool invocations |
| `justification` | string | yes | Reasoning for complexity level |

### `plan_sub_query` -- Phase 3: Query Decomposition

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | yes | Sub-query identifier |
| `goal` | string | yes | What this sub-query aims to answer |
| `expected_output` | string | yes | Expected result format |
| `boundary` | string | yes | Scope boundary |
| `depends_on` | string | no | Comma-separated dependency sub-query IDs |
| `tool_hint` | string | no | Suggested tool for this sub-query |

### `plan_search_term` -- Phase 4: Search Strategy

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `term` | string | yes | Search term text |
| `purpose` | string | yes | Why this term is needed |
| `round` | integer | yes | Execution round number (min: 1) |
| `approach` | string | no | Search approach description |
| `fallback_plan` | string | no | Fallback if term yields no results |

### `plan_tool_mapping` -- Phase 5: Tool Selection

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `sub_query_id` | string | yes | Which sub-query this mapping is for |
| `tool` | string | yes | Tool name to use |
| `reason` | string | yes | Why this tool was chosen |
| `params_json` | string | no | JSON string of tool parameters |

### `plan_execution` -- Phase 6: Execution Order

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `parallel_groups` | string | yes | Semicolon-separated groups; comma-separated IDs within groups |
| `sequential` | string | yes | Comma-separated sequential execution order |
| `estimated_rounds` | integer | yes | Total execution rounds (min: 1) |
