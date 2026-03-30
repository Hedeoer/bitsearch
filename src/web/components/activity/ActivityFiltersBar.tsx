import { Filter, RefreshCw, Search, SlidersHorizontal, X } from "lucide-react";
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
  const toolOptions = props.facets?.tools ?? [];
  const providerOptions = props.facets?.providers ?? [];
  const errorOptions = props.facets?.errorTypes ?? [];

  return (
    <section className="surface-card activity-command-card">
      <div className="section-heading compact">
        <div>
          <div className="eyebrow">Activity Command</div>
          <h3>Trace, filter, and isolate slow or failing requests.</h3>
        </div>
        <div className="activity-command-actions">
          <button className="secondary-button" type="button" onClick={props.onExport}>
            Export CSV
          </button>
          <button className="secondary-button" type="button" onClick={props.onRefresh} disabled={props.loading}>
            <RefreshCw size={14} />
            Refresh
          </button>
          {props.hasActiveFilters ? (
            <button className="text-button" type="button" onClick={props.onReset}>
              <X size={14} />
              Clear filters
            </button>
          ) : null}
        </div>
      </div>

      <div className="activity-quick-filters">
        <button className="secondary-button" type="button" onClick={() => props.onReset()}>
          <Filter size={14} />
          All
        </button>
        <button className="secondary-button" type="button" onClick={() => props.onPatch({ status: "failed" })}>
          Failed
        </button>
        <button className="secondary-button" type="button" onClick={() => props.onPatch({ onlySlow: true })}>
          Slow
        </button>
        <button className="secondary-button" type="button" onClick={() => props.onPatch({ onlyFallback: true })}>
          Fallback
        </button>
        <button className="secondary-button" type="button" onClick={() => props.onPatch({ toolName: "web_search" })}>
          Search
        </button>
      </div>

      <div className="activity-command-grid">
        <label className="activity-command-search">
          <span className="activity-command-label">Global search</span>
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
          <span>Tool</span>
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
          <span>Status</span>
          <select
            value={props.filters.status}
            onChange={(event) => props.onPatch({ status: event.target.value as ActivityFilterState["status"] })}
          >
            <option value="">All statuses</option>
            <option value="success">Success</option>
            <option value="failed">Failed</option>
          </select>
        </label>

        <label className="field">
          <span>Provider</span>
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
          <span>Error type</span>
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

        <label className="field">
          <span>Time range</span>
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
        </label>

        <label className="field">
          <span>Min latency (ms)</span>
          <input
            type="number"
            min="0"
            value={props.filters.minDurationMs}
            onChange={(event) => props.onPatch({ minDurationMs: event.target.value })}
          />
        </label>

        <label className="field">
          <span>Max latency (ms)</span>
          <input
            type="number"
            min="0"
            value={props.filters.maxDurationMs}
            onChange={(event) => props.onPatch({ maxDurationMs: event.target.value })}
          />
        </label>

        <label className="field">
          <span>Sort by</span>
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

      <div className="activity-toggle-row">
        <label className="activity-toggle">
          <input
            type="checkbox"
            checked={props.filters.onlySlow}
            onChange={(event) => props.onPatch({ onlySlow: event.target.checked })}
          />
          <span>Only slow requests</span>
        </label>
        <label className="activity-toggle">
          <input
            type="checkbox"
            checked={props.filters.onlyFallback}
            onChange={(event) => props.onPatch({ onlyFallback: event.target.checked })}
          />
          <span>Only fallback / multi-attempt</span>
        </label>
      </div>
    </section>
  );
}
