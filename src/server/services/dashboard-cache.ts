import type { DashboardSummary } from "../../shared/contracts.js";

const DASHBOARD_CACHE_TTL_MS = 10_000;

let cachedSummary: DashboardSummary | null = null;
let cachedAt = 0;

export function getCachedDashboardSummary(nowMs: number): DashboardSummary | null {
  if (!cachedSummary || nowMs - cachedAt > DASHBOARD_CACHE_TTL_MS) {
    return null;
  }
  return cachedSummary;
}

export function setCachedDashboardSummary(
  summary: DashboardSummary,
  nowMs: number,
): DashboardSummary {
  cachedSummary = summary;
  cachedAt = nowMs;
  return summary;
}

export function invalidateDashboardSummaryCache(): void {
  cachedSummary = null;
  cachedAt = 0;
}
