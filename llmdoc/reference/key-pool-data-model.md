# Key Pool Data Model

This document provides column-level reference for the key pool database tables and key state transitions.

## 1. Core Summary

The key pool uses two conceptual data areas: the `provider_keys` table stores key records with encrypted secrets, health status, and quota snapshots; quota data is stored inline as JSON rather than in a separate table. Usage statistics (request/failure counts) are computed at query time via JOIN to `request_attempt_logs`.

## 2. Source of Truth

- **Schema DDL:** `src/server/db/schema.ts` (`SCHEMA_SQL`) - Canonical table definitions.
- **Type Definitions:** `src/shared/contracts.ts` (`ProviderKeyRecord`, `ProviderKeyQuotaSnapshot`, `KeyPoolSummary`) - Application-level interfaces.
- **Repository Logic:** `src/server/repos/provider-repo.ts` - CRUD operations, import, and LRU selection.
- **Health/Quota Logic:** `src/server/repos/key-pool-repo.ts` - Health updates, quota persistence, filtered views.
- **Architecture:** `/llmdoc/architecture/key-pool-architecture.md` - Full execution flows.

## 3. Table: `provider_keys`

| Column | Type | Default | Description |
|---|---|---|---|
| id | TEXT PK | nanoid() | Unique key identifier |
| provider | TEXT NOT NULL | - | `"tavily"` or `"firecrawl"` |
| name | TEXT NOT NULL | `{provider}-{fingerprint}` | Display name |
| fingerprint | TEXT NOT NULL | - | SHA-256 hash truncated to 12 hex chars |
| encrypted_key | TEXT NOT NULL | - | AES-256-GCM encrypted secret (base64) |
| enabled | INTEGER NOT NULL | 1 | 1=active in pool, 0=excluded from selection |
| tags_json | TEXT NOT NULL | `'[]'` | JSON array of string tags |
| note | TEXT NOT NULL | `''` | Free-text annotation |
| last_check_status | TEXT NOT NULL | `'unknown'` | Health: `unknown`, `healthy`, `unhealthy` |
| last_checked_at | TEXT | NULL | ISO timestamp of last health check |
| last_check_error | TEXT | NULL | Error message from last failed health check |
| last_used_at | TEXT | NULL | ISO timestamp of last usage in fetch-router |
| last_error | TEXT | NULL | Error from last fetch-router attempt |
| last_status_code | INTEGER | NULL | HTTP status from last fetch-router attempt |
| quota_json | TEXT NOT NULL | `'{}'` | Provider-specific quota snapshot (JSON) |
| quota_synced_at | TEXT | NULL | ISO timestamp of last quota sync |
| created_at | TEXT NOT NULL | - | Import timestamp |
| updated_at | TEXT NOT NULL | - | Last modification timestamp |

**Constraints:** `UNIQUE(provider, fingerprint)` - Prevents duplicate key import per provider.

## 4. Computed Fields (Not Stored)

These fields are computed via SQL JOIN at query time in `src/server/repos/key-pool-repo.ts:156-178` (`loadRows`):

| Field | Source | Description |
|---|---|---|
| request_count | `COUNT(*)` from `request_attempt_logs` | Total attempts using this key's fingerprint |
| failure_count | `SUM(CASE WHEN status='failed')` | Failed attempts count |

## 5. Key Health States and Transitions

```
                 [import]
                    |
                    v
              +-----------+
              |  unknown   |  <-- initial state on import
              +-----------+
               /          \
    testKeys /              \ testKeys
   (success)/                \(failure)
            v                 v
      +---------+       +-----------+
      | healthy  | <---> | unhealthy |
      +---------+       +-----------+
           ^                  ^
           |                  |
     syncKeyQuotas      syncKeyQuotas
       (success)          (failure)
```

- `unknown` -> `healthy`: First successful `testKeys` or `syncKeyQuotas` call.
- `unknown` -> `unhealthy`: First failed health check (API call error).
- `healthy` <-> `unhealthy`: Toggled by subsequent health check results.
- Health status is independent of `enabled` flag. A disabled key retains its last health status.

## 6. Quota JSON Structure

The `quota_json` column stores a `ProviderKeyQuotaSnapshot` object. Structure varies by provider. Key sub-structures:

- **Tavily keys:** `{ tavily: { key: TavilyKeyQuotaSnapshot, account: TavilyAccountQuotaSnapshot | null } }`
- **Firecrawl keys:** `{ firecrawl: { team: FirecrawlTeamQuotaSnapshot, historical: FirecrawlHistoricalQuotaSnapshot | null } }`

### Firecrawl quota snapshot

Firecrawl snapshots store:
- `team.remainingCredits`
- `team.planCredits`
- `team.billingPeriodStart`
- `team.billingPeriodEnd`
- `historical.totalCredits`
- `historical.startDate`
- `historical.endDate`

BitSearch syncs `historical.totalCredits` from the latest billing-period record returned by `/team/credit-usage/historical`. The project treats each imported Firecrawl key as a distinct team for quota display and pool aggregation.
