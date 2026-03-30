import { readBootstrapConfig } from "../src/server/bootstrap.ts";
import { createDatabase } from "../src/server/db/database.ts";
import { encryptSecret, fingerprintSecret } from "../src/server/lib/crypto.ts";
import { getProviderConfig, saveProviderConfig } from "../src/server/repos/provider-repo.ts";
import { saveSystemSettings } from "../src/server/repos/settings-repo.ts";
import type { KeyPoolProvider, RemoteProvider, RequestStatus } from "../src/shared/contracts.ts";

const DEMO_KEYS_PER_PROVIDER = 100;
const DEMO_REQUEST_COUNT = 120;
const DEMO_KEY_ID_PREFIX = "demo-key", DEMO_REQUEST_ID_PREFIX = "demo-req";
const DEMO_ATTEMPT_ID_PREFIX = "demo-attempt";
const DEMO_TAGS = ["demo", "prod-like", "backup", "latency", "quota", "batch"];
const TOOLS = [
  "web_search",
  "web_fetch",
  "web_map",
  "tavily_crawl",
  "firecrawl_batch_scrape",
  "firecrawl_extract",
  "firecrawl_crawl",
  "get_sources",
] as const;

type SeedKey = {
  id: string;
  provider: KeyPoolProvider;
  fingerprint: string;
  createdAt: string;
  enabled: boolean;
  lastCheckError: string | null;
  lastCheckStatus: "healthy" | "unhealthy" | "unknown";
  lastError: string | null;
  lastStatusCode: number | null;
  lastUsedAt: string | null;
  note: string;
  quotaJson: string;
  quotaSyncedAt: string | null;
  secret: string;
  tagsJson: string;
  updatedAt: string;
};

type SeedAttempt = {
  createdAt: string;
  durationMs: number;
  errorSummary: string | null;
  errorType: string | null;
  keyFingerprint: string | null;
  provider: RemoteProvider;
  providerBaseUrl: string | null;
  status: RequestStatus;
  statusCode: number | null;
};

function isoAt(base: Date, offsetMs: number): string {
  return new Date(base.getTime() + offsetMs).toISOString();
}

function requestOffsetMinutes(index: number): number {
  if (index < 12) {
    return index * 5;
  }
  if (index < 96) {
    return 60 + (index - 12) * 15;
  }
  return 24 * 60 + (index - 96) * 30;
}

function keyCreatedAt(base: Date, index: number, provider: KeyPoolProvider): string {
  const providerOffset = provider === "tavily" ? 0 : 6;
  return isoAt(base, -(index * 9 + providerOffset) * 3_600_000);
}

function buildTags(provider: KeyPoolProvider, index: number): string {
  const tags = [
    "demo",
    provider,
    DEMO_TAGS[index % DEMO_TAGS.length],
    index % 4 === 0 ? "priority" : "standard",
  ];
  return JSON.stringify(tags);
}

function buildTavilyQuota(index: number): string {
  const limit = 900 + (index % 5) * 150;
  const usage = Math.min(limit, 60 + index * 7);
  return JSON.stringify({
    tavily: {
      key: {
        usage,
        limit,
        searchUsage: Math.round(usage * 0.45),
        extractUsage: Math.round(usage * 0.18),
        crawlUsage: Math.round(usage * 0.14),
        mapUsage: Math.round(usage * 0.11),
        researchUsage: Math.round(usage * 0.12),
      },
      account: null,
    },
  });
}

function buildFirecrawlQuota(index: number): string {
  if (index >= 60) {
    return "{}";
  }
  const planCredits = 120 + (index % 4) * 20;
  const remainingCredits = Math.max(5, planCredits - (25 + (index % 13) * 6));
  return JSON.stringify({
    firecrawl: {
      team: {
        remainingCredits,
        planCredits,
        billingPeriodStart: "2026-03-01T00:00:00.000Z",
        billingPeriodEnd: "2026-03-31T23:59:59.999Z",
      },
      historical: {
        historicalCredits: 30 + index,
        startDate: "2026-02-01T00:00:00.000Z",
        endDate: "2026-02-28T23:59:59.999Z",
        byApiKeyMatched: index % 3 === 0,
      },
    },
  });
}

function buildSeedKeys(base: Date, provider: KeyPoolProvider): SeedKey[] {
  return Array.from({ length: DEMO_KEYS_PER_PROVIDER }, (_, rawIndex) => {
    const index = rawIndex + 1;
    const secret = `${provider.slice(0, 2)}_demo_${String(index).padStart(3, "0")}_${"x".repeat(20)}`;
    const unhealthy = index % 10 === 0;
    const enabled = index % 9 !== 0;
    return {
      id: `${DEMO_KEY_ID_PREFIX}-${provider}-${String(index).padStart(3, "0")}`,
      provider,
      fingerprint: fingerprintSecret(secret),
      secret,
      createdAt: keyCreatedAt(base, index, provider),
      updatedAt: keyCreatedAt(base, index - 1, provider),
      enabled,
      tagsJson: buildTags(provider, index),
      note: index % 6 === 0 ? `quota-watch-${provider}-${index}` : "",
      lastCheckStatus: unhealthy ? "unhealthy" : index % 4 === 0 ? "unknown" : "healthy",
      lastCheckError: unhealthy ? "upstream credential rejected during last health check" : null,
      lastUsedAt: enabled ? isoAt(base, -(index % 48) * 3_600_000) : null,
      lastError: unhealthy ? "recent provider error burst" : null,
      lastStatusCode: unhealthy ? 429 : null,
      quotaJson: provider === "tavily" ? buildTavilyQuota(index) : buildFirecrawlQuota(index),
      quotaSyncedAt: index % 5 === 0 && provider === "firecrawl" ? null : isoAt(base, -(index % 36) * 60_000),
    };
  });
}

function chooseKey(keys: SeedKey[], index: number): SeedKey {
  const enabledKeys = keys.filter((item) => item.enabled);
  return enabledKeys[index % enabledKeys.length] ?? keys[0];
}

function createAttempts(
  base: Date,
  createdAt: string,
  index: number,
  toolName: typeof TOOLS[number],
  tavilyKeys: SeedKey[],
  firecrawlKeys: SeedKey[],
): SeedAttempt[] {
  const tavilyKey = chooseKey(tavilyKeys, index);
  const firecrawlKey = chooseKey(firecrawlKeys, index * 3);
  const firstAttemptAt = new Date(createdAt).getTime() - 15_000;
  if (toolName === "web_fetch" || toolName === "web_map") {
    if (index % 11 === 0) {
      return [
        { provider: "tavily", keyFingerprint: tavilyKey.fingerprint, status: "failed", statusCode: 429, durationMs: 820, errorType: "rate_limit", errorSummary: "tavily request throttled", providerBaseUrl: "https://api.tavily.com", createdAt: isoAt(base, firstAttemptAt - base.getTime()) },
        { provider: "firecrawl", keyFingerprint: firecrawlKey.fingerprint, status: "failed", statusCode: 500, durationMs: 1_120, errorType: "upstream_error", errorSummary: "firecrawl fallback also failed", providerBaseUrl: "https://api.firecrawl.dev/v2", createdAt: isoAt(base, firstAttemptAt + 8_000 - base.getTime()) },
      ];
    }
    if (index % 4 === 0) {
      return [
        { provider: "tavily", keyFingerprint: tavilyKey.fingerprint, status: "failed", statusCode: 429, durationMs: 760, errorType: "rate_limit", errorSummary: "primary provider rate limited", providerBaseUrl: "https://api.tavily.com", createdAt: isoAt(base, firstAttemptAt - base.getTime()) },
        { provider: "firecrawl", keyFingerprint: firecrawlKey.fingerprint, status: "success", statusCode: 200, durationMs: 1_340, errorType: null, errorSummary: null, providerBaseUrl: "https://api.firecrawl.dev/v2", createdAt: isoAt(base, firstAttemptAt + 7_000 - base.getTime()) },
      ];
    }
    return [
      { provider: "tavily", keyFingerprint: tavilyKey.fingerprint, status: "success", statusCode: 200, durationMs: 920, errorType: null, errorSummary: null, providerBaseUrl: "https://api.tavily.com", createdAt: isoAt(base, firstAttemptAt - base.getTime()) },
    ];
  }

  if (toolName === "tavily_crawl") {
    return [{ provider: "tavily", keyFingerprint: tavilyKey.fingerprint, status: index % 7 === 0 ? "failed" : "success", statusCode: index % 7 === 0 ? 502 : 200, durationMs: 1_800, errorType: index % 7 === 0 ? "crawl_failed" : null, errorSummary: index % 7 === 0 ? "crawl worker returned 502" : null, providerBaseUrl: "https://api.tavily.com", createdAt }];
  }

  if (toolName === "firecrawl_batch_scrape" || toolName === "firecrawl_extract" || toolName === "firecrawl_crawl") {
    const failed = index % 6 === 0;
    return [{ provider: "firecrawl", keyFingerprint: firecrawlKey.fingerprint, status: failed ? "failed" : "success", statusCode: failed ? 504 : 200, durationMs: 2_200 + (index % 5) * 130, errorType: failed ? "job_timeout" : null, errorSummary: failed ? "firecrawl job timed out before completion" : null, providerBaseUrl: "https://api.firecrawl.dev/v2", createdAt }];
  }

  const failed = index % 9 === 0;
  return [{ provider: "search_engine", keyFingerprint: null, status: failed ? "failed" : "success", statusCode: failed ? 401 : 200, durationMs: 620 + (index % 7) * 60, errorType: failed ? "auth_error" : null, errorSummary: failed ? "search engine upstream rejected the request" : null, providerBaseUrl: "https://api.openai.com/v1", createdAt }];
}

function buildRequestInput(toolName: typeof TOOLS[number], index: number, targetUrl: string | null) {
  if (toolName === "web_search") return { query: `demo query ${index}`, locale: "en-US", extraSources: 2 };
  if (toolName === "get_sources") return { sessionId: `session-${index}`, includeMetadata: true };
  if (toolName === "web_map") return { url: targetUrl, maxDepth: 2, maxBreadth: 8 };
  if (toolName === "web_fetch") return { url: targetUrl, timeoutMs: 8000 };
  return { url: targetUrl, batchSize: 4, model: "demo-model" };
}

function seedRequests(db: ReturnType<typeof createDatabase>, tavilyKeys: SeedKey[], firecrawlKeys: SeedKey[]) {
  const requestStmt = db.sqlite.prepare(`INSERT INTO request_logs (id, tool_name, target_url, strategy, final_provider, final_key_fingerprint, attempts, status, duration_ms, error_summary, input_json, result_preview, messages_json, provider_order_json, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const attemptStmt = db.sqlite.prepare(`INSERT INTO request_attempt_logs (id, request_log_id, provider, key_fingerprint, attempt_no, status, status_code, duration_ms, error_summary, error_type, provider_base_url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const now = new Date();

  for (let index = 0; index < DEMO_REQUEST_COUNT; index += 1) {
    const toolName = TOOLS[index % TOOLS.length];
    const createdAt = isoAt(now, -requestOffsetMinutes(index) * 60_000);
    const targetUrl = toolName === "get_sources" ? null : `https://demo-${toolName.replace(/_/g, "-")}.example.com/item-${index + 1}`;
    const attempts = createAttempts(now, createdAt, index, toolName, tavilyKeys, firecrawlKeys);
    const successAttempt = attempts.findLast((item) => item.status === "success") ?? null;
    const status = successAttempt ? "success" : "failed";
    const providerOrder = toolName === "web_fetch" || toolName === "web_map" ? ["tavily", "firecrawl"] : toolName === "tavily_crawl" ? ["tavily"] : toolName === "web_search" || toolName === "get_sources" ? ["search_engine"] : ["firecrawl"];
    const requestId = `${DEMO_REQUEST_ID_PREFIX}-${String(index + 1).padStart(3, "0")}`;
    const errorSummary = status === "failed" ? attempts.at(-1)?.errorSummary ?? "demo request failed" : null;
    const messages = toolName === "web_search" ? [{ role: "system", content: "Search the web and return concise highlights." }, { role: "user", content: `Find information for demo query ${index}.` }, { role: "assistant", content: "Collected ranked results and sources." }] : null;
    const resultPreview = status === "success" ? `${toolName} completed for ${targetUrl ?? `session-${index}`}` : null;
    const durationMs = attempts.reduce((sum, item) => sum + item.durationMs, 120);
    requestStmt.run(requestId, toolName, targetUrl, providerOrder.length > 1 ? "ordered_failover" : "direct", successAttempt?.provider ?? null, successAttempt?.keyFingerprint ?? null, attempts.length, status, durationMs, errorSummary, JSON.stringify(buildRequestInput(toolName, index, targetUrl)), resultPreview, messages ? JSON.stringify(messages) : null, JSON.stringify(providerOrder), JSON.stringify({ demoSeed: true, requestIndex: index, toolCategory: toolName.split("_")[0], panelHint: index % 2 === 0 ? "activity" : "overview" }), createdAt);
    attempts.forEach((attempt, attemptIndex) => {
      attemptStmt.run(`${DEMO_ATTEMPT_ID_PREFIX}-${String(index + 1).padStart(3, "0")}-${attemptIndex + 1}`, requestId, attempt.provider, attempt.keyFingerprint, attemptIndex + 1, attempt.status, attempt.statusCode, attempt.durationMs, attempt.errorSummary, attempt.errorType, attempt.providerBaseUrl, attempt.createdAt);
    });
  }
}

function ensureProviderConfig(
  db: ReturnType<typeof createDatabase>,
  provider: RemoteProvider,
  baseUrl: string,
  apiKey: string,
) {
  const current = getProviderConfig(db, provider);
  saveProviderConfig(db, provider, {
    enabled: true,
    baseUrl: current?.baseUrl || baseUrl,
    timeoutMs: current?.timeoutMs ?? 30000,
    apiKey: current?.hasApiKey ? undefined : apiKey,
    encryptionKey: readBootstrapConfig().encryptionKey,
  });
}

function clearDemoData(db: ReturnType<typeof createDatabase>) {
  db.sqlite.prepare("DELETE FROM provider_async_jobs WHERE request_log_id LIKE ?").run(`${DEMO_REQUEST_ID_PREFIX}-%`);
  db.sqlite.prepare("DELETE FROM request_attempt_logs WHERE request_log_id LIKE ?").run(`${DEMO_REQUEST_ID_PREFIX}-%`);
  db.sqlite.prepare("DELETE FROM request_logs WHERE id LIKE ?").run(`${DEMO_REQUEST_ID_PREFIX}-%`);
  db.sqlite.prepare("DELETE FROM provider_keys WHERE id LIKE ?").run(`${DEMO_KEY_ID_PREFIX}-%`);
}

function insertKeys(db: ReturnType<typeof createDatabase>, keys: SeedKey[], encryptionKey: string) {
  const stmt = db.sqlite.prepare(`INSERT INTO provider_keys (id, provider, name, fingerprint, encrypted_key, enabled, tags_json, note, last_check_status, last_checked_at, last_check_error, last_used_at, last_error, last_status_code, quota_json, quota_synced_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  for (const key of keys) {
    stmt.run(key.id, key.provider, `${key.provider}-${key.fingerprint}`, key.fingerprint, encryptSecret(key.secret, encryptionKey), key.enabled ? 1 : 0, key.tagsJson, key.note, key.lastCheckStatus, key.lastCheckStatus === "unknown" ? null : key.updatedAt, key.lastCheckError, key.lastUsedAt, key.lastError, key.lastStatusCode, key.quotaJson, key.quotaSyncedAt, key.createdAt, key.updatedAt);
  }
}

function main() {
  const bootstrap = readBootstrapConfig();
  const db = createDatabase(bootstrap);
  const tavilyKeys = buildSeedKeys(new Date(), "tavily"), firecrawlKeys = buildSeedKeys(new Date(), "firecrawl");

  saveSystemSettings(db, {
    genericRoutingMode: "ordered_failover",
    genericProviderOrder: ["tavily", "firecrawl"],
    defaultSearchModel: "grok-4.1-fast",
    logRetentionDays: 30,
  });

  db.sqlite.exec("BEGIN");
  try {
    ensureProviderConfig(db, "search_engine", "https://api.openai.com/v1", "sk-demo-search-engine");
    ensureProviderConfig(db, "tavily", "https://api.tavily.com", "tvly-demo-admin-seed");
    ensureProviderConfig(db, "firecrawl", "https://api.firecrawl.dev/v2", "fc-demo-admin-seed");
    clearDemoData(db);
    insertKeys(db, tavilyKeys, bootstrap.encryptionKey);
    insertKeys(db, firecrawlKeys, bootstrap.encryptionKey);
    seedRequests(db, tavilyKeys, firecrawlKeys);
    db.sqlite.exec("COMMIT");
  } catch (error) {
    db.sqlite.exec("ROLLBACK");
    throw error;
  } finally {
    db.sqlite.close();
  }

  console.log(JSON.stringify({ providerKeys: { tavily: tavilyKeys.length, firecrawl: firecrawlKeys.length }, requestLogs: DEMO_REQUEST_COUNT, requestAttempts: "derived from scenario mix (~160)", note: "Dashboard cache TTL is 10s. Refresh the admin UI after a few seconds if totals do not update immediately." }, null, 2));
}

main();
