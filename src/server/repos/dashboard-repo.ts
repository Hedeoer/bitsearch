import type {
  DashboardSummary,
  DashboardTrendPoint,
  DashboardTrendRange,
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
const LATEST_ERROR_LIMIT = 24;
const MILLISECONDS_PER_MINUTE = 60_000;
const MILLISECONDS_PER_HOUR = 3_600_000;

type TrendWindowSpec = {
  hours: number;
  bucketHours: 1 | 6 | 24;
  bucketCount: number;
};

const TREND_WINDOWS: Record<DashboardTrendRange, TrendWindowSpec> = {
  "24h": { hours: 24, bucketHours: 1, bucketCount: 24 },
  "7d": { hours: 168, bucketHours: 6, bucketCount: 28 },
  "30d": { hours: 720, bucketHours: 24, bucketCount: 30 },
};

const TREND_RANGES = Object.keys(TREND_WINDOWS) as DashboardTrendRange[];

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

export function aggregateHourlyBuckets(
  hourly: DashboardTrendPoint[],
  bucketHours: 1 | 6 | 24,
  now: Date,
): DashboardTrendPoint[] {
  if (bucketHours === 1) {
    return hourly;
  }
  const bucketMs = bucketHours * MILLISECONDS_PER_HOUR;
  const currentBucketStart = Math.floor(now.getTime() / bucketMs) * bucketMs;
  const merged = new Map<number, DashboardTrendPoint>();
  for (const point of hourly) {
    const startMs = new Date(point.bucketStart).getTime();
    if (Number.isNaN(startMs)) {
      continue;
    }
    // 尾部桶对齐 now 所在桶，其余对齐固定粒度边界（6h/24h 均能整除日界）。
    const bucketStart = startMs >= currentBucketStart
      ? currentBucketStart
      : Math.floor(startMs / bucketMs) * bucketMs;
    const existing = merged.get(bucketStart);
    if (existing) {
      existing.successCount += point.successCount;
      existing.failedCount += point.failedCount;
    } else {
      merged.set(bucketStart, {
        bucketStart: new Date(bucketStart).toISOString(),
        successCount: point.successCount,
        failedCount: point.failedCount,
      });
    }
  }
  return [...merged.entries()]
    .sort(([left], [right]) => left - right)
    .map(([, point]) => point);
}

function buildTrendSkeleton(now: Date, spec: TrendWindowSpec): string[] {
  const bucketMs = spec.bucketHours * MILLISECONDS_PER_HOUR;
  const currentBucketStart = Math.floor(now.getTime() / bucketMs) * bucketMs;
  return Array.from({ length: spec.bucketCount }, (_, index) =>
    new Date(currentBucketStart - (spec.bucketCount - index - 1) * bucketMs).toISOString(),
  );
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
  const since = new Date(now.getTime() - 24 * MILLISECONDS_PER_HOUR).toISOString();
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
  const since = new Date(now.getTime() - 24 * MILLISECONDS_PER_HOUR).toISOString();
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

function getTrendSeries(db: AppDatabase, now: Date): DashboardSummary["trend"] {
  let longestWindowHours = 0;
  for (const range of TREND_RANGES) {
    longestWindowHours = Math.max(longestWindowHours, TREND_WINDOWS[range].hours);
  }

  const hourlySkeletonStart = startOfUtcHour(
    new Date(now.getTime() - (longestWindowHours - 1) * MILLISECONDS_PER_HOUR),
  );
  const hourlySince = hourlySkeletonStart.toISOString();
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
    .all(hourlySince) as TrendRow[];
  const hourlyCounts = new Map(
    rows.map((row) => [
      bucketKeyToIso(row.bucket_hour),
      {
        successCount: row.success_count ?? 0,
        failedCount: row.failed_count ?? 0,
      },
    ]),
  );
  const hourlyPoints: DashboardTrendPoint[] = [];
  for (
    let ts = hourlySkeletonStart.getTime();
    ts <= startOfUtcHour(now).getTime();
    ts += MILLISECONDS_PER_HOUR
  ) {
    const bucketStart = new Date(ts).toISOString();
    const counts = hourlyCounts.get(bucketStart);
    hourlyPoints.push({
      bucketStart,
      successCount: counts?.successCount ?? 0,
      failedCount: counts?.failedCount ?? 0,
    });
  }

  const series = {} as DashboardSummary["trend"];
  for (const range of TREND_RANGES) {
    const spec = TREND_WINDOWS[range];
    const merged = aggregateHourlyBuckets(hourlyPoints, spec.bucketHours, now);
    const skeleton = buildTrendSkeleton(now, spec);
    const byStart = new Map(merged.map((point) => [point.bucketStart, point]));
    series[range] = skeleton.map((bucketStart) => ({
      bucketStart,
      successCount: byStart.get(bucketStart)?.successCount ?? 0,
      failedCount: byStart.get(bucketStart)?.failedCount ?? 0,
    }));
  }
  return series;
}

function getLatestErrors24h(db: AppDatabase, now: Date): RequestLogRecord[] {
  const since = new Date(now.getTime() - 24 * MILLISECONDS_PER_HOUR).toISOString();
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
    trend: getTrendSeries(db, now),
    providerErrors24h: getProviderErrors24h(db, now),
    latestErrors: getLatestErrors24h(db, now),
  }, now.getTime());
}
