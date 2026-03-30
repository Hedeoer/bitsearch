import type { Router } from "express";
import {
  ACTIVITY_SORT_DIRECTIONS,
  ACTIVITY_SORT_FIELDS,
  ACTIVITY_TIME_PRESETS,
  REMOTE_PROVIDERS,
  REQUEST_STATUSES,
  type ActivityQuery,
} from "../../shared/contracts.js";
import type { AppContext } from "../app-context.js";
import {
  getActivityDetail,
  listActivityFacets,
  listActivityItems,
  getActivitySummary,
} from "../repos/activity-repo.js";
import { parseLimit, parsePage } from "./admin-route-utils.js";

const DEFAULT_PAGE_SIZE = 25;

function parseOptionalEnum<T extends readonly string[]>(
  raw: unknown,
  values: T,
): T[number] | undefined {
  const value = String(raw ?? "").trim();
  if (!value) {
    return undefined;
  }
  return values.includes(value) ? (value as T[number]) : undefined;
}

function parseOptionalInteger(raw: unknown): number | undefined {
  const value = String(raw ?? "").trim();
  if (!value) {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseOptionalBoolean(raw: unknown): boolean | undefined {
  const value = String(raw ?? "").trim().toLowerCase();
  if (!value) {
    return undefined;
  }
  if (value === "true" || value === "1") {
    return true;
  }
  if (value === "false" || value === "0") {
    return false;
  }
  return undefined;
}

function parseActivityQuery(query: Record<string, unknown>): ActivityQuery {
  return {
    page: parsePage(query.page),
    pageSize: parseLimit(query.pageSize, DEFAULT_PAGE_SIZE, 100),
    q: query.q ? String(query.q).trim() || undefined : undefined,
    toolName: query.toolName ? String(query.toolName).trim() || undefined : undefined,
    status: parseOptionalEnum(query.status, REQUEST_STATUSES),
    provider: parseOptionalEnum(query.provider, REMOTE_PROVIDERS),
    errorType: query.errorType ? String(query.errorType).trim() || undefined : undefined,
    timePreset: parseOptionalEnum(query.timePreset, ACTIVITY_TIME_PRESETS),
    customStart: query.customStart ? String(query.customStart).trim() || undefined : undefined,
    customEnd: query.customEnd ? String(query.customEnd).trim() || undefined : undefined,
    minDurationMs: parseOptionalInteger(query.minDurationMs),
    maxDurationMs: parseOptionalInteger(query.maxDurationMs),
    onlySlow: parseOptionalBoolean(query.onlySlow),
    onlyFallback: parseOptionalBoolean(query.onlyFallback),
    sortBy: parseOptionalEnum(query.sortBy, ACTIVITY_SORT_FIELDS) ?? "created_at",
    sortDir: parseOptionalEnum(query.sortDir, ACTIVITY_SORT_DIRECTIONS) ?? "desc",
  };
}

export function registerActivityRoutes(router: Router, context: AppContext): void {
  router.get("/activity", (req, res) => {
    res.json(listActivityItems(context.db, parseActivityQuery(req.query as Record<string, unknown>)));
  });

  router.get("/activity/summary", (req, res) => {
    res.json(getActivitySummary(context.db, parseActivityQuery(req.query as Record<string, unknown>)));
  });

  router.get("/activity/facets", (_req, res) => {
    res.json(listActivityFacets(context.db));
  });

  router.get("/activity/:requestId", (req, res) => {
    const detail = getActivityDetail(context.db, req.params.requestId);
    if (!detail) {
      res.status(404).json({ error: "activity_not_found" });
      return;
    }
    res.json(detail);
  });
}
