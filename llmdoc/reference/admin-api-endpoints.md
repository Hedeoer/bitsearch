# Admin API Endpoints Reference

This document provides a summary and pointers to the admin REST API. All endpoints are prefixed with `/api/admin`.

## 1. Core Summary

The admin API consists of 26 endpoints split across two routers: a public auth router (3 endpoints) and a session-protected admin router (23 endpoints). All protected endpoints require a valid session cookie set by the login flow. Request/response types are defined in `src/shared/contracts.ts`.

## 2. Source of Truth

- **Auth Router:** `src/server/http/auth-routes.ts` (createAuthRouter) - Session, login, logout handlers.
- **Admin Router:** `src/server/http/admin-routes.ts` (createAdminRouter) - All protected admin endpoints.
- **Middleware:** `src/server/http/middleware.ts` (requireAdmin) - Session validation guard.
- **Shared Types:** `src/shared/contracts.ts` - All request/response TypeScript interfaces.
- **App Mount:** `src/server/app.ts:50-51` - Router mounting with middleware.

## 3. Endpoint Inventory

### Authentication (public, no session required)

| Method | Path | Request Body | Response Type | Description |
|--------|------|-------------|---------------|-------------|
| GET | `/session` | -- | `AdminSessionPayload` | Check current session status |
| POST | `/login` | `{username, password}` | `AdminSessionPayload` | Authenticate, set session cookie |
| POST | `/logout` | -- | `AdminSessionPayload` | Destroy session |

### Dashboard & Profile (session required)

| Method | Path | Request Body | Response Type | Description |
|--------|------|-------------|---------------|-------------|
| GET | `/dashboard` | -- | `DashboardSummary` | Request count metrics, error stats |
| GET | `/profile` | -- | `AdminProfile` | Admin username, creation/update dates |
| PUT | `/profile/password` | `{currentPassword, nextPassword}` | `{ok: true}` | Change admin password (min 8 chars) |

### System Settings (session required)

| Method | Path | Request Body | Response Type | Description |
|--------|------|-------------|---------------|-------------|
| GET | `/system` | -- | `SystemSettings` | Fetch mode, priority, model, retention, origins |
| PUT | `/system` | `SystemSettings` | `SystemSettings` | Update system configuration |

### Providers (session required)

| Method | Path | Request Body | Response Type | Description |
|--------|------|-------------|---------------|-------------|
| GET | `/providers` | -- | `ProviderConfigRecord[]` | List all provider configs |
| PUT | `/providers/:provider` | `{enabled, baseUrl, timeoutMs, apiKey?}` | `ProviderConfigRecord[]` | Update provider config |

### Key Pool Management (session required)

| Method | Path | Params / Body | Response Type | Description |
|--------|------|--------------|---------------|-------------|
| GET | `/keys` | `?provider&status&query&tag` | `ProviderKeyRecord[]` | List keys with filters |
| GET | `/keys/summary` | `?provider` | `KeyPoolSummary` | Aggregated pool stats |
| POST | `/keys/import-text` | `{provider, rawKeys, tags}` | import result | Import keys from newline text |
| POST | `/keys/import-csv` | `{provider, csv, tags}` | import result | Import keys from CSV |
| PATCH | `/keys/meta` | `{id, note}` | `{ok: true}` | Update key note |
| PATCH | `/keys/bulk` | `{ids[], enabled}` | `{changed: number}` | Bulk enable/disable |
| POST | `/keys/test` | `{provider, ids[]}` | test results | Test key validity |
| POST | `/keys/quota-sync` | `{provider, ids[]}` | sync results | Sync quota from provider |
| POST | `/keys/reveal` | `{id}` | `{secret}` | Decrypt and reveal key value |
| DELETE | `/keys` | `{ids[]}` | `{changed: number}` | Delete keys by IDs |
| GET | `/keys/export.csv` | `?provider` | `text/csv` | Export key metadata as CSV |

### Activity & Logs (session required)

| Method | Path | Params | Response Type | Description |
|--------|------|--------|---------------|-------------|
| GET | `/logs` | `?limit` (max 500) | `RequestLogRecord[]` | Request logs |
| GET | `/activity` | `?limit` (max 500) | `RequestActivityRecord[]` | Requests with attempts |
| GET | `/activity/:requestId` | -- | `RequestActivityRecord` | Single request detail |
| GET | `/logs/attempts` | `?limit` (max 1000) | `RequestAttemptRecord[]` | Raw attempt records |

## 4. Error Response Conventions

All errors return JSON with an `error` field:
- `401`: `{error: "unauthorized"}` or `{error: "invalid_credentials"}`
- `403`: `{error: "origin_not_allowed"}`
- `404`: `{error: "admin_profile_not_found"}`, `{error: "key_not_found"}`, `{error: "activity_not_found"}`
- `400`: `{ok: false, error: "current_password_incorrect"}`, `{error: "password_too_short"}`, `{error: "invalid_key_pool_provider"}`
- `500`: `{error: "<message>"}` (global error handler)
