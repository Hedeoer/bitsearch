<!-- BitSearch Server Entry Points and Core Infrastructure Investigation Report -->

### Code Sections (The Evidence)

#### Startup and Bootstrap

- `src/server/main.ts` (main): Entry point; reads bootstrap config, creates database, initializes admin session store, starts maintenance service, creates Express app, and listens on configured host/port (lines 7-20).
- `src/server/bootstrap.ts` (readBootstrapConfig): Reads environment variables and returns BootstrapConfig with port, host, databasePath, encryptionKey, adminAuthKey, sessionSecret, mcpBearerToken, and trustProxy flag (lines 52-62).
- `src/server/app-context.ts` (AppContext): Interface defining the dependency injection container with bootstrap config, database handle, and admin session store (lines 5-9).
- `src/server/db/database.ts` (createDatabase): Factory that creates SQLite DatabaseSync instance, applies schema, runs migrations, seeds system settings and provider configs, returns AppDatabase with sqlite handle and now() helper (lines 151-163).
- `src/server/db/schema.ts` (SCHEMA_SQL): DDL for 9 tables including admin_users, system_settings, provider_configs, provider_keys, request_logs, request_attempt_logs, search_sessions, planning_sessions, planning_phase_records with WAL mode and foreign keys enabled (lines 1-132).
- `src/server/lib/admin-session.ts` (createAdminSessionStore): Factory returning AdminSessionStore with HMAC-signed session cookies, 12-hour TTL, in-memory Map storage, and timing-safe signature verification (lines 77-126).
- `src/server/services/maintenance-service.ts` (startMaintenance): Starts hourly cleanup timer (unref'd) that purges old logs, search sessions, planning sessions, and expired admin sessions based on logRetentionDays setting (lines 17-29).

#### Express Application Structure

- `src/server/app.ts` (createApp): Express factory that configures helmet CSP, JSON body parser (2mb limit), mounts auth router (public), admin router (protected by requireAdminAuth + requireAdminWriteOrigin), MCP routes (protected by requireMcpAuth + requireAllowedOrigin), static file serving, SPA fallback, and global error handler (lines 36-96).
- `src/server/http/auth-routes.ts` (createAuthRouter): Public router with 3 endpoints: GET /session (check login status), POST /login (validate authKey against bootstrap.adminAuthKey, create session cookie), POST /logout (destroy session) (lines 5-30).
- `src/server/http/admin-routes.ts` (createAdminRouter): Protected router with 23 endpoints for dashboard, system settings, MCP access, providers, key pool management, and activity logs (lines 54-266).
- `src/server/http/middleware.ts` (requireAdminAuth): Middleware that validates admin session cookie via adminSessions.hasSession(), returns 401 if invalid (lines 27-35).
- `src/server/http/middleware.ts` (requireMcpAuth): Middleware that validates Bearer token from Authorization header against effective MCP bearer token (from DB or bootstrap fallback), returns 401 on mismatch (lines 37-49).
- `src/server/http/middleware.ts` (requireAllowedOrigin): Middleware that checks Origin header against allowedOrigins system setting, passes if no Origin header, empty whitelist, or Origin is in list, returns 403 on mismatch (lines 51-57).

#### MCP Transport and Session Management

- `src/server/mcp/transport-router.ts` (handleMcpPost): POST /mcp handler; checks for existing session via mcp-session-id header, creates new transport on initialize request without session ID, delegates to transport.handleRequest() (lines 93-114).
- `src/server/mcp/transport-router.ts` (handleMcpGet): GET /mcp handler for SSE streaming; looks up existing transport by session ID, delegates to transport.handleRequest() (lines 116-128).
- `src/server/mcp/transport-router.ts` (handleMcpDelete): DELETE /mcp handler for session cleanup; looks up transport, delegates to transport.handleRequest() which triggers onclose callback (lines 130-142).
- `src/server/mcp/transport-router.ts` (createTransport): Factory that instantiates StreamableHTTPServerTransport with randomUUID session ID generator, registers onsessioninitialized callback to store transport in Map, sets onclose callback to delete from Map, creates McpServer via createMcpServer(context), connects server to transport (lines 51-67).
- `src/server/mcp/transport-router.ts` (transports Map): In-memory Map<string, TransportSession> storing active MCP sessions with transport handle and lastSeenAt timestamp (line 15).
- `src/server/mcp/transport-router.ts` (cleanupIdleTransports): Periodic sweep function (5-minute interval) that closes and removes sessions idle for more than 30 minutes (lines 17-31, 33-37).
- `src/server/mcp/transport-router.ts` (getExistingTransport): Helper that looks up transport by session ID, updates lastSeenAt timestamp on hit, returns null on miss (lines 39-49).

#### MCP Server and Tool Registration

- `src/server/mcp/register-tools.ts` (createMcpServer): Factory that instantiates McpServer with name "bitsearch" version "0.1.0", registers all 13 tools with Zod input schemas and async handlers, returns server instance (lines 212-702).
- `src/server/mcp/register-tools.ts` (toolJsonResult): Helper that wraps result object in MCP content array with both text (JSON.stringify) and structuredContent fields (lines 49-54).
- `src/server/mcp/register-tools.ts` (logSearchRequest): Helper that inserts request log with tool name, status, duration, input/output metadata, and messages array; used by web_search tool (lines 56-88).
- `src/server/mcp/register-tools.ts` (getExtraSources): Async helper that fetches supplemental search results from Tavily/Firecrawl based on providerPriority setting, iterates keys with LRU selection, marks key usage, returns up to requested count (lines 90-145).
- `src/server/mcp/register-tools.ts` (buildWebFetchResult): Async helper that routes URL extraction through runWithKeyPool to Tavily Extract or Firecrawl Scrape, returns Markdown content or error message (lines 147-173).
- `src/server/mcp/register-tools.ts` (buildWebMapResult): Async helper that routes website mapping through runWithKeyPool to Tavily Map or Firecrawl Map with depth/breadth/limit parameters, returns URL list or error message (lines 175-210).
- `src/server/mcp/register-tools.ts` (web_search tool): Registered at lines 218-297; validates model parameter, builds search messages, calls searchWithSearchEngine and getExtraSources in parallel, splits answer and sources, saves session, logs request, returns session_id + content + sources_count.
- `src/server/mcp/register-tools.ts` (get_sources tool): Registered at lines 299-323; retrieves cached sources from search_sessions table by session_id.
- `src/server/mcp/register-tools.ts` (web_fetch tool): Registered at lines 325-336; calls buildWebFetchResult with URL parameter.
- `src/server/mcp/register-tools.ts` (web_map tool): Registered at lines 338-373; calls buildWebMapResult with URL, instructions, max_depth, max_breadth, limit, timeout parameters.
- `src/server/mcp/register-tools.ts` (get_config_info tool): Registered at lines 375-425; returns system settings, provider configs, key pool status, and search_engine connectivity test.
- `src/server/mcp/register-tools.ts` (switch_model tool): Registered at lines 427-452; updates default_search_model system setting.
- `src/server/mcp/register-tools.ts` (toggle_builtin_tools tool): Registered at lines 454-476; stub that always returns error for remote deployment.
- `src/server/mcp/register-tools.ts` (plan_intent tool): Registered at lines 478-514; phase 1 of planning engine, calls processPlanningPhase with intent_analysis phase name.
- `src/server/mcp/register-tools.ts` (plan_complexity tool): Registered at lines 516-541; phase 2, calls processPlanningPhase with complexity_assessment phase name.
- `src/server/mcp/register-tools.ts` (plan_sub_query tool): Registered at lines 543-575; phase 3, calls processPlanningPhase with query_decomposition phase name.
- `src/server/mcp/register-tools.ts` (plan_search_term tool): Registered at lines 577-617; phase 4, calls processPlanningPhase with search_strategy phase name.
- `src/server/mcp/register-tools.ts` (plan_tool_mapping tool): Registered at lines 619-654; phase 5, calls processPlanningPhase with tool_selection phase name.
- `src/server/mcp/register-tools.ts` (plan_execution tool): Registered at lines 656-699; phase 6, calls processPlanningPhase with execution_order phase name.

#### Provider Routing and Key Pool

- `src/server/providers/fetch-router.ts` (runWithKeyPool): Central routing engine that resolves provider order from fetchMode setting, iterates providers and keys with LRU selection, executes callback with decrypted secret, classifies errors as retryable or non-retryable, logs all attempts, returns RouterResult with ok flag and data or error (lines 86-205).
- `src/server/providers/fetch-router.ts` (resolveProviders): Maps fetchMode to provider array: strict_firecrawl -> ["firecrawl"], strict_tavily -> ["tavily"], auto_ordered -> user-configured priority (lines 59-67).
- `src/server/providers/fetch-router.ts` (isFailoverError): Classifies error as retryable (429, 408, 5xx, timeout, generic) or non-retryable (other 4xx), returns statusCode and message (lines 69-84).
- `src/server/providers/fetch-router.ts` (classifyErrorType): Maps error to type string: rate_limit, timeout, upstream_5xx, http_error, network_error (lines 40-57).
- `src/server/repos/provider-repo.ts` (getCandidateKeys): Queries enabled keys for provider sorted by COALESCE(last_used_at, created_at) ASC (LRU), decrypts secrets, returns array with secret field (lines 253-270).
- `src/server/repos/provider-repo.ts` (markKeyUsage): Updates last_used_at, last_status_code, last_error for key ID, pushing it to end of LRU queue (lines 272-285).
- `src/server/repos/provider-repo.ts` (importKeys): Bulk import with fingerprint deduplication via INSERT OR IGNORE with UNIQUE(provider, fingerprint) constraint, encrypts secrets with AES-256-GCM, returns inserted and skipped counts (lines 191-230).
- `src/server/lib/crypto.ts` (encryptSecret): AES-256-GCM encryption with random 12-byte IV, returns base64([IV + AuthTag + Ciphertext]) (lines 14-21).
- `src/server/lib/crypto.ts` (decryptSecret): Reverses encryption, verifies auth tag, returns plaintext (lines 23-31).
- `src/server/lib/crypto.ts` (fingerprintSecret): SHA-256 hash truncated to first 12 hex chars for deduplication (lines 10-12).

#### Search Engine Integration

- `src/server/services/search-engine-service.ts` (requireSearchEngineConfig): Loads provider config, decrypts API key, reads defaultSearchModel from settings, validates completeness, returns SearchEngineClientConfig (lines 10-30).
- `src/server/providers/search-engine-client.ts` (buildSearchMessages): Constructs system + user message array, injects time context for time-sensitive queries (current, now, today, latest, recent keywords), adds platform context if provided (lines 38-52).
- `src/server/providers/search-engine-client.ts` (searchWithSearchEngine): Calls /chat/completions with stream: true, minimum 120s timeout, parses SSE stream via requestTextStream, returns concatenated content (lines 77-92).
- `src/server/providers/search-engine-client.ts` (listSearchEngineModels): Calls /models endpoint, extracts id field from data array, returns string array (lines 61-75).
- `src/server/lib/http.ts` (requestTextStream): Fetches with AbortSignal.timeout, reads response.body via ReadableStream, decodes SSE lines starting with "data:", parses JSON chunks, extracts delta.content or message.content, concatenates (lines 56-110).
- `src/server/lib/source-utils.ts` (splitAnswerAndSources): Removes <think> tags, splits by source heading pattern, extracts markdown links or raw URLs, returns answer and sources array (lines 46-76).
- `src/server/lib/source-utils.ts` (mergeSources): Deduplicates sources by URL across multiple arrays, preserves first occurrence (lines 78-92).

#### Planning Engine

- `src/server/services/planning-engine.ts` (processPlanningPhase): Creates or reuses session with 12-char nanoid, loads snapshot, merges phase data (revision replaces, query_decomposition/tool_selection append, search_strategy merges with search_terms concatenation), saves phase, updates complexity level on phase 2, returns session_id + completed_phases + plan_complete + phases_remaining + executable_plan (lines 72-124).
- `src/server/services/planning-engine.ts` (REQUIRED_PHASES): Maps complexity level to required phase names: level 1 = 3 phases (intent, complexity, decomposition), level 2 = 5 phases (adds strategy, tool_selection), level 3 = all 6 phases (adds execution_order) (lines 19-29).
- `src/server/repos/planning-repo.ts` (ensurePlanningSession): INSERT OR IGNORE into planning_sessions with session ID (lines 17-24).
- `src/server/repos/planning-repo.ts` (savePlanningPhase): INSERT ... ON CONFLICT(session_id, phase_name) DO UPDATE for phase record with thought, data_json, confidence (lines 38-62).
- `src/server/repos/planning-repo.ts` (getPlanningSnapshot): Loads session and all phase records ordered by updated_at ASC, returns snapshot with complexityLevel and phases array (lines 64-100).

#### Activity Logging

- `src/server/repos/log-repo.ts` (insertRequestLog): Inserts request_logs row with tool name, target URL, strategy, final provider/key, attempts count, status, duration, error summary, input/output JSON, messages, provider order, metadata; invalidates dashboard cache (lines 98-124).
- `src/server/repos/log-repo.ts` (insertAttemptLogs): Bulk inserts request_attempt_logs rows with provider, key fingerprint, attempt number, status, status code, duration, error summary, error type, provider base URL; invalidates dashboard cache (lines 126-150).
- `src/server/repos/log-repo.ts` (listRequestActivities): Paginated query with filters (query, toolName, status, timePreset, customStart, customEnd), joins attempts via IN clause, groups by request ID, returns ActivityPageResult (lines 232-279).
- `src/server/repos/log-repo.ts` (cleanupOldLogs): Deletes request_logs older than retentionDays via datetime comparison, cascades to attempts via foreign key (lines 302-310).

#### Key Pool Management

- `src/server/services/key-pool-service.ts` (testKeys): Calls provider usage API (Tavily /usage or Firecrawl /team/credit-usage), saves health status (healthy/unhealthy) and quota snapshot, returns BatchActionResult with updated/failed counts (lines 196-204).
- `src/server/services/key-pool-service.ts` (syncKeyQuotas): Same as testKeys but includes Firecrawl historical data via /team/credit-usage/historical endpoint (lines 206-214).
- `src/server/repos/key-pool-repo.ts` (listManagedKeys): Loads keys with filters (provider, status, query, tag), decrypts secrets for query matching, strips secrets before returning (lines 128-138).
- `src/server/repos/key-pool-repo.ts` (saveKeyHealth): Updates last_check_status, last_checked_at, last_check_error for key ID (lines 169-182).
- `src/server/repos/key-pool-repo.ts` (saveKeyQuota): Updates quota_json, quota_synced_at for key ID (lines 184-196).
- `src/server/repos/key-pool-summary.ts` (buildKeyPoolSummary): Aggregates per-key quota data into pool-level summary with provider-specific logic (Tavily: sum key usage/limit, dedupe accounts; Firecrawl: sum `used` and `remaining` across keys under the project rule that each imported key belongs to a different team) (lines 101-121).

#### System Settings

- `src/server/repos/settings-repo.ts` (getSystemSettings): Loads all system_settings rows, parses JSON values, returns SystemSettings with fetchMode, providerPriority, defaultSearchModel, logRetentionDays, allowedOrigins (lines 29-46).
- `src/server/repos/settings-repo.ts` (saveSystemSetting): INSERT ... ON CONFLICT(key) DO UPDATE for single setting with JSON.stringify(value) (lines 48-56).
- `src/server/repos/settings-repo.ts` (getEffectiveMcpBearerToken): Reads mcp_bearer_token from DB, falls back to bootstrap.mcpBearerToken if empty (lines 76-82).

#### Admin Console Integration

- `src/web/App.tsx` (App): Root React component with 14 useState hooks for session, dashboard, providers, system, mcpAccess, activity, etc.; refreshAll() fires 5 parallel API requests on login; renders LoginView or ConsoleLayout based on session.loggedIn (lines 58-100).
- `src/web/api.ts` (apiRequest): Generic fetch wrapper with credentials: "same-origin", JSON content-type, error-to-throw conversion (not shown in evidence but referenced in App.tsx).
- `src/server/http/admin-routes.ts` (GET /admin/dashboard): Returns getDashboardSummary(context.db) with request rate, delivery stats, 24h trend, provider errors, latest errors (line 58-60).
- `src/server/repos/dashboard-repo.ts` (getDashboardSummary): Computes metrics from request_logs and request_attempt_logs with 10-minute RPM window, 24-hour delivery window, hourly trend buckets, provider error counts, latest 10 errors; uses in-memory cache with invalidation on log insert (lines 154-168).

### Report (The Answers)

#### result

**Startup Sequence:**

1. `main.ts:7-20` reads bootstrap config from environment variables (port, host, database path, encryption key, admin auth key, session secret, MCP bearer token, trust proxy flag)
2. Creates SQLite database with WAL mode, applies schema for 9 tables, runs migrations, seeds system settings and provider configs
3. Creates admin session store with HMAC-signed cookies and 12-hour TTL
4. Starts maintenance service with hourly cleanup timer (unref'd) for logs, sessions, and expired admin sessions
5. Creates Express app with helmet CSP, JSON body parser, auth router (public), admin router (protected), MCP routes (protected), static files, SPA fallback, error handler
6. Listens on configured host:port (default 0.0.0.0:8097)

**AppContext Shape:**

```typescript
interface AppContext {
  bootstrap: BootstrapConfig;  // port, host, databasePath, encryptionKey, adminAuthKey, sessionSecret, mcpBearerToken, trustProxy
  db: AppDatabase;             // sqlite: DatabaseSync, now(): string
  adminSessions: AdminSessionStore;  // createSession, destroySession, hasSession, cleanupExpired
}
```

**Express and MCP Wiring:**

- `app.ts:57` mounts auth router at `/api/admin` (public: session check, login, logout)
- `app.ts:58-63` mounts admin router at `/api/admin` with `requireAdminAuth` + `requireAdminWriteOrigin` middleware (23 protected endpoints)
- `app.ts:65-73` mounts MCP routes at `/mcp` with `requireMcpAuth` + `requireAllowedOrigin` middleware:
  - POST /mcp: handles initialize (creates transport) and subsequent tool calls (delegates to existing transport)
  - GET /mcp: provides SSE channel for server-initiated messages
  - DELETE /mcp: triggers transport close and session cleanup

**MCP Session Lifecycle:**

1. Client sends POST /mcp without `mcp-session-id` header, body is MCP initialize JSON-RPC request
2. `handleMcpPost` detects initialize request, calls `createTransport(context)`
3. `createTransport` instantiates `StreamableHTTPServerTransport` with randomUUID session ID generator
4. `onsessioninitialized` callback stores transport in in-memory Map with lastSeenAt timestamp
5. `createMcpServer(context)` creates McpServer instance and registers all 13 tools
6. Server connects to transport via `server.connect(transport)`
7. Subsequent requests include `mcp-session-id` header; `handleMcpPost` looks up transport and delegates
8. GET /mcp provides SSE streaming for existing session
9. DELETE /mcp triggers `transport.close()`, `onclose` callback removes session from Map
10. Idle sessions (30+ minutes) are swept every 5 minutes by `cleanupIdleTransports`

**Tool Registration Pattern:**

Each tool is registered via `server.registerTool(name, metadata, handler)`:
- `name`: string identifier (e.g., "web_search", "plan_intent")
- `metadata`: object with `description` (string) and `inputSchema` (Zod object)
- `handler`: async function receiving validated params, accessing `context` via closure, returning MCP content array

Example from `web_search` tool (lines 218-297):
- Zod schema validates query (string), platform (optional string), model (optional string), extra_sources (optional int >= 0)
- Handler calls `requireSearchEngineConfig` to load API credentials
- Validates model parameter against available models list
- Calls `searchWithSearchEngine` and `getExtraSources` in parallel
- Splits answer and sources via `splitAnswerAndSources`
- Saves session to `search_sessions` table
- Logs request to `request_logs` table
- Returns `toolJsonResult` with session_id, content, sources_count

**Auth Flow for MCP Bearer Token:**

1. Client includes `Authorization: Bearer <token>` header in MCP request
2. `requireMcpAuth` middleware (lines 37-49 in middleware.ts) extracts token from header
3. Calls `getEffectiveMcpBearerToken(db, bootstrap.mcpBearerToken)` which reads `mcp_bearer_token` from system_settings table, falls back to bootstrap value if empty
4. Compares extracted token against effective token via `hasMatchingBearerToken` (timing-safe comparison)
5. Returns 401 with `{error: "invalid_token"}` on mismatch
6. Passes to next middleware (`requireAllowedOrigin`) on match
7. `requireAllowedOrigin` checks Origin header against `allowedOrigins` system setting (empty array = allow all)
8. Returns 403 with `{error: "origin_not_allowed"}` on mismatch
9. Passes to route handler on match

#### conclusions

- BitSearch uses a single-process architecture with in-memory MCP session storage (Map) and embedded SQLite database (WAL mode)
- MCP transport is HTTP+SSE based via `StreamableHTTPServerTransport` from `@modelcontextprotocol/sdk`, not stdio
- Each MCP session gets its own `McpServer` instance but shares the same `AppContext` (database, bootstrap config, admin sessions)
- Authentication is two-layer: Bearer token validation (MCP API) and session cookie validation (Admin UI)
- Tool registration uses Zod schemas for input validation at the MCP boundary; downstream services rely on TypeScript types
- Key pool uses LRU rotation via `COALESCE(last_used_at, created_at) ASC` ordering; `markKeyUsage` updates timestamp on every attempt
- Provider routing supports three modes: strict_firecrawl, strict_tavily, auto_ordered (user-configured priority)
- Error classification distinguishes retryable (429, 408, 5xx, timeout, network) from non-retryable (other 4xx) to optimize failover
- Planning engine is stateful with 6 phases stored in SQLite; complexity level gates required phases (1=3, 2=5, 3=6)
- Activity logging is two-level: request_logs (top-level) + request_attempt_logs (per-provider-key attempts) with foreign key cascade
- Maintenance service runs hourly cleanup (unref'd timer) for logs, search sessions, planning sessions, and expired admin sessions based on logRetentionDays setting
- Admin console is React 19 SPA with hash-based navigation, no external state management, props drilling from App root

#### relations

- `main.ts` calls `readBootstrapConfig()` -> `createDatabase(bootstrap)` -> `createAdminSessionStore(bootstrap.sessionSecret)` -> `startMaintenance(context)` -> `createApp(context)` -> `app.listen()`
- `createApp` mounts `createAuthRouter(context)` at `/api/admin` (public) and `createAdminRouter(context)` at `/api/admin` (protected)
- `createApp` mounts `handleMcpPost`, `handleMcpGet`, `handleMcpDelete` at `/mcp` with `requireMcpAuth` + `requireAllowedOrigin` middleware
- `handleMcpPost` calls `createTransport(context)` which calls `createMcpServer(context)` and `server.connect(transport)`
- `createMcpServer` registers 13 tools, each handler accesses `context.db` and `context.bootstrap` via closure
- `web_search` tool calls `requireSearchEngineConfig(context)` -> `searchWithSearchEngine(config, messages)` -> `requestTextStream(url, options)` -> SSE parsing
- `web_search` tool calls `getExtraSources(context, query, count)` -> `getCandidateKeys(db, provider, encryptionKey)` -> `tavilySearch` or `firecrawlSearch` -> `markKeyUsage(db, keyId, statusCode, error)`
- `web_fetch` and `web_map` tools call `runWithKeyPool(context, toolName, targetUrl, input, executor)` -> `resolveProviders(fetchMode, priority)` -> `getCandidateKeys(db, provider, encryptionKey)` -> executor callback -> `markKeyUsage` -> `insertRequestLog` + `insertAttemptLogs`
- Planning tools call `processPlanningPhase(context, phaseName, payload)` -> `ensurePlanningSession(db, sessionId)` -> `getPlanningSnapshot(db, sessionId)` -> `mergePhaseData` -> `savePlanningPhase(db, sessionId, record)` -> `updatePlanningComplexity` (on phase 2)
- `requireMcpAuth` calls `getEffectiveMcpBearerToken(db, bootstrap.mcpBearerToken)` -> `hasMatchingBearerToken(authHeader, expectedToken)` -> timing-safe comparison
- `requireAllowedOrigin` calls `getSystemSettings(db).allowedOrigins` -> `isRequestOriginAllowed(req, allowedOrigins, trustProxy)` -> Origin header check
- `requireAdminAuth` calls `context.adminSessions.hasSession(cookieHeader)` -> HMAC signature verification -> session expiry check
- `createDatabase` calls `seedSystemSettings(db, now, mcpBearerToken)` which inserts default values for fetch_mode, provider_priority, default_search_model, log_retention_days, allowed_origins, mcp_bearer_token
- `startMaintenance` calls `cleanupOldLogs(db, logRetentionDays)` + `cleanupSearchSessions(db, logRetentionDays)` + `cleanupPlanningSessions(db, logRetentionDays)` + `context.adminSessions.cleanupExpired()` every hour
- `insertRequestLog` and `insertAttemptLogs` call `invalidateDashboardSummaryCache()` to bust in-memory cache
- `getDashboardSummary` checks `getCachedDashboardSummary(now)` -> computes metrics from request_logs and request_attempt_logs -> `setCachedDashboardSummary(summary, now)`
