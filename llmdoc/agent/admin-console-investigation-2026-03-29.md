<!-- BitSearch Admin Console & Server Investigation Report -->

### Code Sections (The Evidence)

#### Frontend Architecture

- `src/web/App.tsx` (App): Root React component with 14 useState hooks managing session, dashboard, providers, system settings, MCP access, activity, and workspace refresh state. Orchestrates authentication flow, data fetching via `refreshAll()`, and renders either LoginView or ConsoleLayout with nested Routes.
- `src/web/main.tsx`: Entry point rendering App inside StrictMode and BrowserRouter, imports global CSS.
- `src/web/api.ts` (apiRequest): Generic fetch wrapper with `credentials: "same-origin"`, JSON content-type, returns `ApiResult<T>` discriminated union. No retry logic or interceptors.
- `src/web/types.ts`: Frontend-only TypeScript types extending shared contracts - SessionState, ProviderDraft, ProviderDrafts, KeySortMode, AppDataBundle.
- `src/web/toast-store.ts` (enqueueToast, dismissToast, useToastStore): Module-scoped toast queue with React useSyncExternalStore integration, 4.5s auto-dismiss timer.

#### Routing & Layout

- `src/web/components/ConsoleChrome.tsx` (ConsoleLayout, SidebarNav): Shell layout with 280px sidebar, topbar with refresh/logout buttons, mobile drawer. Uses React Router 7 NavLink for navigation. Four routes: /overview, /providers, /keys, /activity.
- `src/web/App.tsx` (Routes): React Router 7 Routes with ConsoleLayout as parent, four workspace routes as children, index redirects to /overview. Auto-refresh dashboard every 30s when on /overview route.

#### Page Components

- `src/web/pages/OverviewWorkspace.tsx` (OverviewWorkspace): Dashboard page rendering OverviewPulsePanel, StrategyPanel, RequestTrendPanel, and LatestErrorsPanel. Passes dashboard, system, mcpAccess, providers props downward.
- `src/web/pages/ProvidersWorkspace.tsx` (ProvidersWorkspace): Provider configuration page rendering ProviderGrid with drafts state and save handlers.
- `src/web/pages/KeysWorkspace.tsx` (KeysWorkspace): Key pool management page rendering KeyPoolsWorkspace with toast handler and refresh nonce.
- `src/web/pages/ActivityWorkspace.tsx` (ActivityWorkspace): Request activity page rendering ActivityHub component.

#### Key Management State

- `src/web/components/useKeyWorkspace.ts` (useKeyWorkspace): Custom hook managing 11 state variables for key workspace - provider, rawKeys, importTags, status, tag, query, sortMode, keys, summary, selectedIds, revealedValues, loading. Fetches keys and summary in parallel on filter/provider change. Returns merged state and actions from useKeyWorkspaceActions.
- `src/web/components/useKeyWorkspaceActions.ts` (useKeyWorkspaceActions): Custom hook managing 13 pending state sets for async actions - importing, testing, syncing, deleting, revealing, copying, toggling, saving notes. Implements runPendingAction helper for consistent error handling and refresh flow.
- `src/web/components/KeyPoolsWorkspace.tsx` (KeyPoolsWorkspace): Key inventory UI with collapsible import panel, filter bar, bulk action toolbar, paginated key grid (16 per page), and confirm delete dialog. Switches between filter UI and bulk action bar based on selection state.

#### Activity Feed

- `src/web/components/ActivityHub.tsx` (ActivityHub): Two-column layout with request feed (left) and detail panel (right). Implements search, tool filter, status filter, time range presets, custom date range, and pagination (25 per page). Debounces filter changes by 300ms.
- `src/web/components/RequestDetails.tsx` (RequestDetails): Tabbed detail view with Overview, Attempts, and Messages tabs. Shows request metadata, provider failover chain, and execution timeline.

#### Formatting & Utilities

- `src/web/format.ts`: Display formatting utilities - formatDuration (ms), formatDateTime (zh-CN locale), formatNumber (zh-CN locale), formatDecimal, formatPercentage, statusTone (maps status to color tone), getErrorMessage.

#### Server Architecture

- `src/server/main.ts` (main): Entry point loading bootstrap config, creating database, admin session store, starting maintenance service, creating Express app, and listening on configured host/port.
- `src/server/app.ts` (createApp): Express factory mounting helmet CSP, JSON body parser, healthz endpoint, auth router (public), admin router (protected), MCP routes (protected), static files, SPA fallback, and global error handler.
- `src/server/app-context.ts`: AppContext type bundling bootstrap config, database, and admin session store.

#### Authentication & Sessions

- `src/server/lib/admin-session.ts` (createAdminSessionStore): In-memory session store with HMAC-SHA256 signed cookies. Cookie name: `bitsearch_admin_session`, TTL: 12 hours, httpOnly, sameSite: strict, secure in production. Implements createSession, destroySession, hasSession, cleanupExpired.
- `src/server/lib/auth.ts` (parseBearerToken, hasMatchingBearerToken, hasMatchingSecret): Bearer token parsing and timing-safe comparison using SHA-256 hashing and timingSafeEqual.
- `src/server/http/auth-routes.ts` (createAuthRouter): Three public endpoints - GET /session (check session), POST /login (validate authKey, create session), POST /logout (destroy session).
- `src/server/http/middleware.ts` (requireAdminAuth, requireMcpAuth, requireAllowedOrigin, requireAdminWriteOrigin): Route guards checking session cookies, Bearer tokens, and Origin headers against allowlist.

#### Admin API Endpoints

- `src/server/http/admin-routes.ts` (createAdminRouter): 23 protected endpoints across dashboard, system, MCP access, providers, keys, logs, and activity. All require valid session cookie. Returns JSON responses with error objects on failure.
  - Dashboard: GET /dashboard (metrics), GET /system (settings), PUT /system (update settings)
  - MCP Access: GET /mcp-access (connection info), PUT /mcp-access (update token), POST /mcp-access/reveal (decrypt token)
  - Providers: GET /providers (list configs), PUT /providers/:provider (update config), GET /providers/:provider/models (probe search_engine models)
  - Keys: GET /keys (list with filters), GET /keys/summary (aggregated stats), POST /keys/import-text (bulk import), POST /keys/import-csv (CSV import), PATCH /keys/meta (update note), PATCH /keys/bulk (enable/disable), POST /keys/test (health check), POST /keys/quota-sync (sync quotas), POST /keys/reveal (decrypt secret), DELETE /keys (bulk delete), GET /keys/export.csv (export metadata)
  - Activity: GET /logs (request logs), GET /activity (paginated activity with filters), GET /activity/:requestId (single request detail), GET /logs/attempts (attempt logs)

#### Database Repositories

- `src/server/repos/dashboard-repo.ts` (getDashboardSummary): Aggregates request rate (10m window), delivery stats (24h window), hourly trend (24 buckets), provider errors, and latest errors. Caches result for 10s via dashboard-cache service.
- `src/server/repos/settings-repo.ts` (getSystemSettings, saveSystemSettings, getEffectiveMcpBearerToken, saveMcpBearerToken): Reads/writes system_settings table with JSON-serialized values. Merges stored MCP token with bootstrap fallback.
- `src/server/repos/provider-repo.ts` (listProviderConfigs, getProviderConfig, saveProviderConfig, getProviderApiKey, listProviderKeys, importKeys, setKeysEnabled, deleteKeys, getCandidateKeys, markKeyUsage): Provider config and key pool CRUD operations. Encrypts/decrypts secrets via crypto lib. LRU key selection via `COALESCE(last_used_at, created_at) ASC` ordering.
- `src/server/repos/log-repo.ts` (insertRequestLog, insertAttemptLogs, listRequestLogs, listRequestAttempts, listRequestActivities, getRequestActivity, cleanupOldLogs): Request and attempt logging with JSON column parsing. Activity endpoint supports pagination, search, tool/status/time filters. Invalidates dashboard cache on insert.

#### Services

- `src/server/services/dashboard-cache.ts` (getCachedDashboardSummary, setCachedDashboardSummary, invalidateDashboardSummaryCache): Module-scoped cache with 10s TTL. Invalidated on log insert.
- `src/server/services/maintenance-service.ts` (startMaintenance): Runs cleanup pass every 60 minutes - cleanupOldLogs, cleanupSearchSessions, cleanupPlanningSessions, adminSessions.cleanupExpired. Uses unref timer to avoid blocking shutdown.
- `src/server/services/mcp-access-service.ts` (getMcpAccessInfo): Constructs MCP connection info from request protocol/host (respects X-Forwarded-* headers if trustProxy enabled), returns streamHttpUrl, authScheme, hasBearerToken, tokenPreview (last 4 chars).

#### Shared Contracts

- `src/shared/contracts.ts`: Single source of truth for all TypeScript interfaces and union types shared between frontend and backend. Defines 40+ types including ProviderConfigRecord, ProviderKeyRecord, KeyPoolSummary, DashboardSummary, SystemSettings, RequestLogRecord, RequestActivityRecord, ActivityPageResult, McpAccessInfo.

### Report (The Answers)

#### result

**Routing Structure:**
- React Router 7 with BrowserRouter wrapping App component
- Single ConsoleLayout parent route with four child workspace routes: /overview, /providers, /keys, /activity
- Index route redirects to /overview
- Sidebar navigation uses NavLink with active state styling
- No code splitting - all routes render simultaneously in single scrollable page

**Page Components and State:**
- App.tsx is root state container with 14 useState hooks managing global state (session, dashboard, providers, system, mcpAccess, activity, drafts, loading flags)
- Four workspace pages are thin wrappers delegating to feature components (OverviewPulsePanel, ProviderGrid, KeyPoolsWorkspace, ActivityHub)
- Key workspace uses two custom hooks (useKeyWorkspace, useKeyWorkspaceActions) managing 24 total state variables for filters, selection, pending actions, and revealed secrets
- Activity workspace implements local state for pagination, filters, and selected request
- No external state management library - props drilling from App to all children

**API Call Patterns:**
- Generic apiRequest<T> wrapper in api.ts returns discriminated union ApiResult<T>
- All requests use `credentials: "same-origin"` for cookie-based auth
- No retry logic, no interceptors, no request cancellation
- Parallel fetching via Promise.all in refreshAll() (dashboard, providers, system, mcpAccess)
- Key workspace fetches keys and summary in parallel on filter change
- Activity hub debounces filter changes by 300ms before fetching
- Toast notifications on success/error via module-scoped toast-store

**Auth Flow:**
- Login: POST /api/admin/login with authKey → server validates via hasMatchingSecret → creates HMAC-signed session cookie → returns {loggedIn: true}
- Session check: GET /api/admin/session → server checks cookie signature and expiry → returns {loggedIn: boolean}
- Logout: POST /api/admin/logout → server deletes session from in-memory Map → clears cookie → returns {loggedIn: false}
- Protected routes: requireAdminAuth middleware checks cookie on every request, returns 401 if invalid
- Session cookie: bitsearch_admin_session, 12h TTL, httpOnly, sameSite: strict, secure in production

**Dashboard Metrics:**
- Request rate: RPM over 10-minute window, total request count in window
- Delivery stats: 24h window with total/successful/failed counts and error rate percentage
- Hourly trend: 24 hourly buckets with success/failed counts per bucket
- Provider errors: 24h aggregation of failed attempts grouped by provider
- Latest errors: Last 10 failed requests from 24h window
- Cached for 10 seconds, invalidated on new log insert

**Maintenance Tasks:**
- Runs every 60 minutes via setInterval with unref() to avoid blocking shutdown
- cleanupOldLogs: Deletes request_logs older than logRetentionDays (default 7)
- cleanupSearchSessions: Deletes search_sessions older than retention period
- cleanupPlanningSessions: Deletes planning_sessions older than retention period
- adminSessions.cleanupExpired: Removes expired sessions from in-memory Map

**MCP Access Token Management:**
- Stored in system_settings table with key "mcp_bearer_token" as JSON string
- Falls back to bootstrap.mcpBearerToken (from MCP_BEARER_TOKEN env var, dev default: "bitsearch-dev-token")
- GET /mcp-access returns connection info with masked token preview (last 4 chars)
- PUT /mcp-access updates stored token, returns new connection info
- POST /mcp-access/reveal returns full decrypted token
- Used by requireMcpAuth middleware for Bearer token validation on /mcp routes

**Session Cookie Details:**
- Name: bitsearch_admin_session
- Value format: {sessionId}.{hmac-sha256-signature}
- TTL: 12 hours (43,200,000 ms)
- Flags: httpOnly, sameSite: strict, secure (production only), path: /
- Signature: HMAC-SHA256 of sessionId using bootstrap.sessionSecret
- Storage: In-memory Map<sessionId, {expiresAt}> in admin session store
- Validation: Parses cookie, splits on ".", verifies signature via timingSafeEqual, checks expiry

#### conclusions

- Admin console is a React 19 SPA with hash-based navigation and no code splitting - all sections render simultaneously in single scrollable page
- Authentication uses HMAC-signed httpOnly session cookies with 12h TTL, stored in-memory (no Redis/external store)
- API layer is a thin fetch wrapper with no retry/interceptor logic - relies on manual error handling in components
- Key management state is complex with 24 state variables split across two custom hooks managing filters, selection, and 13 pending action states
- Dashboard metrics are cached for 10s and invalidated on log insert to reduce SQLite query load
- Maintenance runs hourly cleanup tasks for logs, sessions, and planning data based on configurable retention period
- MCP access token is stored in database with fallback to env var, exposed via masked preview and reveal endpoint
- Activity feed supports pagination, search, and multi-dimensional filtering (tool, status, time range) with 300ms debounce
- All admin endpoints require session cookie validation via middleware, write operations additionally check Origin header against allowlist
- Session store is in-memory Map with periodic cleanup - sessions lost on server restart

#### relations

- `App.tsx` calls `apiRequest` from `api.ts` for all backend communication
- `App.tsx` passes `refreshAll` callback to child components via `refreshNonce` prop to trigger workspace refresh
- `App.tsx` passes `enqueueToast` callback to child components via `onToast` prop for notification display
- `useKeyWorkspace` calls `useKeyWorkspaceActions` and merges returned actions with local state
- `useKeyWorkspaceActions` calls `apiRequest` for all key operations (import, test, sync, delete, reveal, toggle, save note)
- `KeyPoolsWorkspace` calls `useKeyWorkspace` hook and renders UI based on returned state
- `ActivityHub` calls `apiRequest` to fetch paginated activity with filters, debounces filter changes via useEffect
- `ConsoleLayout` renders `Outlet` from React Router 7 for nested workspace routes
- `createApp` mounts `createAuthRouter` at /api/admin (public) and `createAdminRouter` at /api/admin (protected)
- `createAdminRouter` calls repository functions (dashboard-repo, settings-repo, provider-repo, log-repo, key-pool-repo) for data access
- `getDashboardSummary` calls `getCachedDashboardSummary` and `setCachedDashboardSummary` from dashboard-cache service
- `insertRequestLog` and `insertAttemptLogs` call `invalidateDashboardSummaryCache` to bust cache on new data
- `requireAdminAuth` middleware calls `context.adminSessions.hasSession` to validate session cookie
- `requireMcpAuth` middleware calls `getEffectiveMcpBearerToken` and `hasMatchingBearerToken` to validate Bearer token
- `createAdminSessionStore` returns object with createSession, destroySession, hasSession, cleanupExpired methods
- `startMaintenance` calls `cleanupOldLogs`, `cleanupSearchSessions`, `cleanupPlanningSessions`, and `adminSessions.cleanupExpired` every 60 minutes
- `getMcpAccessInfo` calls `getEffectiveMcpBearerToken` to merge stored token with bootstrap fallback
