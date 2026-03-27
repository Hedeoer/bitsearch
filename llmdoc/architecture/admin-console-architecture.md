# Architecture of the Admin Console (Aether Console)

## 1. Identity

- **What it is:** A React 19 single-page application serving as the operations console for the BitSearch MCP service.
- **Purpose:** Provides admin users with a unified control surface for managing providers, API key pools, system settings, security, and request observability.

## 2. Core Components

- `src/web/main.tsx` (root render): Entry point; wraps `App` in `StrictMode` and `BrowserRouter`, imports global CSS.
- `src/web/App.tsx` (App): Root state container with 14 `useState` hooks; orchestrates session, data fetching (`refreshAll`), and renders either `LoginView` or the console shell.
- `src/web/api.ts` (apiRequest): Generic fetch wrapper with JSON content-type, `credentials: "same-origin"`, error-to-throw conversion. No retry, no interceptors.
- `src/web/types.ts` (SessionState, ProviderDraft, AppDataBundle): Frontend-only types extending shared contracts.
- `src/web/format.ts`: Display formatting utilities (duration, datetime, numbers with zh-CN locale).
- `src/web/components/ConsoleChrome.tsx` (ConsoleSidebar, ShellHeader, StatusToast): Shell chrome -- sidebar navigation via hash anchors, header with refresh/logout, toast notifications.
- `src/web/components/OverviewPanels.tsx` (OverviewPanel, StrategyPanel, ProviderGrid): Dashboard metrics, global routing config, and provider cards.
- `src/web/components/SecurityPanel.tsx` (SecurityPanel): Password management form.
- `src/web/components/ActivityHub.tsx` (ActivityHub): Two-column request feed + detail panel with search/filter.
- `src/web/components/RequestDetails.tsx` (RequestDetails, OverviewTab, AttemptsTab, MessagesTab): Tabbed request inspection.
- `src/web/components/KeyPoolsWorkspace.tsx` (KeyPoolsWorkspace): Key management container with 11 local state hooks; coordinates import and inventory panels.
- `src/web/components/KeyPoolImportPanel.tsx` (KeyPoolImportPanel): Bulk key import interface.
- `src/web/components/KeyInventoryPanel.tsx` (KeyInventoryPanel, SummaryCards): Key list with filtering, batch actions, summary metrics.
- `src/web/components/KeyInventoryCard.tsx` (KeyInventoryCard): Individual key card with reveal/copy/test/sync/delete actions.
- `src/web/LoginView.tsx` (LoginView): Authentication form (username + password).

### CSS Architecture

- `src/web/theme.css`: Design tokens (CSS custom properties), dark cockpit palette, typography stacks, base element resets, button/chip/pill variants.
- `src/web/styles.css`: Imports `theme.css`; defines grid layouts (`.console-shell`: 280px sidebar + flex main), component surfaces, data display, responsive breakpoint at 1100px.
- `src/web/key-pools.css`: Feature-specific styles for key management workspace (card layouts, selection states, filters).

### Server-Side (Auth + API)

- `src/server/app.ts` (createApp): Express factory; mounts global middleware chain, auth router (public), admin router (protected), MCP routes, static files, SPA fallback.
- `src/server/http/auth-routes.ts` (createAuthRouter): Three public endpoints -- session check, login, logout.
- `src/server/http/admin-routes.ts` (createAdminRouter): 20+ protected endpoints for all admin operations.
- `src/server/http/middleware.ts` (requireAdmin, requireMcpAuth, requireAllowedOrigin): Route-level guards.
- `src/shared/contracts.ts`: Single source of truth for all shared TypeScript interfaces and union types.

## 3. Execution Flow (LLM Retrieval Map)

### Application Bootstrap

- **1.** Browser loads `index.html` which imports `src/web/main.tsx` as ES module.
- **2.** `main.tsx` renders `<App />` inside `StrictMode` + `BrowserRouter`.
- **3.** `App` calls `loadSession()` on mount, fetching `GET /api/admin/session`.
- **4.** If not logged in, `App` renders `LoginView`. User submits credentials via `POST /api/admin/login`.
- **5.** On successful login, `loadSession()` re-fires, `session.loggedIn` becomes true, triggering `refreshAll()`.
- **6.** `refreshAll()` fires 5 parallel requests (`Promise.all`): profile, dashboard, providers, system, activity.
- **7.** State setters update 6 state variables; React re-renders the full console shell.

### Console Shell Layout

- **8.** `App` renders `<main className="console-shell">` -- a CSS Grid with 280px sidebar + flexible main area.
- **9.** Sidebar (`ConsoleSidebar`) provides hash-based navigation: `#overview`, `#providers`, `#keys`, `#security`, `#activity`.
- **10.** Main area stacks sections vertically: `ShellHeader` -> `StatusToast` -> `overview-grid` -> `settings-grid` -> `ProviderGrid` -> `KeyPoolsWorkspace` -> `ActivityHub`.
- **11.** All sections render simultaneously; hash links scroll to anchored positions.

### Authentication Middleware (Server)

- **12.** `src/server/app.ts:50` mounts auth router at `/api/admin` without middleware (public).
- **13.** `src/server/app.ts:51` mounts admin router at `/api/admin` with `requireAdmin` middleware.
- **14.** `requireAdmin` checks `req.session.adminUserId`, verifies user in DB, loads username into `res.locals`.
- **15.** Session uses `express-session` with httpOnly, sameSite=lax, secure in production cookies.

### State Management Pattern

- **16.** User action -> async handler in component -> `apiRequest()` to backend -> `refreshAll()` or local re-fetch -> state setter -> React re-render.
- **17.** No external state library. Props drilling from `App` to all children. `onMessage` callback propagates toast messages upward.
- **18.** `KeyPoolsWorkspace` manages its own 11 state hooks independently, connected to `App` via `onMessage` and `refreshNonce` props.

## 4. Design Rationale

- **Hash navigation over client-side routing:** All sections render simultaneously in a single scrollable page; hash anchors provide jump-to navigation without route-based code splitting. `BrowserRouter` is mounted but unused for navigation.
- **No external state management:** The admin console is a single-user operations tool with modest complexity. Local hooks + props drilling avoids dependency overhead.
- **Dark cockpit theme (Aether Console):** Designed as a premium control surface per `.stitch/DESIGN.md` -- not a generic SaaS page. Uses glassmorphic surfaces, cyan primary accent, IBM Plex typography.
- **Shared contracts:** `src/shared/contracts.ts` serves as the single type authority imported by both frontend and backend, avoiding schema drift without code generation.
