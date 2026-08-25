# Architecture of the Admin Console

> 2026-08-24 随「方向 A · 暖光工作台」布局重设计修订：路由层拆分、CSS 体系、
> 认证实现、视觉基调均已按现状更新。视觉规范以
> `llmdoc/architecture/admin-design-system.md` 为唯一事实源。

## 1. Identity

- **What it is:** A React 19 single-page application serving as the operations console for the BitSearch MCP service.
- **Purpose:** Provides admin users with a unified control surface for managing providers, API key pools, system settings, security, and request observability.

## 2. Core Components

- `src/web/main.tsx` (root render): Entry point; wraps `App` in `StrictMode` and `BrowserRouter`, imports global CSS (only `./app.css`).
- `src/web/App.tsx` (App): Root state container (`useState` + `useToastStore`); orchestrates session, data fetching (`refreshAll`), and renders either `LoginView` or the route shell.
- `src/web/AppShell.tsx` (routes): Thin router layer — defines the four workspace `<Route>`s under a parent route mounting `ConsoleLayout`; `/` and `*` redirect to `/overview`.
- `src/web/api.ts` (apiRequest): Generic fetch wrapper with JSON content-type, `credentials: "same-origin"`, structured error result. Signature: `apiRequest<T>(method, path, body?)`. Returns `ApiResult<T>` (`{ ok: true, data }` | `{ ok: false, status, message }`). No retry, no interceptors.
- `src/web/types.ts` (SessionState, ProviderDraft, AppDataBundle): Frontend-only types extending shared contracts.
- `src/web/format.ts`: Display formatting utilities (duration, datetime, numbers with zh-CN locale).
- `src/web/components/ConsoleChrome.tsx` (ConsoleLayout): Shell chrome — 224px fixed sidebar（lg+ 唯一持久 chrome：logo 卡、Monitor / Configure 两组 `<NavLink>` 导航、底部刷新/主题/退出操作行），桌面端无顶栏；<lg 保留精简顶栏（汉堡 + 品牌 + 主题/退出），导航收进 Sheet 抽屉；内容经 `<Outlet />` 渲染；壳层含暖光氛围层 `.console-atmosphere`。
- `src/web/pages/OverviewWorkspace.tsx` (OverviewWorkspace): Overview workspace page — 三段式：8 张指标卡两行（流量四卡 + Routing/readiness/active providers/enabled keys）、全宽 Request trend 图表卡（ChartContainer 面积图 + 24h/7d/30d ToggleGroup 切换）、底部双栏（Latest errors | routing/access config）。
- `src/web/pages/ProvidersWorkspace.tsx` (ProvidersWorkspace): Providers workspace page — per-provider enable/disable, API key, base URL, timeout, search model configuration, tool surface（MCP Tool Exposure 卡支持点击工具 chip 手动禁用/启用，经 `PUT /api/admin/tools/disabled` 持久化并广播 `tools/list_changed`）.
- `src/web/pages/KeysWorkspace.tsx` (KeysWorkspace): Keys workspace page — key pool management; coordinates import and inventory panels.
- `src/web/pages/ActivityWorkspace.tsx` (ActivityWorkspace): Activity workspace page — two-column request feed with search/filter and tabbed detail inspector.
- `src/web/toast-store.ts` (enqueueToast, dismissToast, useToastStore): Lightweight global toast notification state; exposes imperative helpers and a React hook for reading the queue.
- `src/web/components/Feedback.tsx` (LoadingOverlay / InlineSpinner / EmptyState / ConfirmDialog): Shared status components; `Toaster` (sonner) 挂载在 `App.tsx`（壳层之外，登录页同样可用）。
- `src/web/LoginView.tsx` (LoginView): Authentication form — 单一 Authorization Key 字段（`auth-key-input`，password 型）。

### CSS Architecture

- `src/web/app.css`：唯一自定义 CSS 编译入口。`@import "tailwindcss"` + `@import "./admin-theme.css"` 必须同一次编译（分开导入会导致 primary/card/muted 等语义工具类不被生成）；另含登录页与壳层氛围动效类。
- `src/web/admin-theme.css`：Tailwind v4 CSS-based 配置（无 `tailwind.config.js`）。tweakcn 生成的 oklch token（light `.dark` 两套）经 `@theme inline` 映射为 `bg-card`/`text-muted-foreground` 等语义工具类；含 `--success/--warning`（手工维护）、`--shadow-glow`（方向 A 主面板染色阴影）与字体定义（`--font-sans: Inter`、`--font-mono: JetBrains Mono`，字体权威定义须留 `:root`，不得进 `@theme inline`）。
- 页面样式一律用 Tailwind 语义工具类 + shadcn 组件，无 feature 级 CSS 文件。

### Server-Side (Auth + API)

- `src/server/app.ts` (createApp): Express factory; mounts global middleware chain, auth router (public), admin router (protected), MCP routes, static files, SPA fallback.
- `src/server/http/auth-routes.ts` (createAuthRouter): Three public endpoints — session check, login, logout.
- `src/server/http/admin-routes.ts` (createAdminRouter): 20+ protected endpoints for all admin operations.
- `src/server/http/middleware.ts` (requireAdmin, requireMcpAuth, requireAllowedOrigin): Route-level guards.
- `src/server/lib/admin-session.ts` (AdminSessionStore): 自研 HMAC 签名 cookie 会话（非 express-session）。
- `src/shared/contracts.ts`: Single source of truth for all shared TypeScript interfaces and union types.

## 3. Execution Flow (LLM Retrieval Map)

### Application Bootstrap

- **1.** Browser loads `index.html` which imports `src/web/main.tsx` as ES module; 内联脚本按 `localStorage["admin-theme"]` / `prefers-color-scheme` 防 FOUC 设 `.dark`。
- **2.** `main.tsx` renders `<App />` inside `StrictMode` + `BrowserRouter`.
- **3.** `App` calls `checkSession()` on mount, fetching `GET /api/admin/session`.
- **4.** If not logged in, `App` renders `LoginView`. User submits `{ authKey }` via `POST /api/admin/login`.
- **5.** On successful login, `checkSession()` re-fires, `session.loggedIn` becomes true, triggering `refreshAll()`.
- **6.** `refreshAll()` fires 6 parallel requests (`Promise.all`): dashboard, providers, system, tool-surface, admin-access, mcp-access.
- **7.** State setters update corresponding state variables; React re-renders the workspace route tree.

### Console Shell Layout

- **8.** `App` renders `<Toaster>` (sonner) and `<AppShell>`；`AppShell` 的路由树根挂载 `ConsoleLayout`（壳层 + `<Outlet />`）。
- **9.** 侧栏（`ConsoleLayout`）是桌面端唯一主导航，按 Monitor（Overview / Activity）与 Configure（Providers / Key Pools）分组；激活态为整块 `bg-primary/10 border-primary/25`（禁止左侧竖线装饰，P-38）。
- **10.** 顶栏只承载当前页上下文（label / title / description）与全局操作；桌面无中央导航、无重复 logo。
- **11.** 移动端（<lg）侧栏收进 `Sheet` 抽屉，路由变化自动关闭。
- **12.** Index and unmatched routes both redirect to `/overview` via `<Navigate replace to="/overview" />`.

### Authentication Middleware (Server)

- **13.** `src/server/app.ts` mounts auth router at `/api/admin` without middleware (public); admin router at `/api/admin` with `requireAdmin`.
- **14.** `requireAdmin` validates the `bitsearch_admin_session` cookie（HMAC-SHA256 签名，`parseCookies` + `timingSafeEqual`），校验签名与 12h TTL。
- **15.** 会话 cookie：`httpOnly`、`sameSite=strict`，值形如 `<sessionId>.<signature>`；无服务器端会话表，过期项由 `cleanupExpired()` 惰性清理。不是 express-session。

### State Management Pattern

- **16.** User action -> async handler in component -> `apiRequest()` to backend -> `refreshAll()` or local re-fetch -> state setter -> React re-render.
- **17.** No external state library. Props drilling from `App` to all children; toast 经 `enqueueToast`（toast-store）直发。
- **18.** `KeysWorkspace` 经 `onToast` 回调与 `refreshNonce` prop（由 `refreshAll` 递增，触发 workspace 级重取）连接 `App`.
- **19.** `App.tsx` implements a 30-second dashboard auto-refresh (`AUTO_REFRESH_INTERVAL_MS = 30_000`) using `useEffectEvent`; the interval is registered only while the user is on the `/overview` route and authenticated, and is cleared on route change or logout.

## 4. Design Rationale

- **Workspace-based routing over single-page scroll:** The console uses React Router 7 to split the four major functional areas into independent route-level page components. Each workspace mounts only when its route is active, keeping per-workspace state isolated and simplifying per-route logic (e.g., the 30-second auto-refresh fires only on `/overview`).
- **No external state management:** The admin console is a single-user operations tool with modest complexity. Local hooks + props drilling avoids dependency overhead.
- **方向 A · 暖光工作台（2026-08 重设计）:** 视觉规范见 `llmdoc/architecture/admin-design-system.md`。暖橙赤陶 oklch token + Inter / JetBrains Mono 字体（借鉴 AxonHub），延续登录页的径向暖光与点阵纹理；侧栏唯一导航、卡片体系统一到 `--radius` 派生刻度、主面板用 `--shadow-glow` 双层染色阴影；eyebrow 预算每页 ≤2。
- **Shared contracts:** `src/shared/contracts.ts` serves as the single type authority imported by both frontend and backend, avoiding schema drift without code generation.
