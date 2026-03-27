# Repository Guidelines

## Project Structure & Module Organization
`bitsearch` is a single-package TypeScript app with a split frontend/backend layout. Put server code in `src/server/` (`http/`, `mcp/`, `providers/`, `repos/`, `db/`), shared contracts in `src/shared/`, and the React admin UI in `src/web/` plus `src/web/components/`. Build output goes to `dist/` (`dist/public` for Vite assets, `dist/server` for Node entrypoints). Runtime SQLite files live in `data/`; treat them as local state, not source files.

## Build, Test, and Development Commands
Install dependencies with `npm install`.

- `npm run dev`: starts the Express server with `tsx watch` and the Vite dev server together.
- `npm run dev:server`: runs only the backend from `src/server/main.ts`.
- `npm run dev:web`: runs only the frontend on port `5173`.
- `npm run build`: builds both the web bundle and server output into `dist/`.
- `npm run check`: runs TypeScript type-checking with no emit; use this before every PR.
- `npm start`: serves the compiled app from `dist/server/main.js`.

## Coding Style & Naming Conventions
Use strict TypeScript and ESM imports. Follow the existing style: 2-space indentation, double quotes, trailing commas where the formatter leaves them, and small focused modules. Use `PascalCase` for React component files such as `SecurityPanel.tsx`; use `kebab-case` for backend modules such as `admin-routes.ts` and `planning-engine.ts`. Prefer named exports for reusable utilities and keep shared API shapes in `src/shared/contracts.ts`.

## Testing Guidelines
No dedicated test runner is checked in yet; there is no `vitest` or `jest` config in the repo today. Minimum validation for every change is `npm run check` plus a manual smoke test of the touched flow in `npm run dev`. When adding tests, place `*.test.ts` or `*.test.tsx` next to the feature they cover.

## Commit & Pull Request Guidelines
Recent history uses Conventional Commit style with scopes, for example `feat(activity): add detail tabs and web_search messages` and `chore: bootstrap bitsearch admin service`. Keep commits in the form `<type>(<scope>): <summary>` when a scope adds clarity. PRs should describe user-visible changes, list verification steps, reference related issues, and include screenshots for UI work.

## Security & Configuration Tips
Configuration is read from environment variables in `src/server/bootstrap.ts`. Set real values for `SESSION_SECRET`, `APP_ENCRYPTION_KEY`, `ADMIN_PASSWORD`, and `MCP_BEARER_TOKEN` outside local development, and never commit secrets or populated `data/*.db` files.
