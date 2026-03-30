import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import type { AppDatabase } from "../src/server/db/database.js";
import { SCHEMA_SQL } from "../src/server/db/schema.js";
import {
  getActivityDetail,
  getActivitySummary,
  listActivityFacets,
  listActivityItems,
} from "../src/server/repos/activity-repo.js";
import {
  insertAttemptLogs,
  insertRequestLog,
} from "../src/server/repos/log-repo.js";

function createDb(): AppDatabase {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(SCHEMA_SQL);
  sqlite.exec(
    `INSERT INTO request_logs_fts(
       request_id,
       tool_name,
       target_url,
       final_provider,
       error_summary,
       result_preview
     )
     SELECT
       id,
       COALESCE(tool_name, ''),
       COALESCE(target_url, ''),
       COALESCE(final_provider, ''),
       COALESCE(error_summary, ''),
       COALESCE(result_preview, '')
     FROM request_logs`,
  );
  return {
    sqlite,
    now: () => "2026-03-30T12:00:00.000Z",
  };
}

function seed(db: AppDatabase): void {
  insertRequestLog(db, {
    id: "req-success-fetch",
    toolName: "web_fetch",
    targetUrl: "https://example.com/intro",
    strategy: "ordered_failover",
    finalProvider: "firecrawl",
    finalKeyFingerprint: "fire-1",
    attempts: 1,
    status: "success",
    durationMs: 1200,
    errorSummary: null,
    inputJson: { url: "https://example.com/intro" },
    resultPreview: "Fetched intro page",
    messages: null,
    providerOrder: ["tavily", "firecrawl"],
    metadata: {},
  });
  insertAttemptLogs(db, [{
    requestLogId: "req-success-fetch",
    provider: "firecrawl",
    keyFingerprint: "fire-1",
    attemptNo: 1,
    status: "success",
    statusCode: 200,
    durationMs: 1200,
    errorSummary: null,
    errorType: null,
    providerBaseUrl: "https://api.firecrawl.dev/v2",
  }]);

  insertRequestLog(db, {
    id: "req-failed-map",
    toolName: "web_map",
    targetUrl: "https://example.com",
    strategy: "ordered_failover",
    finalProvider: null,
    finalKeyFingerprint: null,
    attempts: 2,
    status: "failed",
    durationMs: 5200,
    errorSummary: "rate limited after fallback",
    inputJson: { url: "https://example.com" },
    resultPreview: null,
    messages: null,
    providerOrder: ["tavily", "firecrawl"],
    metadata: {},
  });
  insertAttemptLogs(db, [
    {
      requestLogId: "req-failed-map",
      provider: "tavily",
      keyFingerprint: "tav-1",
      attemptNo: 1,
      status: "failed",
      statusCode: 429,
      durationMs: 2600,
      errorSummary: "quota reached",
      errorType: "rate_limit",
      providerBaseUrl: "https://api.tavily.com",
    },
    {
      requestLogId: "req-failed-map",
      provider: "firecrawl",
      keyFingerprint: "fire-2",
      attemptNo: 2,
      status: "failed",
      statusCode: 408,
      durationMs: 2600,
      errorSummary: "upstream timed out",
      errorType: "timeout",
      providerBaseUrl: "https://api.firecrawl.dev/v2",
    },
  ]);

  insertRequestLog(db, {
    id: "req-failed-search",
    toolName: "web_search",
    targetUrl: null,
    strategy: null,
    finalProvider: "search_engine",
    finalKeyFingerprint: null,
    attempts: 1,
    status: "failed",
    durationMs: 4,
    errorSummary: "search engine configuration missing",
    inputJson: { query: "mcp" },
    resultPreview: null,
    messages: [{ role: "user", content: "mcp latest docs" }],
    providerOrder: ["search_engine"],
    metadata: {},
  });

  insertRequestLog(db, {
    id: "req-status-success",
    toolName: "firecrawl_batch_scrape_status",
    targetUrl: null,
    strategy: null,
    finalProvider: "firecrawl",
    finalKeyFingerprint: "fire-3",
    attempts: 1,
    status: "success",
    durationMs: 900,
    errorSummary: null,
    inputJson: { id: "job-1" },
    resultPreview: "{\"status\":\"completed\"}",
    messages: null,
    providerOrder: ["firecrawl"],
    metadata: {},
  });
  insertAttemptLogs(db, [{
    requestLogId: "req-status-success",
    provider: "firecrawl",
    keyFingerprint: "fire-3",
    attemptNo: 1,
    status: "success",
    statusCode: 200,
    durationMs: 900,
    errorSummary: null,
    errorType: null,
    providerBaseUrl: "https://api.firecrawl.dev/v2",
  }]);
}

test("listActivityItems supports FTS and provider filters", () => {
  const db = createDb();
  seed(db);

  const qResult = listActivityItems(db, {
    page: 0,
    pageSize: 10,
    q: "configuration",
    sortBy: "created_at",
    sortDir: "desc",
  });
  assert.equal(qResult.total, 1);
  assert.equal(qResult.items[0]?.id, "req-failed-search");

  const providerResult = listActivityItems(db, {
    page: 0,
    pageSize: 10,
    provider: "tavily",
    sortBy: "created_at",
    sortDir: "desc",
  });
  assert.equal(providerResult.total, 1);
  assert.equal(providerResult.items[0]?.id, "req-failed-map");
  assert.equal(providerResult.items[0]?.isFallback, true);
  assert.equal(providerResult.items[0]?.isSlow, true);
});

test("getActivitySummary aggregates the filtered slice", () => {
  const db = createDb();
  seed(db);

  const summary = getActivitySummary(db, {
    page: 0,
    pageSize: 10,
    status: "failed",
    sortBy: "created_at",
    sortDir: "desc",
  });

  assert.equal(summary.totalRequests, 2);
  assert.equal(summary.failedRequests, 2);
  assert.equal(summary.slowRequests, 1);
  assert.equal(summary.avgAttempts, 1.5);
  assert.equal(summary.topTools[0]?.count, 1);
});

test("listActivityFacets returns options and counts", () => {
  const db = createDb();
  seed(db);

  const facets = listActivityFacets(db);
  assert.equal(facets.tools.length, 4);
  assert.equal(facets.providers.some((item) => item.value === "search_engine"), true);
  assert.equal(facets.errorTypes.some((item) => item.value === "rate_limit"), true);
  assert.equal(facets.statuses.failed, 2);
});

test("getActivityDetail returns diagnostics for retries and slow requests", () => {
  const db = createDb();
  seed(db);

  const detail = getActivityDetail(db, "req-failed-map");
  assert.ok(detail);
  assert.equal(detail?.diagnostics.isSlow, true);
  assert.equal(detail?.diagnostics.isFallback, true);
  assert.match(detail?.diagnostics.retryChainLabel ?? "", /tavily\(fail\) -> firecrawl\(fail\)/);
  assert.equal(detail?.diagnostics.primaryErrorType, "timeout");
});
