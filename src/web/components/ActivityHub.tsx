import { useCallback, useEffect, useRef, useState } from "react";
import { Activity, Search, Globe, Server, Timer, ChevronLeft, ChevronRight } from "lucide-react";
import type { ActivityPageResult, RequestActivityRecord } from "@shared/contracts";
import { apiRequest } from "../api";
import { formatDuration, statusTone } from "../format";
import { EmptyState, LoadingOverlay } from "./Feedback";
import { RequestDetails } from "./RequestDetails";

const PAGE_SIZE = 25;

type TimeRangePreset = "all" | "today" | "last_hour" | "last_24_hours" | "custom";

export function ActivityHub() {
  const [query, setQuery] = useState("");
  const [toolFilter, setToolFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [timeRange, setTimeRange] = useState<TimeRangePreset>("all");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [page, setPage] = useState(0);
  const [result, setResult] = useState<ActivityPageResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchPage = useCallback(
    async (p: number, q: string, tool: string, status: string, preset: TimeRangePreset, cStart: string, cEnd: string) => {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("page", String(p));
      params.set("pageSize", String(PAGE_SIZE));
      if (q) params.set("q", q);
      if (tool !== "all") params.set("toolName", tool);
      if (status !== "all") params.set("status", status);
      if (preset !== "all") params.set("timePreset", preset);
      if (preset === "custom" && cStart) params.set("customStart", cStart);
      if (preset === "custom" && cEnd) params.set("customEnd", cEnd);

      const res = await apiRequest<ActivityPageResult>("GET", `/admin/activity?${params.toString()}`);
      setLoading(false);
      if (res.ok) {
        setResult(res.data);
        setSelectedRequestId((prev) => {
          const items = res.data.items;
          if (items.length === 0) return null;
          if (prev && items.some((item) => item.request.id === prev)) return prev;
          return items[0].request.id;
        });
      }
    },
    [],
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void fetchPage(page, query, toolFilter, statusFilter, timeRange, customStart, customEnd);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [fetchPage, page, query, toolFilter, statusFilter, timeRange, customStart, customEnd]);

  function resetFilters() {
    setQuery("");
    setToolFilter("all");
    setStatusFilter("all");
    setTimeRange("all");
    setCustomStart("");
    setCustomEnd("");
    setPage(0);
  }

  function handleFilterChange(fn: () => void) {
    fn();
    setPage(0);
  }

  const items = result?.items ?? [];
  const total = result?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const selected = items.find((item) => item.request.id === selectedRequestId) ?? null;

  const toolOptions = [...new Set(items.map((item) => item.request.toolName))].sort();

  const hasFilters =
    query !== "" ||
    toolFilter !== "all" ||
    statusFilter !== "all" ||
    timeRange !== "all";

  return (
    <section className="activity-hub">
      <article className="surface-card">
        <header style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
          <Activity size={16} style={{ color: "var(--primary)" }} />
          <h2 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 600 }}>Request Feed</h2>
          {total > 0 && (
            <span style={{ marginLeft: "auto", fontSize: "0.78rem", color: "var(--text-muted)" }}>
              {total} total
            </span>
          )}
        </header>

        <div className="activity-filters">
          <Search size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
          <input
            aria-label="Search requests"
            placeholder="Search tool, URL, provider…"
            style={{ flex: 1, minWidth: "10rem" }}
            type="search"
            value={query}
            onChange={(e) => handleFilterChange(() => setQuery(e.target.value))}
          />
          <select
            aria-label="Filter by tool"
            value={toolFilter}
            onChange={(e) => handleFilterChange(() => setToolFilter(e.target.value))}
          >
            <option value="all">All tools</option>
            {toolOptions.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <select
            aria-label="Filter by status"
            value={statusFilter}
            onChange={(e) => handleFilterChange(() => setStatusFilter(e.target.value))}
          >
            <option value="all">All statuses</option>
            <option value="success">Success</option>
            <option value="failed">Failed</option>
          </select>
          <select
            aria-label="Time range"
            value={timeRange}
            onChange={(e) => handleFilterChange(() => setTimeRange(e.target.value as TimeRangePreset))}
          >
            <option value="all">All time</option>
            <option value="today">Today</option>
            <option value="last_hour">Last hour</option>
            <option value="last_24_hours">Last 24 h</option>
            <option value="custom">Custom…</option>
          </select>
          {hasFilters && (
            <button className="btn-ghost" style={{ fontSize: "0.78rem" }} type="button" onClick={resetFilters}>
              Clear
            </button>
          )}
        </div>

        {timeRange === "custom" && (
          <div className="activity-custom-range">
            <label>
              <span style={{ fontSize: "0.76rem", color: "var(--text-muted)" }}>From</span>
              <input
                type="datetime-local"
                value={customStart}
                onChange={(e) => handleFilterChange(() => setCustomStart(e.target.value))}
              />
            </label>
            <label>
              <span style={{ fontSize: "0.76rem", color: "var(--text-muted)" }}>To</span>
              <input
                type="datetime-local"
                value={customEnd}
                onChange={(e) => handleFilterChange(() => setCustomEnd(e.target.value))}
              />
            </label>
          </div>
        )}

        <div className="activity-list" style={{ position: "relative" }}>
          {loading && <LoadingOverlay />}
          {!loading && items.length === 0 && (
            <EmptyState
              title="No requests found"
              description={hasFilters ? "Try adjusting your filters." : "No activity recorded yet."}
            />
          )}
          {items.map((item) => {
            const { request } = item;
            const tone = statusTone(request.status);
            const isSelected = request.id === selectedRequestId;
            return (
              <button
                className={`activity-item${isSelected ? " activity-item--selected" : ""}`}
                key={request.id}
                type="button"
                onClick={() => setSelectedRequestId(request.id)}
              >
                <div className="activity-item-top">
                  <span className="activity-item-tool">
                    <Server size={12} />
                    {request.toolName}
                  </span>
                  <span className={`status-badge status-badge--${tone}`}>{request.status}</span>
                </div>
                {request.targetUrl && (
                  <p className="activity-item-url">
                    <Globe size={11} />
                    {request.targetUrl}
                  </p>
                )}
                <div className="activity-item-meta">
                  <span style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                    <Timer size={11} />
                    {formatDuration(request.durationMs)}
                  </span>
                  <span style={{ color: "var(--text-muted)", fontSize: "0.74rem" }}>
                    {new Date(request.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className="activity-item-preview">
                  {request.errorSummary ?? request.resultPreview ?? "No summary"}
                </p>
              </button>
            );
          })}
        </div>

        {totalPages > 1 && (
          <div className="activity-pagination">
            <button
              className="btn-ghost activity-pagination-btn"
              disabled={page === 0}
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              <ChevronLeft size={14} />
            </button>
            <span className="activity-pagination-label">
              {page + 1} / {totalPages}
            </span>
            <button
              className="btn-ghost activity-pagination-btn"
              disabled={page >= totalPages - 1}
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        )}
      </article>

      <RequestDetails activity={selected} />
    </section>
  );
}
