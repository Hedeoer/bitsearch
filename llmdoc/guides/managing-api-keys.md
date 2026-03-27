# How to Manage API Keys

Guide for importing, monitoring, and managing API keys in the key pool system.

## Import Keys

1. **Single or bulk import:** Call `importKeys()` in `src/server/repos/provider-repo.ts:181-220` with a provider name (`"tavily"` or `"firecrawl"`), an array of raw key strings, optional tags array, and the system encryption key.
2. **Deduplication is automatic:** Each key is fingerprinted via SHA-256 (12 hex chars). The `UNIQUE(provider, fingerprint)` constraint silently skips duplicates (`INSERT OR IGNORE`).
3. **Return value:** `{ inserted: number, skipped: number }` -- tells you how many were new vs. already existed.
4. **Keys start enabled:** All imported keys default to `enabled=1` and `last_check_status='unknown'`.

## Sync Quota Information

1. **Quick test (health check only):** Call `testKeys(context, provider, ids)` in `src/server/services/key-pool-service.ts:196-204`. This calls provider quota endpoints and updates health status without fetching historical data.
2. **Full quota sync:** Call `syncKeyQuotas(context, provider, ids)` in `src/server/services/key-pool-service.ts:206-214`. For Firecrawl, this additionally fetches historical credit usage per API key.
3. **What gets updated:** Each key's `last_check_status` (healthy/unhealthy), `last_check_error`, `quota_json`, and `quota_synced_at` columns are updated.
4. **Provider-specific data:**
   - **Tavily:** Key-level usage/limit across 5 operation types + account-level plan usage.
   - **Firecrawl:** Team credit remaining/plan totals + billing period + optional per-key historical credits.

## Monitor Key Health

1. **View key inventory:** `listManagedKeys()` in `src/server/repos/key-pool-repo.ts:180-191` returns all keys with request/failure statistics (computed via JOIN to `request_attempt_logs`). Secrets are masked (first 4 + last 4 chars).
2. **Filter by status:** Pass `status` filter as `"enabled"`, `"disabled"`, `"healthy"`, or `"unhealthy"` to narrow results.
3. **Pool summary:** `getKeyPoolSummary()` in `src/server/repos/key-pool-repo.ts:205-212` aggregates total/enabled/healthy counts, request/failure totals, and provider-specific quota summaries.
4. **Runtime health signals:** During normal operation, `markKeyUsage()` in `src/server/repos/provider-repo.ts:262-275` records `last_used_at`, `last_status_code`, and `last_error` after every request attempt.

## Disable or Remove Keys

1. **Disable keys:** Call `setKeysEnabled(db, ids, false)` in `src/server/repos/provider-repo.ts:222-232`. Disabled keys are excluded from `getCandidateKeys()` LRU selection.
2. **Re-enable keys:** Call `setKeysEnabled(db, ids, true)` to restore keys to the active pool.
3. **Delete keys:** Call `deleteKeys(db, ids)` in `src/server/repos/provider-repo.ts:234-241`. This permanently removes keys from the database.
4. **Update notes:** Call `updateKeyNote(db, id, note)` in `src/server/repos/key-pool-repo.ts:214-218` to annotate a key with operational context.
