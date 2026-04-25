# How to Configure Search Providers

Step-by-step instructions for setting up `search_engine`, Tavily, and Firecrawl providers, configuring generic retrieval routing, and managing API keys.

## Prerequisites

- Admin access to the bitsearch admin console.
- At least one valid API key for each provider you intend to use.
- The system encryption key must be configured at bootstrap (required for key storage).

## 1. Configure Provider Settings

Each provider has a config record in the `provider_configs` table, managed via `src/server/repos/provider-repo.ts` (`saveProviderConfig`).

For each provider (`search_engine`, `tavily`, `firecrawl`), set:
- **enabled**: Toggle the provider on/off.
- **baseUrl**: API endpoint base URL. For `search_engine`, the expected root depends on `apiFormat`:
  - `openai_chat_completions` / `openai_responses`: OpenAI-style roots such as `https://api.openai.com/v1`
  - `anthropic_messages`: Anthropic-style roots such as `https://api.anthropic.com`
  - `google_gemini`: Gemini API roots such as `https://generativelanguage.googleapis.com/v1beta`
  - Third-party relays may also work with compatibility prefixes like `/v1`, `/anthropic`, or `/gemini`
- **timeoutMs**: Request timeout in milliseconds. `search_engine` enforces a minimum of 120s for search; Firecrawl enforces a minimum of 60s for scrape.
- **apiFormat** (`search_engine` only): One of `openai_chat_completions`, `openai_responses`, `anthropic_messages`, `google_gemini`

## 2. Add API Keys

**search_engine (single-key model):**
- Set the API key directly in the provider config. Stored encrypted in `provider_configs.api_key_encrypted`.
- Retrieved at runtime via `getProviderApiKey()` in `src/server/repos/provider-repo.ts`.

**Tavily / Firecrawl (key-pool model):**
- Import keys via `importKeys()` in `src/server/repos/provider-repo.ts`. Supports batch import with automatic deduplication by SHA-256 fingerprint.
- Each key gets: name, provider tag, encrypted secret, enabled flag, and optional tags for grouping.
- Keys are stored in the `provider_keys` table and rotated using LRU strategy via `getCandidateKeys()`.

## 3. Set Generic Retrieval Routing

Configure via `system_settings` table, managed by `src/server/repos/settings-repo.ts` (`saveSystemSettings`).

Two modes are available:

| Mode | Behavior |
|------|----------|
| `single_provider` | Use exactly one provider for `web_fetch`, `web_map`, and `web_search` extra sources. |
| `ordered_failover` | Try the primary provider first, then the fallback provider when the first one is unusable or fails with retryable errors. |

The provider order is stored in `generic_provider_order`, and the mode is stored in `generic_routing_mode`.

## 4. Configure Search Model

Set the default search model via `system_settings` (key: `default_search_model`). Default: `"grok-4-fast"`. Can be overridden per-request by passing a model parameter. Available models can be listed via `listSearchEngineModels()` in `src/server/providers/search-engine-client.ts`.

The admin console can probe models from `/admin/providers/search_engine/models`. The backend dispatches probe logic by `apiFormat`:

- OpenAI formats: `/models`
- Anthropic: Models API
- Gemini: `models.list`

If probing fails or returns an empty list, you can still type the model name manually.

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
| search_engine model probe returns 404 / Not Found | Base URL prefix does not match the selected `apiFormat` | Check whether the upstream expects `/v1`, `/anthropic`, or `/gemini`, then align `baseUrl` and `apiFormat` |
| Requests always use same provider | `genericRoutingMode` set to `single_provider` | Switch to `ordered_failover` if you want failover |
| Keys not rotating evenly | Key `last_used_at` not updating | Verify `markKeyUsage()` is called (check `fetch-router.ts:125,161`) |
