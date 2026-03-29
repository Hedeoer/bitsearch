<!-- This entire block is your raw intelligence report for other agents. It is NOT a final document. -->

### Code Sections (The Evidence)

- `src/server/providers/fetch-router.ts` (`runWithKeyPool`): Central routing engine that orchestrates provider selection, key pool iteration, failover logic, and telemetry logging for Tavily/Firecrawl operations.
- `src/server/providers/fetch-router.ts` (`resolveProviders`): Maps fetch mode to provider list: `strict_firecrawl` returns `["firecrawl"]`, `strict_tavily` returns `["tavily"]`, `auto_ordered` returns user-configured priority array.
- `src/server/providers/fetch-router.ts` (`isFailoverError`): Classifies errors as retryable (429, 408, 5xx, timeouts, generic errors) or non-retryable (other 4xx), determining whether to advance to next key or next provider.
- `src/server/providers/fetch-router.ts` (`classifyErrorType`): Categorizes errors into `rate_limit`, `timeout`, `upstream_5xx`, `http_error`, or `network_error` for telemetry.
- `src/server/providers/tavily-client.ts` (`tavilySearch`, `tavilyExtract`, `tavilyMap`, `tavilyUsage`): Tavily API client functions for web search, URL content extraction, site mapping, and quota retrieval. All use Bearer token authentication.
- `src/server/providers/firecrawl-client.ts` (`firecrawlSearch`, `firecrawlScrape`, `firecrawlMap`, `firecrawlCreditUsage`, `firecrawlHistoricalCreditUsage`): Firecrawl API client functions for web search, URL scraping, site mapping, and credit usage retrieval. All use Bearer token authentication.
- `src/server/providers/search-engine-client.ts` (`searchWithSearchEngine`, `buildSearchMessages`, `listSearchEngineModels`): Search engine client for AI-powered search via OpenAI-compatible chat completion API with SSE streaming. Single-key model, separate from key pool routing.
- `src/server/providers/search-engine-client.ts` (`buildUserPrompt`, `needsTimeContext`): Constructs user prompt with time context injection for time-sensitive queries (keywords: current, now, today, latest, recent, 今天, 当前, 最新, 最近).
- `src/server/services/planning-engine.ts` (`processPlanningPhase`): Multi-phase query planning engine that processes six phases: `intent_analysis`, `complexity_assessment`, `query_decomposition`, `search_strategy`, `tool_selection`, `execution_order`.
- `src/server/services/planning-engine.ts` (`PHASE_NAMES`, `REQUIRED_PHASES`): Defines six planning phases and complexity-based gating: level 1 requires 3 phases, level 2 requires 5 phases, level 3 requires all 6 phases.
- `src/server/services/planning-engine.ts` (`mergePhaseData`): Merges phase data with revision support: revisions replace; `query_decomposition`/`tool_selection` append to arrays; `search_strategy` merges objects and concatenates `search_terms`.
- `src/server/services/planning-engine.ts` (`createSessionId`, `ensurePlanningSession`, `getPlanningSnapshot`, `savePlanningPhase`, `updatePlanningComplexity`): Session management functions for planning state persistence.
- `src/server/services/search-engine-service.ts` (`requireSearchEngineConfig`): Assembles search engine client config by loading provider config, decrypting single API key, and reading default model from settings.
- `src/server/repos/provider-repo.ts` (`getCandidateKeys`): Returns enabled keys sorted by `last_used_at ASC` (LRU rotation) for a given provider.
- `src/server/repos/provider-repo.ts` (`markKeyUsage`): Records key usage with status code and error message, updates `last_used_at` timestamp.
- `src/server/repos/provider-repo.ts` (`getProviderConfig`, `getProviderApiKey`): Retrieves provider configuration and decrypts API key for single-key providers.
- `src/server/repos/settings-repo.ts` (`getSystemSettings`): Provides `fetchMode`, `providerPriority`, and `defaultSearchModel` from system settings.
- `src/server/repos/log-repo.ts` (`insertRequestLog`, `insertAttemptLogs`): Persists request-level and per-attempt telemetry for observability.
- `src/server/lib/http.ts` (`requestJson`, `requestTextStream`, `HttpRequestError`): HTTP transport layer for JSON requests and SSE streaming with timeout support.
- `src/shared/contracts.ts` (`FetchMode`, `KeyPoolProvider`, `REMOTE_PROVIDERS`, `KEY_POOL_PROVIDERS`, `FETCH_MODES`): Type definitions and constant enumerations for provider routing.

### Report (The Answers)

#### result

**Routing Modes:**

- `strict_tavily`: Forces all requests to Tavily provider only. Implemented in `resolveProviders()` at `fetch-router.ts:59-67`, returns `["tavily"]`.
- `strict_firecrawl`: Forces all requests to Firecrawl provider only. Returns `["firecrawl"]`.
- `auto_ordered`: Uses user-configured provider priority array (default: `["tavily", "firecrawl"]`). Iterates providers in order with full key pool failover.

**Failover Logic:**

- `runWithKeyPool()` at `fetch-router.ts:86-205` implements two-level failover: provider-level and key-level.
- For each provider in resolved list, retrieves enabled keys via `getCandidateKeys()` sorted by LRU (`last_used_at ASC`).
- Each key is tried sequentially. On error, `isFailoverError()` classifies as retryable or non-retryable.
- Retryable errors (429 rate limit, 408 timeout, 5xx upstream, generic network errors) advance to next key in pool.
- Non-retryable errors (other 4xx) break to next provider immediately.
- Success path: records attempt log, marks key usage with status 200, inserts request log, returns `{ ok: true, data }`.
- Exhaustion path: if all providers and keys fail, returns `{ ok: false, error }` with last error summary.

**Client Interfaces:**

- `FetchExecutor<TInput, TResult>` type at `fetch-router.ts:16-21`: `(provider, secret, input, timeoutMs) => Promise<TResult>`.
- Tavily client: `tavilySearch(config, query, maxResults)`, `tavilyExtract(config, url)`, `tavilyMap(config, input)`, `tavilyUsage(config)`.
- Firecrawl client: `firecrawlSearch(config, query, limit)`, `firecrawlScrape(config, url)`, `firecrawlMap(config, input)`, `firecrawlCreditUsage(config)`, `firecrawlHistoricalCreditUsage(config)`.
- Search engine client: `searchWithSearchEngine(config, messages)` returns SSE stream, `listSearchEngineModels(config)` returns model list, `buildSearchMessages(query, platform)` constructs chat messages.
- All clients use `TavilyClientConfig`, `FirecrawlClientConfig`, or `SearchEngineClientConfig` with `apiKey`, `baseUrl`, `timeoutMs` fields.

**Planning Engine Six Phases:**

1. `intent_analysis`: Analyzes user query intent.
2. `complexity_assessment`: Assigns complexity level (1-3), gates subsequent phases.
3. `query_decomposition`: Breaks query into sub-queries.
4. `search_strategy`: Defines search terms and strategy.
5. `tool_selection`: Maps tools to sub-queries.
6. `execution_order`: Determines execution sequence.

**Complexity-Based Gating:**

- Level 1: requires phases 1-3 (`intent_analysis`, `complexity_assessment`, `query_decomposition`).
- Level 2: requires phases 1-5 (adds `search_strategy`, `tool_selection`).
- Level 3: requires all 6 phases (adds `execution_order`).
- Defined in `REQUIRED_PHASES` at `planning-engine.ts:19-29`.

**Key Function Signatures:**

- `processPlanningPhase(context, phase, payload)`: Processes a single planning phase, returns session state with `session_id`, `completed_phases`, `complexity_level`, `plan_complete`, `phases_remaining`, `executable_plan`.
- `runWithKeyPool<TInput, TResult>(context, toolName, targetUrl, input, executor)`: Executes request with key pool failover, returns `RouterResult<TResult>` with `ok`, `data?`, `error?`.
- `requireSearchEngineConfig(context, overrideModel)`: Assembles search engine client config, throws if provider not configured.
- `buildSearchMessages(query, platform)`: Constructs system+user messages, injects time context for time-sensitive queries.

**Data Flow:**

1. **Provider Routing (Tavily/Firecrawl):** `runWithKeyPool` -> `resolveProviders` (mode to provider list) -> iterate providers -> `getCandidateKeys` (LRU sorted) -> iterate keys -> `executor` callback (client function) -> `isFailoverError` (classify) -> `markKeyUsage` -> `insertRequestLog` + `insertAttemptLogs` -> return result.
2. **Search Engine Search:** `requireSearchEngineConfig` -> `buildSearchMessages` (time context injection) -> `searchWithSearchEngine` (SSE streaming) -> return text stream.
3. **Planning Engine:** `processPlanningPhase` -> `ensurePlanningSession` (create/reuse session) -> `getPlanningSnapshot` (load state) -> `mergePhaseData` (merge logic) -> `savePlanningPhase` (persist) -> `updatePlanningComplexity` (if complexity phase) -> check completion against `REQUIRED_PHASES` -> return session state.

#### conclusions

- BitSearch implements a three-provider routing system with two distinct models: key pool routing for Tavily/Firecrawl (multi-key LRU rotation with failover) and single-key streaming for search engine (OpenAI-compatible chat completion).
- Routing modes (`strict_tavily`, `strict_firecrawl`, `auto_ordered`) control provider selection at the top level, with `auto_ordered` enabling full multi-provider failover.
- Failover logic uses two-level iteration (provider -> key) with error classification (retryable vs non-retryable) to maximize resilience while avoiding wasted attempts on permanent failures.
- Planning engine implements a six-phase workflow with complexity-based gating (1-3 levels) and phase-specific merge logic (replace, append, or merge) for incremental query decomposition.
- All operations are logged at two levels (request + attempt) for observability, with telemetry including provider, key fingerprint, status code, duration, error type, and error summary.
- Search engine client injects time context for time-sensitive queries (keywords: current, now, today, latest, recent, 今天, 当前, 最新, 最近) and uses SSE streaming with minimum 120s timeout.

#### relations

- `runWithKeyPool` calls `resolveProviders` to map fetch mode to provider list, then calls `getSystemSettings` to load mode and priority.
- `runWithKeyPool` calls `getProviderConfig` to check enabled status, then calls `getCandidateKeys` to retrieve LRU-sorted keys.
- `runWithKeyPool` calls `executor` callback with provider, secret, input, and timeout, which invokes client functions like `tavilyExtract` or `firecrawlScrape`.
- `runWithKeyPool` calls `isFailoverError` to classify errors, then calls `markKeyUsage` to record usage, and finally calls `insertRequestLog` + `insertAttemptLogs` for telemetry.
- `processPlanningPhase` calls `ensurePlanningSession` to create/reuse session, then calls `getPlanningSnapshot` to load state, then calls `mergePhaseData` to merge phase data, then calls `savePlanningPhase` to persist.
- `processPlanningPhase` calls `updatePlanningComplexity` when processing `complexity_assessment` phase, then checks completion against `REQUIRED_PHASES` based on complexity level.
- `requireSearchEngineConfig` calls `getProviderConfig` to load provider config, then calls `getProviderApiKey` to decrypt single API key, then calls `getSystemSettings` to read default model.
- `buildSearchMessages` calls `needsTimeContext` to detect time-sensitive queries, then injects time context into user prompt.
- `searchWithSearchEngine` calls `requestTextStream` to execute SSE streaming request with minimum 120s timeout.
- `tavilyExtract`, `tavilyMap`, `tavilySearch`, `firecrawlScrape`, `firecrawlMap`, `firecrawlSearch` all call `requestJson` to execute HTTP requests with timeout support.
