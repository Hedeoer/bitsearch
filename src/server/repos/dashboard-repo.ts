import type {
  DashboardSummary,
  DashboardTrendPoint,
  ProviderErrorCount,
  RequestLogRecord,
} from "../../shared/contracts.js";
import type { AppDatabase } from "../db/database.js";
import {
  getCachedDashboardSummary,
  setCachedDashboardSummary,
} from "../services/dashboard-cache.js";
import { mapRequestLog } from "./log-record-mappers.js";

const MINUTES_PER_RPM_WINDOW = 10;
const HOURS_PER_TREND_WINDOW = 24;
const LATEST_ERROR_LIMIT = 24;
const MILLISECONDS_PER_MINUTE = 60_000;
const MILLISECONDS_PER_HOUR = 3_600_000;

type StatusTotalsRow = {
  success_count: number | null;
  failed_count: number | null;
};

type ProviderErrorRow = {
  provider: string;
  count: number;
};

type TrendRow = {
  bucket_hour: string;
  success_count: number | null;
  failed_count: number | null;
};

function subtractMinutes(now: Date, minutes: number): string {
  return new Date(now.getTime() - minutes * MILLISECONDS_PER_MINUTE).toISOString();
}

function startOfUtcHour(input: Date): Date {
  const value = new Date(input);
  value.setUTCMinutes(0, 0, 0);
  return value;
}

function bucketKeyToIso(bucketHour: string): string {
  return `${bucketHour}:00:00.000Z`;
}

function buildTrendSkeleton(now: Date): DashboardTrendPoint[] {
  const currentHour = startOfUtcHour(now);
  return Array.from({ length: HOURS_PER_TREND_WINDOW }, (_, index) => {
    const offset = HOURS_PER_TREND_WINDOW - index - 1;
    const bucket = new Date(currentHour.getTime() - offset * MILLISECONDS_PER_HOUR);
    return {
      bucketStart: bucket.toISOString(),
      successCount: 0,
      failedCount: 0,
    };
  });
}

function getRequestRate10m(db: AppDatabase, now: Date): DashboardSummary["requestRate"] {
  const since = subtractMinutes(now, MINUTES_PER_RPM_WINDOW);
  const row = db.sqlite
    .prepare("SELECT COUNT(*) AS total FROM request_logs WHERE created_at >= ?")
    .get(since) as { total: number };
  const requestCount10m = row.total ?? 0;
  return {
    rpm10m: requestCount10m / MINUTES_PER_RPM_WINDOW,
    requestCount10m,
  };
}

function getDelivery24h(db: AppDatabase, now: Date): DashboardSummary["delivery24h"] {
  const since = new Date(now.getTime() - HOURS_PER_TREND_WINDOW * MILLISECONDS_PER_HOUR).toISOString();
  const row = db.sqlite
    .prepare(
      `SELECT
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) AS success_count,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed_count
       FROM request_logs
       WHERE created_at >= ?`,
    )
    .get(since) as StatusTotalsRow;
  const successful = row.success_count ?? 0;
  const failed = row.failed_count ?? 0;
  const total = successful + failed;
  return {
    total,
    successful,
    failed,
    errorRate: total === 0 ? 0 : (failed / total) * 100,
  };
}

function getProviderErrors24h(db: AppDatabase, now: Date): ProviderErrorCount[] {
  const since = new Date(now.getTime() - HOURS_PER_TREND_WINDOW * MILLISECONDS_PER_HOUR).toISOString();
  return db.sqlite
    .prepare(
      `SELECT provider, COUNT(*) AS count
       FROM request_attempt_logs
       WHERE status = 'failed' AND created_at >= ?
       GROUP BY provider
       ORDER BY count DESC, provider ASC`,
    )
    .all(since) as ProviderErrorRow[];
}

function getTrend24h(db: AppDatabase, now: Date): DashboardTrendPoint[] {
  const skeleton = buildTrendSkeleton(now);
  const since = skeleton[0]?.bucketStart ?? now.toISOString();
  const rows = db.sqlite
    .prepare(
      `SELECT
        substr(created_at, 1, 13) AS bucket_hour,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) AS success_count,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed_count
       FROM request_logs
       WHERE created_at >= ?
       GROUP BY bucket_hour
       ORDER BY bucket_hour ASC`,
    )
    .all(since) as TrendRow[];
  const counts = new Map(
    rows.map((row) => [
      bucketKeyToIso(row.bucket_hour),
      {
        successCount: row.success_count ?? 0,
        failedCount: row.failed_count ?? 0,
      },
    ]),
  );
  return skeleton.map((point) => ({
    ...point,
    ...counts.get(point.bucketStart),
  }));
}

function getLatestErrors24h(db: AppDatabase, now: Date): RequestLogRecord[] {
  const since = new Date(now.getTime() - HOURS_PER_TREND_WINDOW * MILLISECONDS_PER_HOUR).toISOString();
  const rows = db.sqlite
    .prepare(
      `SELECT *
       FROM request_logs
       WHERE status = 'failed' AND created_at >= ?
       ORDER BY created_at DESC
       LIMIT ?`,
    )
    .all(since, LATEST_ERROR_LIMIT) as Record<string, unknown>[];
  return rows.map(mapRequestLog);
}

export function getDashboardSummary(db: AppDatabase): DashboardSummary {
  const now = new Date();
  const cached = getCachedDashboardSummary(now.getTime());
  if (cached) {
    return cached;
  }

  return setCachedDashboardSummary({
    requestRate: getRequestRate10m(db, now),
    delivery24h: getDelivery24h(db, now),
    trend24h: getTrend24h(db, now),
    providerErrors24h: getProviderErrors24h(db, now),
    latestErrors: getLatestErrors24h(db, now),
  }, now.getTime());
}
