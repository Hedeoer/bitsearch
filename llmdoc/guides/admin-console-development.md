# How to Develop the Admin Console

> 2026-08-24 随「方向 A · 暖光工作台」重设计修订：路由注册位置、CSS 体系、
> 视觉约束已按现状更新。视觉规范以 `llmdoc/architecture/admin-design-system.md` 为准。

## Adding a New Panel/Section

1. **Create the component** in `src/web/components/` (或子目录 `components/activity/` 等)。Export a single functional component accepting props for data and callbacks. Follow the existing pattern: `(props: { data: SomeType; onAction: () => void })`.

2. **Add shared types** if needed in `src/shared/contracts.ts`. This is the single source of truth for types shared between frontend and backend. Frontend-only types go in `src/web/types.ts`.

3. **Create a workspace page** in `src/web/pages/` (e.g., `src/web/pages/MyWorkspace.tsx`). Export a single functional component. Register it as a route in `src/web/AppShell.tsx` 的路由表（不是 App.tsx）——在挂载 `ConsoleLayout` 的父 `<Route>` 内：

   ```tsx
   <Route path="/mypage" element={<MyWorkspace />} />
   ```

4. **Add sidebar navigation link** in `src/web/components/ConsoleChrome.tsx` 的 `NAV_ITEMS`（含 `group: "Monitor" | "Configure"` 分组与 `label/title/description` 三层文案）。导航渲染统一走 `NavList`（`<NavLink>`），不要手写 `<a href="#anchor">`。新增分组会改动 `NAV_GROUPS`。

5. **Wire up state** in `App.tsx`. Add `useState` hooks for the panel's data. If the data comes from the server, add the fetch call to the `refreshAll()` function's `Promise.all` array（现为 6 个请求：dashboard/providers/system/tool-surface/admin-access/mcp-access，位于 `src/web/App.tsx:81-103` 一带）。

6. **Add styles.** 一律用 Tailwind 语义工具类（`bg-card`/`text-muted-foreground`/`border-border`）与 shadcn 组件。自定义 CSS（动效/氛围类）只能写进 `src/web/app.css`，且保持 `app.css` 对 `admin-theme.css` 的同单元 import——**禁止**新建独立 feature CSS 文件或在 `main.tsx` 引入第三个入口。容器统一 `Card`（`rounded-xl`），主面板可加 `shadow-glow`。

## Component Patterns

- **Functional components only.** No class components. TypeScript props via type aliases.
- **Controlled inputs.** All form fields use `value` + `onChange` with local state.
- **Callback props for mutations.** Child components emit events upward (e.g., `onSave`). Parent handles API calls and state refresh.
- **Toast feedback.** Import `enqueueToast` from `src/web/toast-store.ts` and call `enqueueToast(type, message)`. Do not use `setMessage` / `onMessage` prop patterns.
- **Data refresh after mutation.** After any write operation, call `refreshAll()` or a local refresh function to re-fetch current state. No optimistic updates.

## CSS Architecture（Tailwind v4）

- **`src/web/app.css`（唯一编译入口）:** `@import "tailwindcss"` + `@import "tw-animate-css"` + `@import "./admin-theme.css"`。三者必须同一次编译——分开导入会导致 primary/card/muted 等语义工具类不被生成（c2ec1d3 教训）。全局动效/氛围类（`.console-atmosphere`、`.live-dot`、`.login-*`）都在这里。
- **`src/web/admin-theme.css`（token 层）:** tweakcn 生成的 oklch token（`@theme inline` 映射），`--success/--warning` 为手工维护（tweakcn 导出外），`--shadow-glow` 为方向 A 主面板染色阴影。**不手改 oklch 色值**；改主题从 https://tweakcn.com/r/themes/cmdght103000n04lh3e2ae93r 再生成，并保全成功/警告与字体定义（字体权威定义必须留在 `:root`，不得进 `@theme inline`）。
- **约束：** 组件不写裸色值/任意圆角（`rounded-[Npx]`）；`backdrop-blur` 仅浮层语义；eyebrow 小型大写标签每页 ≤2；数字一律 `font-mono tabular-nums`；Badge 五变体枚举不可覆盖。

## Connecting a New Panel to Backend API

1. **Define the server endpoint** in `src/server/http/admin-routes.ts` inside `createAdminRouter`. It is automatically protected by `requireAdmin` middleware.

2. **Add repository/service functions** in `src/server/repos/` or `src/server/services/` for data access and business logic. Route handlers should delegate to these.

3. **Call from the frontend** using `apiRequest<ResponseType>(method, path, body?)` from `src/web/api.ts`. Path is relative to `/api` (e.g., `"/admin/your-endpoint"`). Returns `{ ok: true, data: T }` on success or `{ ok: false, status: number, message: string }` on failure. Always check `result.ok` before using `result.data`.

4. **Verify** by running `npm run dev`（后端 127.0.0.1:8098 + Vite 5176；端口被占会静默 +1，以终端输出为准）。真实浏览器验证用 `agent-browser-cli`（登录页填 `data/runtime-secrets.json` 的 `adminAuthKey`）；数据充实可用 `npm run seed:admin-demo`。
