import type {
  ActivityDetailRecord,
  ActivityFacetOption,
  ActivityFacets,
  ActivityListItem,
  ActivityListPageResult,
  ActivityMetricCount,
  ActivityQuery,
  ActivitySummary,
  RemoteProvider,
} from "../../shared/contracts.js";
import type { AppDatabase } from "../db/database.js";
import { parseJsonArray, parseMessages } from "./log-record-mappers.js";
import { getRequestActivity } from "./log-repo.js";
import {
  SLOW_REQUEST_THRESHOLD_MS,
  toActivityDetailRecord,
} from "../services/activity-diagnostics.js";

type SqlParts = { where: string; params: unknown[] };
type SqlParam = string | number | bigint | Uint8Array | null;

function asSqlParams(params: unknown[]): SqlParam[] {
  return params as SqlParam[];
}

function toFtsQuery(value: string): string {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => `"${token.replace(/"/g, "\"\"")}"*`)
    .join(" AND ");
}

function buildActivityWhere(query: ActivityQuery): SqlParts {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (query.q) {
    conditions.push("rl.id IN (SELECT request_id FROM request_logs_fts WHERE request_logs_fts MATCH ?)");
    params.push(toFtsQuery(query.q));
  }
  if (query.toolName) {
    conditions.push("rl.tool_name = ?");
    params.push(query.toolName);
  }
  if (query.status) {
    conditions.push("rl.status = ?");
    params.push(query.status);
  }
  if (query.provider) {
    conditions.push(
      `rl.id IN (
         SELECT id FROM request_logs WHERE final_provider = ?
         UNION
         SELECT request_log_id FROM request_attempt_logs WHERE provider = ?
       )`,
    );
    params.push(query.provider, query.provider);
  }
  if (query.errorType) {
    conditions.push(
      "rl.id IN (SELECT request_log_id FROM request_attempt_logs WHERE error_type = ?)",
    );
    params.push(query.errorType);
  }
  if (query.timePreset === "today") {
    conditions.push("date(rl.created_at) = date('now', 'localtime')");
  } else if (query.timePreset === "last_hour") {
    conditions.push("rl.created_at >= datetime('now', '-1 hour')");
  } else if (query.timePreset === "last_24_hours") {
    conditions.push("rl.created_at >= datetime('now', '-24 hours')");
  } else if (query.timePreset === "custom") {
    if (query.customStart) {
      conditions.push("rl.created_at >= ?");
      params.push(query.customStart);
    }
    if (query.customEnd) {
      conditions.push("rl.created_at <= ?");
      params.push(query.customEnd);
    }
  }
  if (typeof query.minDurationMs === "number") {
    conditions.push("rl.duration_ms >= ?");
    params.push(query.minDurationMs);
  }
  if (typeof query.maxDurationMs === "number") {
    conditions.push("rl.duration_ms <= ?");
    params.push(query.maxDurationMs);
  }
  if (query.onlySlow) {
    conditions.push("rl.duration_ms >= ?");
    params.push(SLOW_REQUEST_THRESHOLD_MS);
  }
  if (query.onlyFallback) {
    conditions.push("rl.attempts > 1");
  }

  return {
    where: conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "",
    params,
  };
}

function getSortColumn(sortBy: ActivityQuery["sortBy"]): string {
  if (sortBy === "duration_ms") return "rl.duration_ms";
  if (sortBy === "attempts") return "rl.attempts";
  return "rl.created_at";
}

function toActivityListItem(row: Record<string, unknown>): ActivityListItem {
  const messages = parseMessages(row.messages_json);
  return {
    id: String(row.id),
    toolName: String(row.tool_name),
    targetUrl: row.target_url ? String(row.target_url) : null,
    finalProvider: row.final_provider ? (String(row.final_provider) as RemoteProvider) : null,
    attempts: Number(row.attempts),
    status: row.status as ActivityListItem["status"],
    durationMs: Number(row.duration_ms),
    errorSummary: row.error_summary ? String(row.error_summary) : null,
    resultPreview: row.result_preview ? String(row.result_preview) : null,
    primaryErrorType: row.primary_error_type ? String(row.primary_error_type) : null,
    providerOrder: parseJsonArray(row.provider_order_json),
    hasMessages: Boolean(messages && messages.length > 0),
    isSlow: Number(row.duration_ms) >= SLOW_REQUEST_THRESHOLD_MS,
    isFallback: Number(row.attempts) > 1,
    createdAt: String(row.created_at),
  };
}

function countQuery(db: AppDatabase, sql: string, params: unknown[]): number {
  const row = db.sqlite.prepare(sql).get(...asSqlParams(params)) as { count: number };
  return Number(row.count ?? 0);
}

function listMetricCounts(db: AppDatabase, sql: string, params: unknown[]): ActivityMetricCount[] {
  return (db.sqlite.prepare(sql).all(...asSqlParams(params)) as Array<{ value: string; count: number }>).map((row) => ({
    value: row.value,
    count: Number(row.count),
  }));
}

function percentileDuration(
  db: AppDatabase,
  where: string,
  params: unknown[],
  total: number,
  quantile: number,
): number | null {
  if (total === 0) {
    return null;
  }
  const offset = Math.max(Math.ceil(total * quantile) - 1, 0);
  const row = db.sqlite
    .prepare(`SELECT rl.duration_ms FROM request_logs rl ${where} ORDER BY rl.duration_ms ASC LIMIT 1 OFFSET ?`)
    .get(...asSqlParams([...params, offset])) as { duration_ms: number } | undefined;
  return typeof row?.duration_ms === "number" ? row.duration_ms : null;
}

export function listActivityItems(db: AppDatabase, query: ActivityQuery): ActivityListPageResult {
  const { where, params } = buildActivityWhere(query);
  const total = countQuery(db, `SELECT COUNT(*) AS count FROM request_logs rl ${where}`, params);
  const rows = db.sqlite
    .prepare(
      `SELECT
         rl.id,
         rl.tool_name,
         rl.target_url,
         rl.final_provider,
         rl.attempts,
         rl.status,
         rl.duration_ms,
         rl.error_summary,
         rl.result_preview,
         rl.provider_order_json,
         rl.messages_json,
         rl.created_at,
         (
           SELECT al.error_type
           FROM request_attempt_logs al
           WHERE al.request_log_id = rl.id AND al.error_type IS NOT NULL
           ORDER BY al.attempt_no DESC, al.created_at DESC
           LIMIT 1
         ) AS primary_error_type
       FROM request_logs rl
       ${where}
       ORDER BY ${getSortColumn(query.sortBy)} ${query.sortDir.toUpperCase()}, rl.created_at DESC
       LIMIT ? OFFSET ?`,
    )
    .all(...asSqlParams([...params, query.pageSize, query.page * query.pageSize])) as Record<string, unknown>[];
  return {
    items: rows.map(toActivityListItem),
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
}

export function getActivitySummary(db: AppDatabase, query: ActivityQuery): ActivitySummary {
  const { where, params } = buildActivityWhere(query);
  const row = db.sqlite
    .prepare(
      `SELECT
         COUNT(*) AS total_requests,
         SUM(CASE WHEN rl.status = 'failed' THEN 1 ELSE 0 END) AS failed_requests,
         AVG(rl.attempts) AS avg_attempts,
         SUM(CASE WHEN rl.duration_ms >= ? THEN 1 ELSE 0 END) AS slow_requests
       FROM request_logs rl ${where}`,
    )
    .get(...asSqlParams([SLOW_REQUEST_THRESHOLD_MS, ...params])) as Record<string, unknown>;
  const totalRequests = Number(row.total_requests ?? 0);
  const failedRequests = Number(row.failed_requests ?? 0);
  return {
    totalRequests,
    failedRequests,
    failureRate: totalRequests > 0 ? (failedRequests / totalRequests) * 100 : 0,
    p50DurationMs: percentileDuration(db, where, params, totalRequests, 0.5),
    p95DurationMs: percentileDuration(db, where, params, totalRequests, 0.95),
    avgAttempts: Number(row.avg_attempts ?? 0),
    slowRequests: Number(row.slow_requests ?? 0),
    topTools: listMetricCounts(
      db,
      `SELECT rl.tool_name AS value, COUNT(*) AS count FROM request_logs rl ${where}
       GROUP BY rl.tool_name ORDER BY count DESC, value ASC LIMIT 5`,
      params,
    ),
    topProviders: listMetricCounts(
      db,
      `SELECT COALESCE(rl.final_provider, 'unknown') AS value, COUNT(*) AS count FROM request_logs rl ${where}
       GROUP BY value ORDER BY count DESC, value ASC LIMIT 5`,
      params,
    ),
    topFailedProviders: listMetricCounts(
      db,
      `SELECT al.provider AS value, COUNT(*) AS count
       FROM request_attempt_logs al
       WHERE al.status = 'failed'
         AND al.request_log_id IN (SELECT rl.id FROM request_logs rl ${where})
       GROUP BY al.provider ORDER BY count DESC, value ASC LIMIT 5`,
      params,
    ),
  };
}

function facetOptions(db: AppDatabase, sql: string): ActivityFacetOption[] {
  return (db.sqlite.prepare(sql).all() as Array<{ value: string; count: number }>).map((row) => ({
    value: row.value,
    count: Number(row.count),
  }));
}

export function listActivityFacets(db: AppDatabase): ActivityFacets {
  const statuses = db.sqlite
    .prepare(
      `SELECT
         SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) AS success,
         SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed
       FROM request_logs`,
    )
    .get() as { success: number; failed: number };
  const bounds = db.sqlite
    .prepare("SELECT MIN(created_at) AS oldest_created_at, MAX(created_at) AS newest_created_at FROM request_logs")
    .get() as { oldest_created_at: string | null; newest_created_at: string | null };
  return {
    tools: facetOptions(db, "SELECT tool_name AS value, COUNT(*) AS count FROM request_logs GROUP BY tool_name ORDER BY count DESC, value ASC"),
    providers: facetOptions(
      db,
      `SELECT value, COUNT(*) AS count
       FROM (
         SELECT final_provider AS value FROM request_logs WHERE final_provider IS NOT NULL
         UNION ALL
         SELECT provider AS value FROM request_attempt_logs
       )
       GROUP BY value
       ORDER BY count DESC, value ASC`,
    ),
    errorTypes: facetOptions(db, "SELECT error_type AS value, COUNT(*) AS count FROM request_attempt_logs WHERE error_type IS NOT NULL GROUP BY error_type ORDER BY count DESC, value ASC"),
    statuses: {
      success: Number(statuses.success ?? 0),
      failed: Number(statuses.failed ?? 0),
    },
    timeBounds: {
      oldestCreatedAt: bounds.oldest_created_at,
      newestCreatedAt: bounds.newest_created_at,
    },
  };
}

export function getActivityDetail(db: AppDatabase, requestId: string): ActivityDetailRecord | null {
  const activity = getRequestActivity(db, requestId);
  return activity ? toActivityDetailRecord(activity) : null;
}
