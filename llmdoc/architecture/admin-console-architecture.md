# Architecture of the Admin Console (Aether Console)

## 1. Identity

- **What it is:** A React 19 single-page application serving as the operations console for the BitSearch MCP service.
- **Purpose:** Provides admin users with a unified control surface for managing providers, API key pools, system settings, security, and request observability.

## 2. Core Components

- `src/web/main.tsx` (root render): Entry point; wraps `App` in `StrictMode` and `BrowserRouter`, imports global CSS.
- `src/web/App.tsx` (App): Root state container with 15 `useState` hooks (added `toasts` via `useToastStore`); orchestrates session, data fetching (`refreshAll`), and renders either `LoginView` or the React Router 7 route tree.
- `src/web/api.ts` (apiRequest): Generic fetch wrapper with JSON content-type, `credentials: "same-origin"`, structured error result. Signature: `apiRequest<T>(method, path, body?)` -- e.g., `apiRequest<ResponseType>("GET", "/api/admin/your-endpoint")` or `apiRequest<ResponseType>("POST", "/api/admin/your-endpoint", body)`. Returns `ApiResult<T>` (`{ ok: true, data }` | `{ ok: false, status, message }`). No retry, no interceptors.
- `src/web/types.ts` (SessionState, ProviderDraft, AppDataBundle): Frontend-only types extending shared contracts.
- `src/web/format.ts`: Display formatting utilities (duration, datetime, numbers with zh-CN locale).
- `src/web/components/ConsoleChrome.tsx` (ConsoleLayout): Shell chrome -- sidebar navigation via React Router `<NavLink>` for `/overview`, `/providers`, `/keys`, `/activity`; header with refresh/logout; renders workspace content via `<Outlet />`.
- `src/web/pages/OverviewWorkspace.tsx` (OverviewWorkspace): Overview workspace page -- dashboard metrics, MCP access config, system settings, provider summary.
- `src/web/pages/ProvidersWorkspace.tsx` (ProvidersWorkspace): Providers workspace page -- per-provider enable/disable, API key, base URL, timeout, and search model configuration.
- `src/web/pages/KeysWorkspace.tsx` (KeysWorkspace): Keys workspace page -- key pool management; coordinates import and inventory panels.
- `src/web/pages/ActivityWorkspace.tsx` (ActivityWorkspace): Activity workspace page -- two-column request feed with search/filter and tabbed detail panel.
- `src/web/toast-store.ts` (enqueueToast, dismissToast, useToastStore): Lightweight global toast notification state; exposes imperative helpers and a React hook for reading the queue.
- `src/web/components/Feedback.tsx` (ToastViewport): Renders the active toast list; mounted once at the `App` root above the route tree.
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
- **3.** `App` calls `checkSession()` on mount, fetching `GET /api/admin/session`.
- **4.** If not logged in, `App` renders `LoginView`. User submits credentials via `POST /api/admin/login`.
- **5.** On successful login, `checkSession()` re-fires, `session.loggedIn` becomes true, triggering `refreshAll()`.
- **6.** `refreshAll()` fires 4 parallel requests (`Promise.all`): dashboard, providers, system, mcp-access.
- **7.** State setters update corresponding state variables; React re-renders the workspace route tree.

### Console Shell Layout

- **8.** `App` renders `<ToastViewport>` and a `<Routes>` tree; the root `<Route>` mounts `<ConsoleLayout>` (shell chrome with `<Outlet />`).
- **9.** Sidebar (`ConsoleLayout`) provides React Router `<NavLink>` navigation to four workspace routes: `/overview`, `/providers`, `/keys`, `/activity`.
- **10.** The `<Outlet />` renders the active workspace component exclusively: `OverviewWorkspace`, `ProvidersWorkspace`, `KeysWorkspace`, or `ActivityWorkspace`.
- **11.** Index and unmatched routes both redirect to `/overview` via `<Navigate replace to="/overview" />`.

### Authentication Middleware (Server)

- **12.** `src/server/app.ts:50` mounts auth router at `/api/admin` without middleware (public).
- **13.** `src/server/app.ts:51` mounts admin router at `/api/admin` with `requireAdmin` middleware.
- **14.** `requireAdmin` checks `req.session.adminUserId`, verifies user in DB, loads username into `res.locals`.
- **15.** Session uses `express-session` with httpOnly, sameSite=lax, secure in production cookies.

### State Management Pattern

- **16.** User action -> async handler in component -> `apiRequest()` to backend -> `refreshAll()` or local re-fetch -> state setter -> React re-render.
- **17.** No external state library. Props drilling from `App` to all children. `onMessage` callback propagates toast messages upward.
- **18.** `KeysWorkspace` is connected to `App` via `onToast` callback and `refreshNonce` prop (incremented by `refreshAll` to signal workspace-level re-fetch).
- **19.** `App.tsx` implements a 30-second dashboard auto-refresh (`AUTO_REFRESH_INTERVAL_MS = 30_000`) using `useEffectEvent`; the interval is registered only while the user is on the `/overview` route and authenticated, and is cleared on route change or logout.

## 4. Design Rationale

- **Workspace-based routing over single-page scroll:** The console uses React Router 7 (`react-router-dom`) to split the four major functional areas into independent route-level page components (`/overview`, `/providers`, `/keys`, `/activity`). Each workspace mounts only when its route is active, keeping per-workspace state isolated and simplifying per-route logic (e.g., the 30-second auto-refresh timer fires only on `/overview`).
- **No external state management:** The admin console is a single-user operations tool with modest complexity. Local hooks + props drilling avoids dependency overhead.
- **Dark cockpit theme (Aether Console):** Designed as a premium control surface per `.stitch/DESIGN.md` -- not a generic SaaS page. Uses glassmorphic surfaces, cyan primary accent, IBM Plex typography.
- **Shared contracts:** `src/shared/contracts.ts` serves as the single type authority imported by both frontend and backend, avoiding schema drift without code generation.
