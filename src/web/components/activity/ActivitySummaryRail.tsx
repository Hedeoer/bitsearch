import { Activity, AlertTriangle, Gauge, GitBranch, ServerCrash, Timer } from "lucide-react";
import type { ActivitySummary } from "@shared/contracts";
import { formatDecimal, formatDuration, formatNumber, formatPercentage } from "../../format";

type ActivitySummaryRailProps = {
  loading: boolean;
  summary: ActivitySummary | null;
};

function SummaryCard(
  props: Readonly<{
    icon: typeof Activity;
    label: string;
    tone?: "primary" | "danger" | "warning";
    value: string;
    supporting: string;
  }>,
) {
  return (
    <article className={`metric-card activity-summary-card${props.tone ? ` activity-summary-card--${props.tone}` : ""}`}>
      <div className="activity-summary-top">
        <span className="activity-summary-icon">
          <props.icon size={14} />
        </span>
        <span className="eyebrow">{props.label}</span>
      </div>
      <strong className="activity-summary-value">{props.value}</strong>
      <p className="supporting compact">{props.supporting}</p>
    </article>
  );
}

export function ActivitySummaryRail(props: ActivitySummaryRailProps) {
  const summary = props.summary;
  return (
    <section className="activity-summary-rail">
      <SummaryCard
        icon={Activity}
        label="Requests"
        tone="primary"
        value={formatNumber(summary?.totalRequests ?? 0)}
        supporting={props.loading ? "Refreshing current slice…" : "Filtered request count"}
      />
      <SummaryCard
        icon={AlertTriangle}
        label="Failure Rate"
        tone="danger"
        value={formatPercentage(summary?.failureRate ?? 0)}
        supporting={`${formatNumber(summary?.failedRequests ?? 0)} failed requests`}
      />
      <SummaryCard
        icon={Timer}
        label="P95 Latency"
        tone="warning"
        value={formatDuration(summary?.p95DurationMs ?? 0)}
        supporting={`P50 ${formatDuration(summary?.p50DurationMs ?? 0)}`}
      />
      <SummaryCard
        icon={GitBranch}
        label="Avg Attempts"
        value={formatDecimal(summary?.avgAttempts ?? 0)}
        supporting={`${formatNumber(summary?.slowRequests ?? 0)} slow requests`}
      />
      <SummaryCard
        icon={ServerCrash}
        label="Top Failing Provider"
        value={summary?.topFailedProviders[0]?.value ?? "-"}
        supporting={summary?.topFailedProviders[0] ? `${formatNumber(summary.topFailedProviders[0].count)} failed attempts` : "No failed provider attempts"}
      />
      <SummaryCard
        icon={Gauge}
        label="Top Tool"
        value={summary?.topTools[0]?.value ?? "-"}
        supporting={summary?.topTools[0] ? `${formatNumber(summary.topTools[0].count)} requests` : "No requests yet"}
      />
    </section>
  );
}
