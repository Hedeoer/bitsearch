import {
  ACTIVITY_SORT_DIRECTIONS,
  ACTIVITY_SORT_FIELDS,
  ACTIVITY_TIME_PRESETS,
  type ActivityQuery,
  type ActivitySortDirection,
  type ActivitySortField,
  type ActivityTimePreset,
  type RemoteProvider,
  REMOTE_PROVIDERS,
} from "@shared/contracts";

export const ACTIVITY_PAGE_SIZE = 25;

export type ActivityFilterState = {
  page: number;
  q: string;
  toolName: string;
  status: "" | "success" | "failed";
  provider: "" | RemoteProvider;
  errorType: string;
  timePreset: ActivityTimePreset;
  customStart: string;
  customEnd: string;
  minDurationMs: string;
  maxDurationMs: string;
  onlySlow: boolean;
  onlyFallback: boolean;
  sortBy: ActivitySortField;
  sortDir: ActivitySortDirection;
};

export const DEFAULT_ACTIVITY_FILTERS: ActivityFilterState = {
  page: 0,
  q: "",
  toolName: "",
  status: "",
  provider: "",
  errorType: "",
  timePreset: "all",
  customStart: "",
  customEnd: "",
  minDurationMs: "",
  maxDurationMs: "",
  onlySlow: false,
  onlyFallback: false,
  sortBy: "created_at",
  sortDir: "desc",
};

function parseBoolean(value: string | null): boolean {
  return value === "true" || value === "1";
}

function parseInteger(value: string | null): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export function readActivityFilters(searchParams: URLSearchParams): ActivityFilterState {
  const provider = searchParams.get("provider");
  const timePreset = searchParams.get("timePreset");
  const sortBy = searchParams.get("sortBy");
  const sortDir = searchParams.get("sortDir");
  return {
    page: parseInteger(searchParams.get("page")),
    q: searchParams.get("q") ?? "",
    toolName: searchParams.get("toolName") ?? "",
    status: searchParams.get("status") === "success" || searchParams.get("status") === "failed"
      ? (searchParams.get("status") as ActivityFilterState["status"])
      : "",
    provider: provider && REMOTE_PROVIDERS.includes(provider as RemoteProvider)
      ? (provider as RemoteProvider)
      : "",
    errorType: searchParams.get("errorType") ?? "",
    timePreset: timePreset && ACTIVITY_TIME_PRESETS.includes(timePreset as ActivityTimePreset)
      ? (timePreset as ActivityTimePreset)
      : DEFAULT_ACTIVITY_FILTERS.timePreset,
    customStart: searchParams.get("customStart") ?? "",
    customEnd: searchParams.get("customEnd") ?? "",
    minDurationMs: searchParams.get("minDurationMs") ?? "",
    maxDurationMs: searchParams.get("maxDurationMs") ?? "",
    onlySlow: parseBoolean(searchParams.get("onlySlow")),
    onlyFallback: parseBoolean(searchParams.get("onlyFallback")),
    sortBy: sortBy && ACTIVITY_SORT_FIELDS.includes(sortBy as ActivitySortField)
      ? (sortBy as ActivitySortField)
      : DEFAULT_ACTIVITY_FILTERS.sortBy,
    sortDir: sortDir && ACTIVITY_SORT_DIRECTIONS.includes(sortDir as ActivitySortDirection)
      ? (sortDir as ActivitySortDirection)
      : DEFAULT_ACTIVITY_FILTERS.sortDir,
  };
}

export function toActivityQuery(filters: ActivityFilterState, deferredSearch: string): ActivityQuery {
  return {
    page: filters.page,
    pageSize: ACTIVITY_PAGE_SIZE,
    q: deferredSearch.trim() || undefined,
    toolName: filters.toolName || undefined,
    status: filters.status || undefined,
    provider: filters.provider || undefined,
    errorType: filters.errorType || undefined,
    timePreset: filters.timePreset,
    customStart: filters.customStart || undefined,
    customEnd: filters.customEnd || undefined,
    minDurationMs: filters.minDurationMs ? Number.parseInt(filters.minDurationMs, 10) : undefined,
    maxDurationMs: filters.maxDurationMs ? Number.parseInt(filters.maxDurationMs, 10) : undefined,
    onlySlow: filters.onlySlow || undefined,
    onlyFallback: filters.onlyFallback || undefined,
    sortBy: filters.sortBy,
    sortDir: filters.sortDir,
  };
}

export function toQueryString(query: ActivityQuery): string {
  const params = new URLSearchParams();
  params.set("page", String(query.page));
  params.set("pageSize", String(query.pageSize));
  if (query.q) params.set("q", query.q);
  if (query.toolName) params.set("toolName", query.toolName);
  if (query.status) params.set("status", query.status);
  if (query.provider) params.set("provider", query.provider);
  if (query.errorType) params.set("errorType", query.errorType);
  if (query.timePreset && query.timePreset !== "all") params.set("timePreset", query.timePreset);
  if (query.customStart) params.set("customStart", query.customStart);
  if (query.customEnd) params.set("customEnd", query.customEnd);
  if (typeof query.minDurationMs === "number") params.set("minDurationMs", String(query.minDurationMs));
  if (typeof query.maxDurationMs === "number") params.set("maxDurationMs", String(query.maxDurationMs));
  if (query.onlySlow) params.set("onlySlow", "true");
  if (query.onlyFallback) params.set("onlyFallback", "true");
  params.set("sortBy", query.sortBy);
  params.set("sortDir", query.sortDir);
  return params.toString();
}

export function toSearchParams(filters: ActivityFilterState): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.page > 0) params.set("page", String(filters.page));
  if (filters.q) params.set("q", filters.q);
  if (filters.toolName) params.set("toolName", filters.toolName);
  if (filters.status) params.set("status", filters.status);
  if (filters.provider) params.set("provider", filters.provider);
  if (filters.errorType) params.set("errorType", filters.errorType);
  if (filters.timePreset !== "all") params.set("timePreset", filters.timePreset);
  if (filters.customStart) params.set("customStart", filters.customStart);
  if (filters.customEnd) params.set("customEnd", filters.customEnd);
  if (filters.minDurationMs) params.set("minDurationMs", filters.minDurationMs);
  if (filters.maxDurationMs) params.set("maxDurationMs", filters.maxDurationMs);
  if (filters.onlySlow) params.set("onlySlow", "true");
  if (filters.onlyFallback) params.set("onlyFallback", "true");
  if (filters.sortBy !== DEFAULT_ACTIVITY_FILTERS.sortBy) params.set("sortBy", filters.sortBy);
  if (filters.sortDir !== DEFAULT_ACTIVITY_FILTERS.sortDir) params.set("sortDir", filters.sortDir);
  return params;
}

export function hasActiveActivityFilters(filters: ActivityFilterState): boolean {
  return (
    filters.q !== "" ||
    filters.toolName !== "" ||
    filters.status !== "" ||
    filters.provider !== "" ||
    filters.errorType !== "" ||
    filters.timePreset !== "all" ||
    filters.customStart !== "" ||
    filters.customEnd !== "" ||
    filters.minDurationMs !== "" ||
    filters.maxDurationMs !== "" ||
    filters.onlySlow ||
    filters.onlyFallback ||
    filters.sortBy !== DEFAULT_ACTIVITY_FILTERS.sortBy ||
    filters.sortDir !== DEFAULT_ACTIVITY_FILTERS.sortDir
  );
}
