# How to Configure Search Providers

Step-by-step instructions for setting up `search_engine`, Tavily, and Firecrawl providers, configuring routing strategy, and managing API keys.

## Prerequisites

- Admin access to the bitsearch admin console.
- At least one valid API key for each provider you intend to use.
- The system encryption key must be configured at bootstrap (required for key storage).

## 1. Configure Provider Settings

Each provider has a config record in the `provider_configs` table, managed via `src/server/repos/provider-repo.ts` (`saveProviderConfig`).

For each provider (`search_engine`, `tavily`, `firecrawl`), set:
- **enabled**: Toggle the provider on/off.
- **baseUrl**: API endpoint base URL (for example, an OpenAI-compatible `/models` + `/chat/completions` provider for `search_engine`, `https://api.tavily.com` for Tavily, `https://api.firecrawl.dev/v1` for Firecrawl).
- **timeoutMs**: Request timeout in milliseconds. `search_engine` enforces a minimum of 120s for search; Firecrawl enforces a minimum of 60s for scrape.

## 2. Add API Keys

**search_engine (single-key model):**
- Set the API key directly in the provider config. Stored encrypted in `provider_configs.api_key_encrypted`.
- Retrieved at runtime via `getProviderApiKey()` in `src/server/repos/provider-repo.ts`.

**Tavily / Firecrawl (key-pool model):**
- Import keys via `importKeys()` in `src/server/repos/provider-repo.ts`. Supports batch import with automatic deduplication by SHA-256 fingerprint.
- Each key gets: name, provider tag, encrypted secret, enabled flag, and optional tags for grouping.
- Keys are stored in the `provider_keys` table and rotated using LRU strategy via `getCandidateKeys()`.

## 3. Set Routing Strategy

Configure via `system_settings` table (key: `fetch_mode`), managed by `src/server/repos/settings-repo.ts` (`saveSystemSettings`).

Three modes available (defined in `src/shared/contracts.ts` as `FETCH_MODES`):

| Mode | Behavior |
|------|----------|
| `strict_tavily` | Only use Tavily. Fails if Tavily unavailable. |
| `strict_firecrawl` | Only use Firecrawl. Fails if Firecrawl unavailable. |
| `auto_ordered` | Try providers in `providerPriority` order (default: `["tavily", "firecrawl"]`). Failover to next provider on exhaustion. |

To change provider priority order in `auto_ordered` mode, update the `provider_priority` setting (key: `provider_priority`). This is a JSON array of `KeyPoolProvider` values.

## 4. Configure Search Model

Set the default search model via `system_settings` (key: `default_search_model`). Default: `"grok-4-fast"`. Can be overridden per-request by passing a model parameter. Available models can be listed via `listSearchEngineModels()` in `src/server/providers/search-engine-client.ts`.

The admin console can probe models from `/admin/providers/search_engine/models`, which calls the configured provider's `/models` endpoint. If probing fails or returns an empty list, you can still type the model name manually.

## 5. Verify Configuration

- **Check provider status:** Call `getProviderConfig()` for each provider and confirm `enabled: true`, valid `baseUrl`, and `hasApiKey: true` (`search_engine`) or `keyCount > 0` (Tavily/Firecrawl).
- **Test key health:** Use `testKeys()` in `src/server/services/key-pool-service.ts` to validate keys against provider quota endpoints.
- **Monitor requests:** Check `request_logs` and `request_attempt_logs` tables (via `src/server/repos/log-repo.ts`) for routing decisions, attempt counts, and error details.
- **Dashboard:** `getDashboardSummary()` in `src/server/repos/log-repo.ts` provides aggregate success/failure counts and per-provider error breakdown.

## Troubleshooting

| Symptom | Likely Cause | Resolution |
|---------|-------------|------------|
| "No enabled provider or usable key" | All providers disabled or no keys imported | Enable at least one provider and import keys |
| All attempts show `rate_limit` errors | Key pool exhausted across all keys | Add more API keys or reduce request volume |
| search_engine returns "未完整配置" error | Missing baseUrl or API key for search_engine | Set both via `saveProviderConfig()` |
| Requests always use same provider | `fetchMode` set to strict mode | Switch to `auto_ordered` for failover |
| Keys not rotating evenly | Key `last_used_at` not updating | Verify `markKeyUsage()` is called (check `fetch-router.ts:125,161`) |
