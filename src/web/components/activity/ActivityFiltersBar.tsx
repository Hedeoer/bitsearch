import { useState } from "react";
import { ChevronUp, Clock, Download, Filter, RefreshCw, Search, SlidersHorizontal, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
    <section className="rounded-xl border border-border/70 bg-card p-4 shadow-xs sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="mt-1 text-base font-semibold tracking-tight">Trace, filter, and isolate slow or failing requests.</h3>
        </div>
      </div>

      <div className="mt-4 grid items-center gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_190px_170px_auto]">
        <div className="relative sm:col-span-2 lg:col-span-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={props.filters.q}
              placeholder="tool, URL, provider, error, preview"
              className="pl-9"
              onChange={(event) => props.onPatch({ q: event.target.value })}
            />
          </div>

        <div className="min-w-0">
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

        <div className="min-w-0">
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

        <div className="flex items-center justify-end gap-1.5 sm:col-span-2 lg:col-span-1">
          <Button type="button" size="sm" variant={advancedCount > 0 ? "default" : "secondary"} onClick={() => setShowAdvanced(!showAdvanced)}>
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

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs onValueChange={handleTabChange} value={activeTab}>
          <TabsList aria-label="Activity views">
            <TabsTrigger value="all">All views</TabsTrigger>
            <TabsTrigger value="failed"><span aria-hidden="true" className="size-1.5 rounded-full bg-destructive" /> Failed</TabsTrigger>
            <TabsTrigger value="slow"><span aria-hidden="true" className="size-1.5 rounded-full bg-warning" /> Slow</TabsTrigger>
            <TabsTrigger value="fallback">Fallback</TabsTrigger>
          </TabsList>
        </Tabs>

        {props.hasActiveFilters ? (
          <Button size="sm" type="button" variant="ghost" onClick={props.onReset}>
            <X size={14} />
            Clear filters
          </Button>
        ) : null}
      </div>

      {props.filters.timePreset === "custom" ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label className="text-sm font-medium">From</Label>
            <Input
              type="datetime-local"
              value={props.filters.customStart}
              onChange={(event) => props.onPatch({ customStart: event.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label className="text-sm font-medium">To</Label>
            <Input
              type="datetime-local"
              value={props.filters.customEnd}
              onChange={(event) => props.onPatch({ customEnd: event.target.value })}
            />
          </div>
        </div>
      ) : null}

      {showAdvanced ? (
        <div className="mt-4 grid gap-3 rounded-2xl border border-border/60 bg-muted/20 p-3 md:grid-cols-2 xl:grid-cols-[repeat(3,minmax(0,1fr))_220px_200px]">
          <div className="min-w-0">
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

          <div className="min-w-0">
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

          <div className="min-w-0">
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

          <div className="grid content-center gap-2">
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min="0"
                placeholder="Min ms"
                value={props.filters.minDurationMs}
                onChange={(event) => props.onPatch({ minDurationMs: event.target.value })}
              />
              <span className="text-muted-foreground">-</span>
              <Input
                type="number"
                min="0"
                placeholder="Max ms"
                value={props.filters.maxDurationMs}
                onChange={(event) => props.onPatch({ maxDurationMs: event.target.value })}
              />
            </div>
          </div>

          <div className="grid content-center gap-2">
            <div className="flex items-center gap-2">
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
