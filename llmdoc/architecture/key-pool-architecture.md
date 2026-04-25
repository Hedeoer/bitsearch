# Architecture of Key Pool Management

## 1. Identity

- **What it is:** A multi-key API credential management system for Tavily and Firecrawl providers.
- **Purpose:** Securely stores, rotates, and monitors pools of API keys to enable automatic failover and load distribution across provider keys.

## 2. Core Components

- `src/server/repos/provider-repo.ts` (`importKeys`, `getCandidateKeys`, `markKeyUsage`, `setKeysEnabled`, `deleteKeys`): Key lifecycle operations -- import with deduplication, LRU selection, usage tracking, enable/disable, and deletion.
- `src/server/services/key-pool-service.ts` (`testKeys`, `syncKeyQuotas`, `refreshTavilyKeys`, `refreshFirecrawlKeys`): Health checking and quota synchronization by calling provider APIs.
- `src/server/repos/key-pool-repo.ts` (`listManagedKeys`, `listActionableKeys`, `getKeyPoolSummary`, `saveKeyHealth`, `saveKeyQuota`, `getKeySecret`): Admin inventory views, health persistence, quota storage, and secret decryption for key reveal.
- `src/server/repos/key-pool-summary.ts` (`buildKeyPoolSummary`): Aggregates per-key quota data into pool-level summaries with provider-specific logic.
- `src/server/providers/fetch-router.ts` (`runWithKeyPool`): Runtime key selection and failover -- iterates LRU-sorted keys, retries on transient errors, logs all attempts.
- `src/server/lib/crypto.ts` (`encryptSecret`, `decryptSecret`, `fingerprintSecret`, `deriveKey`): AES-256-GCM encryption and SHA-256 fingerprinting for key security.
- `src/shared/contracts.ts` (`ProviderKeyRecord`, `KeyPoolSummary`, `ProviderKeyQuotaSnapshot`): Type definitions for key records, summaries, and quota snapshots.

## 3. Execution Flow (LLM Retrieval Map)

### 3a. Key Import Flow

- **1. Input:** Raw API key strings + provider name + tags submitted via admin API.
- **2. Fingerprint:** Each key is SHA-256 hashed and truncated to 12 hex chars in `src/server/lib/crypto.ts:10-12` (`fingerprintSecret`).
- **3. Dedup check:** `INSERT OR IGNORE` with UNIQUE(provider, fingerprint) constraint prevents duplicates in `src/server/repos/provider-repo.ts:188-219` (`importKeys`).
- **4. Encrypt:** Key encrypted via AES-256-GCM in `src/server/lib/crypto.ts:14-21` (`encryptSecret`). Encryption key derived from bootstrap `encryptionKey` via SHA-256.
- **5. Store:** Row inserted into `provider_keys` table with `enabled=1`, auto-generated nanoid, and name `{provider}-{fingerprint}`.

### 3b. Runtime Key Selection (LRU Rotation)

- **1. Provider resolution:** Generic retrieval tools receive a routing snapshot with either `single_provider` or `ordered_failover`, plus the effective provider order filtered by currently usable providers.
- **2. Candidate retrieval:** `src/server/repos/provider-repo.ts:243-260` (`getCandidateKeys`) queries enabled keys sorted by `COALESCE(last_used_at, created_at) ASC` -- least recently used first.
- **3. Attempt execution:** `src/server/providers/fetch-router.ts:113-178` iterates keys sequentially, calling the executor function with each decrypted secret.
- **4. Usage marking:** On success or failure, `src/server/repos/provider-repo.ts:262-275` (`markKeyUsage`) updates `last_used_at`, `last_status_code`, and `last_error`, pushing the key to the end of the LRU queue.
- **5. Failover:** Retryable errors (429, 408, 5xx, timeout, network) advance to next key; non-retryable errors (other 4xx) skip to next provider.

### 3c. Quota Sync and Health Check

- **1. Trigger:** Admin calls `testKeys` (quick check) or `syncKeyQuotas` (full sync with historical data) in `src/server/services/key-pool-service.ts:196-214`.
- **2. Key retrieval:** `listActionableKeys` loads decrypted keys from DB, filtered by provider and optional ID list.
- **3. Provider API call:** Tavily keys call `/usage` endpoint; Firecrawl keys call `/team/credit-usage` (and optionally `/team/credit-usage/historical`).
- **4. Health update:** `src/server/repos/key-pool-repo.ts:220-233` (`saveKeyHealth`) sets `last_check_status` to "healthy" or "unhealthy" with error message.
- **5. Quota persist:** `src/server/repos/key-pool-repo.ts:235-247` (`saveKeyQuota`) stores provider-specific quota snapshot as JSON in `quota_json` column.
- **6. Summary aggregation:** `src/server/repos/key-pool-summary.ts:101-121` (`buildKeyPoolSummary`) aggregates per-key quotas into pool-level totals.

For Firecrawl, BitSearch uses the following project rule:
- each imported key is treated as one Firecrawl team
- `used` comes from the latest historical billing-period `creditsUsed`
- `remaining` comes from `/team/credit-usage`
- derived `total` is `used + remaining`

This keeps Firecrawl aggregation simple and deterministic so long as the same Firecrawl team is not imported more than once.

### 3d. Encryption Scheme

- **Key derivation:** SHA-256 hash of `keyMaterial` string produces 256-bit AES key (`src/server/lib/crypto.ts:6-8`).
- **Encrypt:** Random 12-byte IV + AES-256-GCM cipher. Output: base64([IV(12) + AuthTag(16) + Ciphertext]).
- **Decrypt:** Reverse: base64-decode, split IV/AuthTag/Ciphertext, verify auth tag, decrypt.
- **Fingerprint:** SHA-256 of plaintext secret, truncated to first 12 hex chars. Used for deduplication and log correlation without exposing secrets.

## 4. Design Rationale

- **LRU over round-robin:** LRU naturally distributes load and recovers failed keys -- a key that errors still gets `last_used_at` updated, pushing it to the back of the queue.
- **Fingerprint deduplication:** The (provider, fingerprint) unique constraint prevents importing the same key twice without needing to decrypt existing keys for comparison.
- **Encryption at boundary:** Secrets are encrypted/decrypted only in the repository layer, never stored or transmitted in plaintext through the service layer.
- **Quota as JSON:** Storing provider-specific quota structures as JSON in `quota_json` enables schema flexibility -- Tavily and Firecrawl have entirely different quota models.
- **Firecrawl team assumption:** Firecrawl quota reporting is team-scoped. BitSearch therefore relies on the operational rule that each imported Firecrawl key maps to a different team when displaying pool totals.
