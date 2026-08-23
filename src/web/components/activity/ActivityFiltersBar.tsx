import { useState } from "react";
import { ChevronUp, Clock, Download, Filter, RefreshCw, Search, SlidersHorizontal, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
        <div className="activity-command-search relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={props.filters.q}
              placeholder="tool, URL, provider, error, preview"
              onChange={(event) => props.onPatch({ q: event.target.value })}
            />
          </div>

        <div>
            <Select
              value={props.filters.timePreset}
              onValueChange={(value) => props.onPatch({ timePreset: value as ActivityFilterState["timePreset"] })}
            >
              <SelectTrigger className="w-full">
                <Clock className="size-4 text-muted-foreground" />
                <SelectValue placeholder="All time" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All time</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="last_hour">Last hour</SelectItem>
                <SelectItem value="last_24_hours">Last 24 hours</SelectItem>
                <SelectItem value="custom">Custom range</SelectItem>
              </SelectContent>
            </Select>
          </div>

        <div>
          <Select
            value={props.filters.status}
            onValueChange={(value) => props.onPatch({ status: value === "all" ? "" : value as ActivityFilterState["status"] })}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="success">Success</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="activity-command-actions">
          <Button className={advancedCount > 0 ? "activity-advanced-toggle-active" : undefined} type="button" variant="secondary" onClick={() => setShowAdvanced(!showAdvanced)}>
            {showAdvanced ? <ChevronUp size={14} /> : <Filter size={14} />}
            <span>{advancedCount > 0 ? `Filters (${advancedCount})` : "More Filters"}</span>
          </Button>
          <Button aria-label="Refresh activity" className="size-8" disabled={props.loading} size="icon" type="button" variant="ghost" onClick={props.onRefresh}>
            <RefreshCw size={14} />
          </Button>
          <Button aria-label="Export activity CSV" className="size-8" size="icon" type="button" variant="ghost" onClick={props.onExport}>
            <Download size={14} />
          </Button>
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
          <Button type="button" variant="ghost" onClick={props.onReset}>
            <X size={14} />
            Clear filters
          </Button>
        ) : null}
      </div>

      {props.filters.timePreset === "custom" ? (
        <div className="activity-custom-range-row">
          <div className="grid gap-2">
            <Label className="text-sm font-medium">From</Label>
            <Input
              type="datetime-local"
              value={props.filters.customStart}
              onChange={(event) => props.onPatch({ customStart: event.target.value })}
            />
          </div>
          <label className="field">
            <Label className="text-sm font-medium">To</Label>
            <Input
              type="datetime-local"
              value={props.filters.customEnd}
              onChange={(event) => props.onPatch({ customEnd: event.target.value })}
            />
          </label>
        </div>
      ) : null}

      {showAdvanced ? (
        <div className="activity-advanced-filters">
          <div>
            <Select
              value={props.filters.toolName}
              onValueChange={(value) => props.onPatch({ toolName: value === "all" ? "" : value })}
            >
              <SelectTrigger className="w-full"><SelectValue placeholder="All tools" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All tools</SelectItem>
                {toolOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.value} ({option.count})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Select
              value={props.filters.provider}
              onValueChange={(value) => props.onPatch({ provider: (value === "all" ? "" : value) as ActivityFilterState["provider"] })}
            >
              <SelectTrigger className="w-full"><SelectValue placeholder="All providers" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All providers</SelectItem>
                {providerOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.value} ({option.count})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Select
              value={props.filters.errorType}
              onValueChange={(value) => props.onPatch({ errorType: value === "all" ? "" : value })}
            >
              <SelectTrigger className="w-full"><SelectValue placeholder="All error types" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All error types</SelectItem>
                {errorOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.value} ({option.count})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="activity-latency-field grid gap-2">
            <div className="activity-latency-combo">
              <Input
                type="number"
                min="0"
                placeholder="Min ms"
                value={props.filters.minDurationMs}
                onChange={(event) => props.onPatch({ minDurationMs: event.target.value })}
              />
              <span className="latency-divider">-</span>
              <Input
                type="number"
                min="0"
                placeholder="Max ms"
                value={props.filters.maxDurationMs}
                onChange={(event) => props.onPatch({ maxDurationMs: event.target.value })}
              />
            </div>
          </div>

          <div className="activity-sort-field">
            <div className="activity-sort-row">
              <Select
                value={props.filters.sortBy}
                onValueChange={(value) => props.onPatch({ sortBy: value as ActivityFilterState["sortBy"] })}
              >
                <SelectTrigger className="w-full"><SelectValue placeholder="Sort by" /></SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                onClick={() => props.onPatch({ sortDir: props.filters.sortDir === "desc" ? "asc" : "desc" })}
              >
                <SlidersHorizontal size={14} />
                {props.filters.sortDir === "desc" ? "Desc" : "Asc"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
