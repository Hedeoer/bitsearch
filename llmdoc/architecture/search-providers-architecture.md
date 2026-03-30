# Search Providers Architecture

## 1. Identity

- **What it is:** A three-provider search abstraction layer with automatic failover, key rotation, and multi-phase query planning.
- **Purpose:** Routes search, extraction, and mapping operations across `search_engine`, Tavily, and Firecrawl with resilient key management and telemetry.

## 2. Core Components

- `src/server/providers/fetch-router.ts` (`runWithKeyPool`, `isFailoverError`, `classifyErrorType`): Central routing engine that iterates generic-routing providers, handles failover, and logs telemetry.
- `src/server/providers/search-engine-client.ts` (`searchWithSearchEngine`, `buildSearchMessages`, `listSearchEngineModels`): AI-powered search via OpenAI-compatible chat completion API with SSE streaming. Single-key model.
- `src/server/providers/tavily-client.ts` (`tavilySearch`, `tavilyExtract`, `tavilyMap`, `tavilyUsage`): Web search, URL content extraction, and site mapping. Key-pool model.
- `src/server/providers/firecrawl-client.ts` (`firecrawlSearch`, `firecrawlScrape`, `firecrawlMap`, `firecrawlCreditUsage`): Web search, URL scraping, and site mapping. Key-pool model.
- `src/server/services/planning-engine.ts` (`processPlanningPhase`): Multi-phase query analysis engine that decomposes queries by complexity level.
- `src/server/repos/provider-repo.ts` (`getCandidateKeys`, `markKeyUsage`, `getProviderConfig`, `getProviderApiKey`, `importKeys`): Key pool storage and LRU rotation.
- `src/server/repos/settings-repo.ts` (`getSystemSettings`): Provides generic retrieval routing settings and default search model.
- `src/server/repos/log-repo.ts` (`insertRequestLog`, `insertAttemptLogs`): Persists request and per-attempt telemetry.
- `src/server/lib/http.ts` (`requestJson`, `requestTextStream`, `HttpRequestError`): HTTP transport for JSON and SSE streams.
- `src/shared/contracts.ts` + `src/shared/tool-surface.ts`: Type definitions for providers, generic routing, and tool-surface snapshot data.

## 3. Execution Flow (LLM Retrieval Map)

### 3.1 Provider Routing (Tavily/Firecrawl operations)

- **1. Settings Load:** `runWithKeyPool` receives a generic routing snapshot resolved from `getSystemSettings()` and capability availability.
- **2. Provider Resolution:** Generic routing now uses `single_provider` or `ordered_failover`, with requested provider order filtered to currently usable providers.
- **3. Provider Loop:** For each provider, check `getProviderConfig()` enabled status. Skip disabled providers.
- **4. Key Iteration:** `getCandidateKeys()` at `src/server/repos/provider-repo.ts` returns enabled keys sorted by `last_used_at ASC` (LRU). Each key is tried sequentially.
- **5. Execution:** The `executor` callback receives `(provider, secret, input, timeoutMs)` and calls the appropriate client function (e.g., `tavilyExtract` or `firecrawlScrape`).
- **6. Success Path:** On success, `markKeyUsage()` records status 200, attempt log is pushed, request log is inserted, returns `{ ok: true, data }`.
- **7. Error Path:** `isFailoverError()` at `src/server/providers/fetch-router.ts:69-84` classifies the error. Retryable errors (429, 408, 5xx, timeouts, generic) advance to next key. Non-retryable errors (other 4xx) break to next provider.
- **8. Exhaustion:** If all providers and keys fail, returns `{ ok: false, error }` with last error summary.

### 3.2 Search Engine Search (separate path)

- **1. Config Assembly:** `requireSearchEngineConfig()` loads provider config, decrypts single API key via `getProviderApiKey()`, and reads `defaultSearchModel` from settings.
- **2. Message Construction:** `buildSearchMessages()` at `src/server/providers/search-engine-client.ts` creates system+user messages, injects time context for time-sensitive queries.
- **3. Streaming Call:** `searchWithSearchEngine()` calls `/chat/completions` with `stream: true`, minimum 120s timeout. Response parsed as SSE via `requestTextStream()`.
- **4. Supplemental Sources:** `getExtraSources()` at `src/server/mcp/register-tools.ts:100-155` independently queries Tavily/Firecrawl for additional web results.

### 3.3 Planning Engine

- **1. Session Init:** `processPlanningPhase()` at `src/server/services/planning-engine.ts:72-124` creates/reuses a session with 12-char nanoid.
- **2. Phase Processing:** Six phases defined: `intent_analysis` -> `complexity_assessment` -> `query_decomposition` -> `search_strategy` -> `tool_selection` -> `execution_order`.
- **3. Complexity Gating:** `REQUIRED_PHASES` at lines 19-29 maps complexity level 1 (3 phases), 2 (5 phases), 3 (all 6 phases).
- **4. Merge Logic:** `mergePhaseData()` at lines 45-70: revisions replace; `query_decomposition`/`tool_selection` append to arrays; `search_strategy` merges objects and concatenates `search_terms`.
- **5. Completion:** Returns `executable_plan` (all phase data as object) when all required phases are complete.

## 4. Design Rationale

- **Two-tier key model:** `search_engine` uses a single key (stored in `provider_configs.api_key_encrypted`) because it serves as a dedicated AI search endpoint. Tavily/Firecrawl use key pools (stored in `provider_keys` table) to distribute rate limits across multiple keys.
- **LRU rotation:** Keys sorted by `last_used_at ASC` ensures even distribution across pool, reducing per-key rate limit pressure.
- **Error classification split:** Retryable vs non-retryable distinction prevents wasting attempts on permanent failures (e.g., 401 auth errors) while maximizing resilience for transient issues.
- **Search engine isolation:** `search_engine` does not participate in the `runWithKeyPool` router because it has a fundamentally different interface (streaming chat completion vs. REST JSON), different output shape (prose with inline citations vs. structured results), and a single-key model.
