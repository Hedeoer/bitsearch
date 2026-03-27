# Coding Conventions

## 1. Core Summary

bitsearch is a strict-TypeScript ESM project using a frontend/backend/shared split. Code style emphasizes 2-space indentation, double quotes, trailing commas, small focused modules, named exports, and shared type contracts. There is no test runner; validation is `npm run check` plus manual smoke testing.

## 2. Source of Truth

- **Style Rules:** `AGENTS.md` - Canonical coding style and naming conventions.
- **TypeScript (shared):** `tsconfig.json` - Base config: `strict: true`, target ES2022, module ESNext, bundler resolution.
- **TypeScript (server):** `tsconfig.server.json` - Extends base; uses NodeNext module resolution, emits to `dist/`.
- **Vite Config:** `vite.config.ts` - Defines `@shared` and `@web` path aliases, builds to `dist/public`.
- **Package Manifest:** `package.json` - `"type": "module"`, all scripts, dependency inventory.

## 3. Key Rules

### TypeScript & Module System

- **Strict mode** is always on (`strict: true` in `tsconfig.json`).
- **ESM everywhere** -- `"type": "module"` in `package.json`; server imports use `.js` extensions (`./app-context.js`).
- **Path aliases:** `@shared/*` maps to `src/shared/*`, `@web/*` maps to `src/web/*`. Used in frontend imports; server code uses relative paths with `.js` suffix.

### File Naming

- **PascalCase** for React component files: `SecurityPanel.tsx`, `ActivityHub.tsx`, `LoginView.tsx`.
- **kebab-case** for backend modules: `admin-routes.ts`, `app-context.ts`, `key-pool-repo.ts`.
- **kebab-case** for shared modules: `contracts.ts` (flat names acceptable for single-file modules).

### Module Organization

| Directory      | Purpose                                    |
| -------------- | ------------------------------------------ |
| `src/server/`  | Express app, HTTP routes, MCP, DB, services |
| `src/web/`     | React SPA, components in `components/`     |
| `src/shared/`  | Type contracts shared across server and web |
| `dist/`        | Build output (not committed)               |
| `data/`        | Runtime SQLite files (not committed)       |

### Import Patterns

- **Named exports** preferred for all reusable symbols (functions, types, constants).
- **Shared contracts:** All cross-boundary types and const arrays live in `src/shared/contracts.ts`. Import with `@shared/contracts` from web code or relative path from server code.
- **Factory functions** for Express routers: `createAdminRouter(context)`, `createAuthRouter(context)`. Each router file exports a single factory.
- **AppContext** dependency injection: routes and services receive an `AppContext` object rather than importing globals.

### Style

- **2-space indentation**, no tabs.
- **Double quotes** for strings.
- **Trailing commas** in multi-line constructs.
- **`as const` assertions** on shared constant arrays to derive union types (see `contracts.ts:1-16`).
- **Error strings** use `snake_case` identifiers: `"admin_profile_not_found"`, `"current_password_incorrect"`.

### Validation & Testing

- **No test framework** is configured (no vitest/jest).
- **Minimum validation:** `npm run check` (TypeScript `--noEmit`) before every PR.
- **Manual smoke test** of affected flows via `npm run dev`.
- **Future tests** should be colocated as `*.test.ts` / `*.test.tsx` next to the feature file.

### Commit Style

- **Conventional Commits** with optional scope: `feat(activity): ...`, `fix(keys): ...`, `chore: ...`.
