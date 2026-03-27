import { useEffect, useMemo, useState } from "react";
import type { RequestActivityRecord } from "@shared/contracts";
import { formatDuration, statusTone } from "../format";
import { EmptyState, LoadingOverlay } from "./Feedback";
import { RequestDetails } from "./RequestDetails";

type ActivityHubProps = {
  activity: RequestActivityRecord[];
  loading: boolean;
};

type TimeRangePreset = "all" | "today" | "last_hour" | "last_24_hours" | "custom";

function isWithinTimeRange(
  createdAt: string,
  preset: TimeRangePreset,
  customStart: string,
  customEnd: string,
) {
  const timestamp = Date.parse(createdAt);
  if (!Number.isFinite(timestamp)) {
    return preset === "all";
  }
  const now = Date.now();
  if (preset === "today") {
    return timestamp >= new Date().setHours(0, 0, 0, 0);
  }
  if (preset === "last_hour") {
    return timestamp >= now - 60 * 60 * 1000;
  }
  if (preset === "last_24_hours") {
    return timestamp >= now - 24 * 60 * 60 * 1000;
  }
  if (preset === "custom") {
    const start = customStart ? Date.parse(customStart) : Number.NEGATIVE_INFINITY;
    const end = customEnd ? Date.parse(customEnd) : Number.POSITIVE_INFINITY;
    return timestamp >= start && timestamp <= end;
  }
  return true;
}

export function ActivityHub(props: ActivityHubProps) {
  const [query, setQuery] = useState("");
  const [toolFilter, setToolFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [timeRange, setTimeRange] = useState<TimeRangePreset>("all");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);

  const toolOptions = useMemo(() => {
    return [...new Set(props.activity.map((item) => item.request.toolName))].sort();
  }, [props.activity]);

  const filtered = useMemo(() => {
    return props.activity.filter((item) => {
      const { request } = item;
      const haystack = [
        request.toolName,
        request.targetUrl ?? "",
        request.finalProvider ?? "",
        request.errorSummary ?? "",
      ]
        .join(" ")
        .toLowerCase();
      if (query && !haystack.includes(query.toLowerCase())) {
        return false;
      }
      if (toolFilter !== "all" && request.toolName !== toolFilter) {
        return false;
      }
      if (statusFilter !== "all" && request.status !== statusFilter) {
        return false;
      }
      return isWithinTimeRange(request.createdAt, timeRange, customStart, customEnd);
    });
  }, [props.activity, customEnd, customStart, query, statusFilter, timeRange, toolFilter]);

  useEffect(() => {
    if (filtered.length === 0) {
      setSelectedRequestId(null);
      return;
    }
    const hasSelected = filtered.some((item) => item.request.id === selectedRequestId);
    if (!hasSelected) {
      setSelectedRequestId(filtered[0].request.id);
    }
  }, [filtered, selectedRequestId]);

  function resetFilters() {
    setQuery("");
    setToolFilter("all");
    setStatusFilter("all");
    setTimeRange("all");
    setCustomStart("");
    setCustomEnd("");
  }

  const selected =
    filtered.find((item) => item.request.id === selectedRequestId) ?? null;

  return (
    <section className="activity-hub" id="activity">
      <article className="surface-card">
        {props.loading ? <LoadingOverlay label="Refreshing activity" /> : null}
        <div className="section-heading">
          <div>
            <div className="eyebrow">Activity</div>
            <h3>Request Feed</h3>
          </div>
          <span className="chip neutral-chip">{filtered.length} visible</span>
        </div>
        <div className="activity-filters">
          <input
            placeholder="Search tool / url / provider / error"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <select value={toolFilter} onChange={(event) => setToolFilter(event.target.value)}>
            <option value="all">all tools</option>
            {toolOptions.map((toolName) => (
              <option key={toolName} value={toolName}>{toolName}</option>
            ))}
          </select>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="all">all status</option>
            <option value="success">success</option>
            <option value="failed">failed</option>
          </select>
          <select value={timeRange} onChange={(event) => setTimeRange(event.target.value as TimeRangePreset)}>
            <option value="all">all time</option>
            <option value="today">today</option>
            <option value="last_hour">last 1 hour</option>
            <option value="last_24_hours">last 24 hours</option>
            <option value="custom">custom range</option>
          </select>
        </div>
        {timeRange === "custom" ? (
          <div className="activity-custom-range">
            <label className="field">
              <span>Start</span>
              <input type="datetime-local" value={customStart} onChange={(event) => setCustomStart(event.target.value)} />
            </label>
            <label className="field">
              <span>End</span>
              <input type="datetime-local" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} />
            </label>
          </div>
        ) : null}
        <div className="activity-list">
          {props.activity.length === 0 ? (
            <EmptyState
              description="Requests sent through the MCP endpoint will appear here once traffic starts flowing."
              title="No request activity yet"
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              actionLabel="Clear filters"
              description="No activity matches the current filters. Clear them to inspect the broader request history."
              onAction={resetFilters}
              title="No matching requests"
            />
          ) : filtered.map((item) => (
            <button
              key={item.request.id}
              type="button"
              className={`activity-item ${
                item.request.id === selectedRequestId ? "activity-item-selected" : ""
              }`}
              onClick={() => setSelectedRequestId(item.request.id)}
            >
              <div className="activity-item-top">
                <strong>{item.request.toolName}</strong>
                <span className={`status-pill ${statusTone(item.request.status)}`}>
                  {item.request.status}
                </span>
              </div>
              <div className="activity-item-meta">
                <span className="mono">{item.request.targetUrl ?? "no target url"}</span>
                <span>{item.request.finalProvider ?? "-"}</span>
                <span>{formatDuration(item.request.durationMs)}</span>
              </div>
              <p className="supporting compact">
                {item.request.errorSummary ?? item.request.resultPreview ?? "No summary"}
              </p>
            </button>
          ))}
        </div>
      </article>
      <RequestDetails activity={selected} />
    </section>
  );
}
