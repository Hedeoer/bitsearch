import { startTransition, useDeferredValue, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type {
  ActivityDetailRecord,
  ActivityFacets,
  ActivityListItem,
  ActivityListPageResult,
  ActivitySummary,
} from "@shared/contracts";
import { apiRequest } from "../../api";
import { ActivityFeed } from "./ActivityFeed";
import { ActivityFiltersBar } from "./ActivityFiltersBar";
import { ActivityInspector } from "./ActivityInspector";
import { ActivitySummaryRail } from "./ActivitySummaryRail";
import {
  DEFAULT_ACTIVITY_FILTERS,
  hasActiveActivityFilters,
  readActivityFilters,
  toActivityQuery,
  toQueryString,
  toSearchParams,
} from "./activity-utils";

function toCsv(items: ActivityListItem[]): string {
  const rows = [
    [
      "id",
      "created_at",
      "tool_name",
      "status",
      "final_provider",
      "attempts",
      "duration_ms",
      "primary_error_type",
      "target_url",
      "error_summary",
      "result_preview",
      "is_slow",
      "is_fallback",
    ],
    ...items.map((item) => [
      item.id,
      item.createdAt,
      item.toolName,
      item.status,
      item.finalProvider ?? "",
      String(item.attempts),
      String(item.durationMs),
      item.primaryErrorType ?? "",
      item.targetUrl ?? "",
      item.errorSummary ?? "",
      item.resultPreview ?? "",
      item.isSlow ? "true" : "false",
      item.isFallback ? "true" : "false",
    ]),
  ];
  return rows
    .map((columns) => columns.map((column) => `"${column.replace(/"/g, "\"\"")}"`).join(","))
    .join("\n");
}

function downloadCsv(content: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `bitsearch-activity-${Date.now()}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function ActivityWorkbench() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = readActivityFilters(searchParams);
  const deferredSearch = useDeferredValue(filters.q);
  const query = toActivityQuery(filters, deferredSearch);
  const queryString = toQueryString(query);
  const [result, setResult] = useState<ActivityListPageResult | null>(null);
  const [summary, setSummary] = useState<ActivitySummary | null>(null);
  const [facets, setFacets] = useState<ActivityFacets | null>(null);
  const [detail, setDetail] = useState<ActivityDetailRecord | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  function updateFilters(patch: Partial<typeof filters>, resetPage = true) {
    const next = {
      ...filters,
      ...patch,
      page: resetPage ? 0 : (patch.page ?? filters.page),
    };
    if (patch.timePreset && patch.timePreset !== "custom") {
      next.customStart = "";
      next.customEnd = "";
    }
    startTransition(() => setSearchParams(toSearchParams(next), { replace: true }));
  }

  function resetFilters() {
    startTransition(() => setSearchParams(toSearchParams(DEFAULT_ACTIVITY_FILTERS), { replace: true }));
  }

  useEffect(() => {
    let cancelled = false;
    setListLoading(true);
    setListError(null);
    void Promise.all([
      apiRequest<ActivityListPageResult>("GET", `/admin/activity?${queryString}`),
      apiRequest<ActivitySummary>("GET", `/admin/activity/summary?${queryString}`),
      apiRequest<ActivityFacets>("GET", "/admin/activity/facets"),
    ]).then(([listRes, summaryRes, facetsRes]) => {
      if (cancelled) {
        return;
      }
      if (!listRes.ok) {
        setListError(listRes.message);
        setResult(null);
      } else {
        setResult(listRes.data);
        setSelectedId((current) => {
          if (current && listRes.data.items.some((item) => item.id === current)) {
            return current;
          }
          return listRes.data.items[0]?.id ?? null;
        });
      }
      if (summaryRes.ok) {
        setSummary(summaryRes.data);
      }
      if (facetsRes.ok) {
        setFacets(facetsRes.data);
      }
    }).finally(() => {
      if (!cancelled) {
        setListLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [queryString, refreshTick]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setDetailError(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    setDetailError(null);
    void apiRequest<ActivityDetailRecord>("GET", `/admin/activity/${selectedId}`)
      .then((response) => {
        if (cancelled) {
          return;
        }
        if (!response.ok) {
          setDetail(null);
          setDetailError(response.message);
          return;
        }
        setDetail(response.data);
      })
      .finally(() => {
        if (!cancelled) {
          setDetailLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId, refreshTick]);

  async function exportCurrentSlice() {
    const firstQuery = { ...query, page: 0, pageSize: 100 };
    const firstRes = await apiRequest<ActivityListPageResult>("GET", `/admin/activity?${toQueryString(firstQuery)}`);
    if (!firstRes.ok) {
      setListError(firstRes.message);
      return;
    }
    const pages = Math.ceil(firstRes.data.total / 100);
    const items = [...firstRes.data.items];
    for (let page = 1; page < pages; page += 1) {
      const pageRes = await apiRequest<ActivityListPageResult>(
        "GET",
        `/admin/activity?${toQueryString({ ...firstQuery, page })}`,
      );
      if (!pageRes.ok) {
        setListError(pageRes.message);
        return;
      }
      items.push(...pageRes.data.items);
    }
    downloadCsv(toCsv(items));
  }

  return (
    <section className="activity-workspace">
      <ActivityFiltersBar
        facets={facets}
        filters={filters}
        loading={listLoading}
        hasActiveFilters={hasActiveActivityFilters(filters)}
        onExport={exportCurrentSlice}
        onPatch={updateFilters}
        onReset={resetFilters}
        onRefresh={() => setRefreshTick((value) => value + 1)}
      />
      <ActivitySummaryRail loading={listLoading} summary={summary} />
      <div className="activity-main-grid">
        <ActivityFeed
          error={listError}
          hasActiveFilters={hasActiveActivityFilters(filters)}
          loading={listLoading}
          result={result}
          selectedId={selectedId}
          onPageChange={(page) => updateFilters({ page }, false)}
          onSelect={setSelectedId}
        />
        <ActivityInspector
          detail={detail}
          error={detailError}
          loading={detailLoading}
        />
      </div>
    </section>
  );
}
