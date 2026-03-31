import { useState } from "react";
import { ChevronUp, Clock, Download, Filter, RefreshCw, Search, SlidersHorizontal, X } from "lucide-react";
import type { ActivityFacets } from "@shared/contracts";
import type { ActivityFilterState } from "./activity-utils";

type ActivityFiltersBarProps = {
  facets: ActivityFacets | null;
  filters: ActivityFilterState;
  loading: boolean;
  hasActiveFilters: boolean;
  onExport: () => void;
  onPatch: (patch: Partial<ActivityFilterState>, resetPage?: boolean) => void;
  onReset: () => void;
  onRefresh: () => void;
};

const SORT_OPTIONS: Array<{ label: string; value: ActivityFilterState["sortBy"] }> = [
  { label: "Latest", value: "created_at" },
  { label: "Latency", value: "duration_ms" },
  { label: "Attempts", value: "attempts" },
];

export function ActivityFiltersBar(props: ActivityFiltersBarProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const toolOptions = props.facets?.tools ?? [];
  const providerOptions = props.facets?.providers ?? [];
  const errorOptions = props.facets?.errorTypes ?? [];

  let advancedCount = 0;
  if (props.filters.toolName) advancedCount++;
  if (props.filters.provider) advancedCount++;
  if (props.filters.errorType) advancedCount++;
  if (props.filters.minDurationMs || props.filters.maxDurationMs) advancedCount++;

  let activeTab = "all";
  if (props.filters.status === "failed") activeTab = "failed";
  else if (props.filters.onlySlow) activeTab = "slow";
  else if (props.filters.onlyFallback) activeTab = "fallback";

  function handleTabChange(tab: string) {
    props.onPatch({
      status: tab === "failed" ? "failed" : "",
      onlySlow: tab === "slow",
      onlyFallback: tab === "fallback"
    }, true);
  }

  return (
    <section className="surface-card activity-command-card">
      <div className="section-heading compact">
        <div>
          <div className="eyebrow">Activity Command</div>
          <h3>Trace, filter, and isolate slow or failing requests.</h3>
        </div>
      </div>

      <div className="activity-primary-filters">
        <label className="activity-command-search">
          <div className="activity-search-shell">
            <Search size={14} />
            <input
              type="search"
              value={props.filters.q}
              placeholder="tool, URL, provider, error, preview"
              onChange={(event) => props.onPatch({ q: event.target.value })}
            />
          </div>
        </label>

        <label className="field">
          <div className="activity-select-with-icon">
            <Clock size={13} />
            <select
              value={props.filters.timePreset}
              onChange={(event) => props.onPatch({ timePreset: event.target.value as ActivityFilterState["timePreset"] })}
            >
              <option value="all">All time</option>
              <option value="today">Today</option>
              <option value="last_hour">Last hour</option>
              <option value="last_24_hours">Last 24 hours</option>
              <option value="custom">Custom range</option>
            </select>
          </div>
        </label>

        <label className="field">
          <select
            value={props.filters.status}
            onChange={(event) => props.onPatch({ status: event.target.value as ActivityFilterState["status"] })}
          >
            <option value="">All statuses</option>
            <option value="success">Success</option>
            <option value="failed">Failed</option>
          </select>
        </label>

        <div className="activity-command-actions">
          <button
            className={`secondary-button activity-advanced-toggle${advancedCount > 0 ? " activity-advanced-toggle-active" : ""}`}
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            {showAdvanced ? <ChevronUp size={14} /> : <Filter size={14} />}
            <span>{advancedCount > 0 ? `Filters (${advancedCount})` : "More Filters"}</span>
          </button>
          <button className="icon-button" type="button" onClick={props.onRefresh} disabled={props.loading} title="Refresh">
            <RefreshCw size={14} />
          </button>
          <button className="icon-button" type="button" onClick={props.onExport} title="Export CSV">
            <Download size={14} />
          </button>
        </div>
      </div>

      <div className="activity-segmented-row">
        <div className="activity-segmented-control" role="tablist">
          <button type="button" role="tab" aria-selected={activeTab === "all"} className={activeTab === "all" ? "active" : ""} onClick={() => handleTabChange("all")}>All views</button>
          <button type="button" role="tab" aria-selected={activeTab === "failed"} className={activeTab === "failed" ? "active" : ""} onClick={() => handleTabChange("failed")}>
            <span className="dot dot-danger" /> Failed
          </button>
          <button type="button" role="tab" aria-selected={activeTab === "slow"} className={activeTab === "slow" ? "active" : ""} onClick={() => handleTabChange("slow")}>
            <span className="dot dot-warning" /> Slow
          </button>
          <button type="button" role="tab" aria-selected={activeTab === "fallback"} className={activeTab === "fallback" ? "active" : ""} onClick={() => handleTabChange("fallback")}>
            Fallback
          </button>
        </div>

        {props.hasActiveFilters ? (
          <button className="text-button" type="button" onClick={props.onReset}>
            <X size={14} />
            Clear filters
          </button>
        ) : null}
      </div>

      {props.filters.timePreset === "custom" ? (
        <div className="activity-custom-range-row">
          <label className="field">
            <span>From</span>
            <input
              type="datetime-local"
              value={props.filters.customStart}
              onChange={(event) => props.onPatch({ customStart: event.target.value })}
            />
          </label>
          <label className="field">
            <span>To</span>
            <input
              type="datetime-local"
              value={props.filters.customEnd}
              onChange={(event) => props.onPatch({ customEnd: event.target.value })}
            />
          </label>
        </div>
      ) : null}

      {showAdvanced ? (
        <div className="activity-advanced-filters">
          <label className="field">
            <select
              value={props.filters.toolName}
              onChange={(event) => props.onPatch({ toolName: event.target.value })}
            >
              <option value="">All tools</option>
              {toolOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.value} ({option.count})
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <select
              value={props.filters.provider}
              onChange={(event) => props.onPatch({ provider: event.target.value as ActivityFilterState["provider"] })}
            >
              <option value="">All providers</option>
              {providerOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.value} ({option.count})
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <select
              value={props.filters.errorType}
              onChange={(event) => props.onPatch({ errorType: event.target.value })}
            >
              <option value="">All error types</option>
              {errorOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.value} ({option.count})
                </option>
              ))}
            </select>
          </label>

          <label className="field activity-latency-field">
            <div className="activity-latency-combo">
              <input
                type="number"
                min="0"
                placeholder="Min ms"
                value={props.filters.minDurationMs}
                onChange={(event) => props.onPatch({ minDurationMs: event.target.value })}
              />
              <span className="latency-divider">-</span>
              <input
                type="number"
                min="0"
                placeholder="Max ms"
                value={props.filters.maxDurationMs}
                onChange={(event) => props.onPatch({ maxDurationMs: event.target.value })}
              />
            </div>
          </label>

          <label className="field activity-sort-field">
            <div className="activity-sort-row">
              <select
                value={props.filters.sortBy}
                onChange={(event) => props.onPatch({ sortBy: event.target.value as ActivityFilterState["sortBy"] })}
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <button
                className="secondary-button activity-sort-direction"
                type="button"
                onClick={() => props.onPatch({ sortDir: props.filters.sortDir === "desc" ? "asc" : "desc" })}
              >
                <SlidersHorizontal size={14} />
                {props.filters.sortDir === "desc" ? "Desc" : "Asc"}
              </button>
            </div>
          </label>
        </div>
      ) : null}
    </section>
  );
}
