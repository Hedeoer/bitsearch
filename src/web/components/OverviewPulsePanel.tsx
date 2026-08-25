import type {
  DashboardSummary,
  ProviderConfigRecord,
  SystemSettings,
  ToolSurfaceSnapshot,
} from "@shared/contracts";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDecimal, formatNumber, formatPercentage } from "../format";

type MetricOverviewRowProps = Readonly<{
  dashboard: DashboardSummary | null;
  loading: boolean;
  providers: ProviderConfigRecord[];
  system: SystemSettings;
  toolSurface: ToolSurfaceSnapshot;
}>;

type MetricCardProps = Readonly<{
  label: string;
  value: string;
  description: string;
  supporting: string;
  loading: boolean;
}>;

function MetricCard(props: MetricCardProps) {
  return (
    <div className="grid gap-3 rounded-xl border border-border/70 bg-card p-4 shadow-xs">
      <div className="text-sm text-muted-foreground">{props.label}</div>
      {props.loading ? (
        <Skeleton className="h-9 w-24 rounded-lg" />
      ) : (
        <div className="truncate font-mono text-3xl font-semibold tabular-nums tracking-tight">
          {props.value}
        </div>
      )}
      <div className="grid gap-0.5">
        <div className="text-sm font-medium">{props.description}</div>
        <div className="text-sm text-muted-foreground">{props.supporting}</div>
      </div>
    </div>
  );
}

function formatProviderReadiness(
  providers: ToolSurfaceSnapshot["providerCapabilities"],
) {
  const readyProviders = providers.filter((item) => item.genericAvailable);
  const limitedProviders = providers.filter((item) => !item.genericAvailable);
  const readyNames = readyProviders.map((item) => item.provider).join(", ");

  if (readyProviders.length === 0) {
    return {
      value: "0 ready",
      supporting: "No generic providers are available.",
    };
  }

  if (limitedProviders.length === 0) {
    return {
      value: `${readyProviders.length} ready`,
      supporting: readyNames,
    };
  }

  const limitedNames = limitedProviders.map((item) => item.provider).join(", ");
  return {
    value: `${readyProviders.length}r · ${limitedProviders.length}l`,
    supporting: `${readyNames} ready · ${limitedNames} limited`,
  };
}

export function MetricOverviewRow(props: MetricOverviewRowProps) {
  const d = props.dashboard;
  const loading = props.loading && !d;
  const successRate = d
    ? Math.max(0, 100 - d.delivery24h.errorRate)
    : null;
  const activeProviders = props.providers.filter((item) => item.enabled).length;
  const totalKeys = props.providers.reduce((sum, item) => sum + item.keyCount, 0);
  const routeLabel =
    props.system.genericRoutingMode === "ordered_failover"
      ? "Failover"
      : "Single";
  const routeSupporting =
    props.system.genericRoutingMode === "ordered_failover"
      ? "Ordered failover mode"
      : "Single provider mode";
  const readiness = formatProviderReadiness(props.toolSurface.providerCapabilities);

  return (
    <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-4">
      <MetricCard
        label="24h Requests"
        value={formatNumber(d?.delivery24h.total ?? 0)}
        description="All MCP tool calls"
        supporting="Successful + failed outcomes"
        loading={loading}
      />
      <MetricCard
        label="24h Success Rate"
        value={formatPercentage(successRate)}
        description={`${formatNumber(d?.delivery24h.successful ?? 0)} successful outcomes`}
        supporting="Across the last twenty-four hours"
        loading={loading}
      />
      <MetricCard
        label="24h Failures"
        value={formatNumber(d?.delivery24h.failed ?? 0)}
        description={`${formatPercentage(d?.delivery24h.errorRate)} of requests`}
        supporting="Final failures only, no retries counted twice"
        loading={loading}
      />
      <MetricCard
        label="10-min RPM"
        value={formatDecimal(d?.requestRate.rpm10m)}
        description={`${formatNumber(d?.requestRate.requestCount10m)} requests in 10 min`}
        supporting="Rolling short-term rate"
        loading={loading}
      />
      <MetricCard
        label="Routing"
        value={routeLabel}
        description={props.toolSurface.genericRouting.effectiveProviderOrder.join(" -> ") || "pending"}
        supporting={routeSupporting}
        loading={loading}
      />
      <MetricCard
        label="Provider readiness"
        value={readiness.value}
        description={readiness.supporting}
        supporting="Generic tool availability"
        loading={loading}
      />
      <MetricCard
        label="Active providers"
        value={`${activeProviders} / ${props.providers.length}`}
        description="Enabled provider configs"
        supporting={`Of ${props.providers.length} configured`}
        loading={loading}
      />
      <MetricCard
        label="Enabled keys"
        value={formatNumber(totalKeys)}
        description="Across all providers"
        supporting="Tavily + Firecrawl key pools"
        loading={loading}
      />
    </div>
  );
}
