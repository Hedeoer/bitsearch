# How to Develop the Admin Console

A guide for adding features, panels, and API connections to the Aether Console.

## Adding a New Panel/Section

1. **Create the component** in `src/web/components/`. Export a single functional component accepting props for data and callbacks. Follow the existing pattern: `(props: { data: SomeType; onAction: () => void })`.

2. **Add shared types** if needed in `src/shared/contracts.ts`. This is the single source of truth for types shared between frontend and backend. Frontend-only types go in `src/web/types.ts`.

3. **Create a workspace page** in `src/web/pages/` (e.g., `src/web/pages/MyWorkspace.tsx`). Export a single functional component. Register it as a route in `App.tsx` inside the `<Routes>` block:

   ```tsx
   <Route path="/mypage" element={<MyWorkspace />} />
   ```

4. **Add sidebar navigation link** in `src/web/components/ConsoleChrome.tsx` (`ConsoleSidebar`). Use `<NavLink to="/mypage">` (from `react-router-dom`), **not** `<a href="#anchor">`.

5. **Wire up state** in `App.tsx`. Add `useState` hooks for the panel's data. If the data comes from the server, add the fetch call to the `refreshAll()` function's `Promise.all` array at `src/web/App.tsx:76-83`.

6. **Add styles.** Place layout rules in `src/web/styles.css`. For complex feature-specific styles, create a new CSS file (e.g., `src/web/mypanel.css`) and import it in `src/web/main.tsx`. Always use CSS custom properties from `src/web/theme.css`.

## Component Patterns

- **Functional components only.** No class components. TypeScript props via type aliases.
- **Controlled inputs.** All form fields use `value` + `onChange` with local state.
- **Callback props for mutations.** Child components emit events upward (e.g., `onSave`, `onMessage`). Parent handles API calls and state refresh.
- **Toast feedback.** Import `enqueueToast` from `src/web/toast-store.ts` and call `enqueueToast(type, message)` where `type` is `'success' | 'error' | 'info'`. Do not use `setMessage` / `onMessage` prop patterns.
- **Data refresh after mutation.** After any write operation, call `refreshAll()` or a local refresh function to re-fetch current state. No optimistic updates.

## CSS Architecture

- **Layer 1 -- `theme.css` (Design Tokens):** CSS custom properties (`--bg`, `--primary`, `--text`, etc.), base resets, button/chip/pill component classes. Never add layout rules here.
- **Layer 2 -- `styles.css` (Layout):** Imports `theme.css`. Grid definitions (`.console-shell`, `.overview-grid`), component surfaces (`.surface-card`, `.hero-panel`), data display (`.data-table`, `.metric-grid`). Responsive breakpoint at 1100px.
- **Layer 3 -- Feature CSS (e.g., `key-pools.css`):** Domain-specific styles for complex subsystems. Import in `main.tsx`.
- **Naming:** BEM-like semantic classes (`.console-shell`, `.key-card-selected`, `.activity-item-meta`).
- **Theme values:** Always reference `var(--token)` instead of hardcoded colors. See `src/web/theme.css` for the full token list.

## Connecting a New Panel to Backend API

1. **Define the server endpoint** in `src/server/http/admin-routes.ts` inside `createAdminRouter`. It is automatically protected by `requireAdmin` middleware.

2. **Add repository/service functions** in `src/server/repos/` or `src/server/services/` for data access and business logic. Route handlers should delegate to these.

3. **Call from the frontend** using `apiRequest<ResponseType>(method, path, body?)` from `src/web/api.ts`. The full signature is:

   ```ts
   apiRequest<T>(method: string, path: string, body?: unknown): Promise<ApiResult<T>>
   ```

   Path is relative to `/api` (e.g., `"/admin/your-endpoint"`). Returns `{ ok: true, data: T }` on success or `{ ok: false, status: number, message: string }` on failure. Always check `result.ok` before using `result.data`.

4. **Verify** by running `npm run dev` (starts both Vite dev server and Express backend). Check the browser console for fetch errors and the terminal for server-side exceptions.
