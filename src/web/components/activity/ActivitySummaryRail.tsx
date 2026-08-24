import { Activity, AlertTriangle, CheckCircle, Gauge, GitBranch, ServerCrash, Timer } from "lucide-react";
import type { ActivitySummary } from "@shared/contracts";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDecimal, formatDuration, formatNumber, formatPercentage } from "../../format";

type ActivitySummaryRailProps = {
  loading: boolean;
  summary: ActivitySummary | null;
};

function SummaryCard(
  props: Readonly<{
    icon: typeof Activity;
    label: string;
    loading: boolean;
    tone?: "primary" | "danger" | "warning" | "success";
    value: string;
    supporting: string;
  }>,
) {
  return (
    <Card>
      <CardContent className="grid gap-2 p-4">
        <div className="flex items-center justify-between gap-2">
          <span className={`grid size-8 place-items-center rounded-xl ${props.tone === "danger" ? "bg-destructive/10 text-destructive" : props.tone === "warning" ? "bg-warning/10 text-warning" : props.tone === "success" ? "bg-success/10 text-success" : "bg-primary/10 text-primary"}`}>
            <props.icon className="size-4" />
          </span>
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{props.label}</span>
        </div>
        {props.loading ? (
          <Skeleton className="h-8 w-24 rounded-lg" />
        ) : (
          <strong className="font-mono text-2xl font-semibold tabular-nums tracking-tight">{props.value}</strong>
        )}
        <p className="m-0 text-xs text-muted-foreground">{props.supporting}</p>
      </CardContent>
    </Card>
  );
}

export function ActivitySummaryRail(props: ActivitySummaryRailProps) {
  const summary = props.summary;
  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      <SummaryCard icon={Activity} label="Requests" loading={props.loading} tone="primary" value={formatNumber(summary?.totalRequests ?? 0)} supporting={props.loading ? "Refreshing current slice…" : "Filtered request count"} />
      <SummaryCard icon={summary?.failureRate === 0 ? CheckCircle : AlertTriangle} label="Failure Rate" loading={props.loading} tone={summary?.failureRate === 0 ? "success" : "danger"} value={formatPercentage(summary?.failureRate ?? 0)} supporting={`${formatNumber(summary?.failedRequests ?? 0)} failed requests`} />
      <SummaryCard icon={Timer} label="P95 Latency" loading={props.loading} tone="warning" value={formatDuration(summary?.p95DurationMs ?? 0)} supporting={`P50 ${formatDuration(summary?.p50DurationMs ?? 0)}`} />
      <SummaryCard icon={GitBranch} label="Avg Attempts" loading={props.loading} value={formatDecimal(summary?.avgAttempts ?? 0)} supporting={`${formatNumber(summary?.slowRequests ?? 0)} slow requests`} />
      <SummaryCard icon={ServerCrash} label="Top Failing Provider" loading={props.loading} value={summary?.topFailedProviders[0]?.value ?? "-"} supporting={summary?.topFailedProviders[0] ? `${formatNumber(summary.topFailedProviders[0].count)} failed attempts` : "No failed provider attempts"} />
      <SummaryCard icon={Gauge} label="Top Tool" loading={props.loading} value={summary?.topTools[0]?.value ?? "-"} supporting={summary?.topTools[0] ? `${formatNumber(summary.topTools[0].count)} requests` : "No requests yet"} />
    </section>
  );
}
