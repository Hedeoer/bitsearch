import {
  Activity,
  CheckCircle2,
  RefreshCw,
  Waypoints,
} from "lucide-react";
import type {
  DashboardSummary,
  ProviderConfigRecord,
  SystemSettings,
  ToolSurfaceSnapshot,
} from "@shared/contracts";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDateTime, formatDecimal, formatNumber, formatPercentage } from "../format";
import { LoadingOverlay } from "./Feedback";

type OverviewPulsePanelProps = Readonly<{
  dashboard: DashboardSummary | null;
  loading: boolean;
  providers: ProviderConfigRecord[];
  system: SystemSettings;
  toolSurface: ToolSurfaceSnapshot;
}>;

type MetricCardProps = Readonly<{
  label: string;
  tone: "primary" | "success" | "warning" | "danger";
  value: string;
  supporting: string;
}>;

function getMetricToneClass(tone: MetricCardProps["tone"]) {
  if (tone === "success") {
    return "border-emerald-400/16 bg-emerald-400/8";
  }
  if (tone === "warning") {
    return "border-amber-300/16 bg-amber-300/8";
  }
  if (tone === "danger") {
    return "border-rose-300/16 bg-rose-300/8";
  }
  return "border-cyan-300/16 bg-cyan-400/8";
}

function MetricCard(props: MetricCardProps) {
  return (
    <div
      className={`overview-subtle-card rounded-[22px] border p-4 ${getMetricToneClass(props.tone)}`}
    >
      <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--text-dim)]">
        {props.label}
      </div>
      <div className="mt-3 font-['Space_Grotesk'] text-[1.9rem] font-semibold tracking-[-0.04em] text-[color:var(--text)]">
        {props.value}
      </div>
      <div className="mt-2 text-sm leading-6 text-[color:var(--text-soft)]">
        {props.supporting}
      </div>
    </div>
  );
}

function CompactFact(props: Readonly<{ label: string; value: string }>) {
  return (
    <div className="rounded-[18px] border border-white/8 bg-white/4 px-4 py-3">
      <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--text-dim)]">
        {props.label}
      </div>
      <div className="mt-2 text-sm font-medium text-[color:var(--text)]">{props.value}</div>
    </div>
  );
}

function PostureCard(props: Readonly<{
  label: string;
  value: string;
  supporting: string;
}>) {
  return (
    <div className="rounded-[18px] border border-white/8 bg-black/10 px-4 py-3">
      <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--text-dim)]">
        {props.label}
      </div>
      <div className="mt-2 text-sm font-medium text-[color:var(--text)]">{props.value}</div>
      <div className="mt-1 text-xs leading-5 text-[color:var(--text-dim)]">
        {props.supporting}
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
    value: `${readyProviders.length} ready · ${limitedProviders.length} limited`,
    supporting: `${readyNames} ready · ${limitedNames} limited`,
  };
}

function HeroBadgeRow(props: Readonly<{
  availableProviders: number;
  routeLabel: string;
}>) {
  return (
    <div className="flex flex-wrap gap-2">
      <Badge variant="default">
        <RefreshCw className="size-3.5" />
        live 30s
      </Badge>
      <Badge variant="neutral">
        <Waypoints className="size-3.5" />
        {props.routeLabel}
      </Badge>
      <Badge variant={props.availableProviders > 1 ? "success" : "warning"}>
        <CheckCircle2 className="size-3.5" />
        {props.availableProviders} providers ready
      </Badge>
    </div>
  );
}

export function OverviewPulsePanel(props: OverviewPulsePanelProps) {
  const activeProviders = props.providers.filter((item) => item.enabled).length;
  const totalKeys = props.providers.reduce((sum, item) => sum + item.keyCount, 0);
  const availableProviders = props.toolSurface.providerCapabilities.filter(
    (item) => item.genericAvailable,
  );
  const totalRequests = props.dashboard?.delivery24h.total ?? 0;
  const successRate = props.dashboard
    ? Math.max(0, 100 - props.dashboard.delivery24h.errorRate)
    : null;
  const routeLabel =
    props.system.genericRoutingMode === "ordered_failover"
      ? "ordered failover"
      : "single provider";
  const effectiveOrder =
    props.toolSurface.genericRouting.effectiveProviderOrder.join(" -> ") || "pending";
  const refreshMode = props.toolSurface.requiresReconnect ? "refresh client" : "live";
  const refreshedAt = props.toolSurface.lastRefreshedAt
    ? formatDateTime(props.toolSurface.lastRefreshedAt)
    : "pending";
  const providerReadiness = formatProviderReadiness(
    props.toolSurface.providerCapabilities,
  );

  return (
    <Card className="relative overflow-hidden">
      {props.loading ? <LoadingOverlay label="Refreshing overview" /> : null}
      <div className="overview-grid-line absolute inset-0 opacity-35" aria-hidden="true" />
      <CardHeader className="relative pb-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <div className="eyebrow">Operations Snapshot</div>
            <CardTitle className="mt-2 text-2xl">Operational overview</CardTitle>
            <CardDescription className="mt-3 max-w-2xl">
              Health, throughput, and routing state stay visible without repeating control details.
            </CardDescription>
          </div>
          <HeroBadgeRow
            availableProviders={availableProviders.length}
            routeLabel={routeLabel}
          />
        </div>
      </CardHeader>

      <CardContent className="relative grid gap-4">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.85fr)]">
          <div className="grid gap-4">
            <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-4">
              <MetricCard
                label="10m RPM"
                tone="primary"
                value={formatDecimal(props.dashboard?.requestRate.rpm10m)}
                supporting={`${formatNumber(props.dashboard?.requestRate.requestCount10m)} requests in the last ten minutes`}
              />
              <MetricCard
                label="24h Success Rate"
                tone="success"
                value={formatPercentage(successRate)}
                supporting={`${formatNumber(props.dashboard?.delivery24h.successful)} successful outcomes`}
              />
              <MetricCard
                label="24h Failures"
                tone="danger"
                value={formatNumber(props.dashboard?.delivery24h.failed)}
                supporting="Final failures only, no retries counted twice"
              />
              <MetricCard
                label="24h Error Rate"
                tone="warning"
                value={formatPercentage(props.dashboard?.delivery24h.errorRate)}
                supporting="Rolling failure share across the last twenty-four hours"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <CompactFact label="24h Requests" value={formatNumber(totalRequests)} />
              <CompactFact
                label="Active Providers"
                value={`${activeProviders} / ${props.providers.length}`}
              />
              <CompactFact label="Enabled Keys" value={String(totalKeys)} />
            </div>
          </div>

          <div className="overview-subtle-card rounded-[24px] border border-white/8 bg-[color:var(--ui-card-soft)] p-5">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-[color:var(--text-dim)]">
              <Activity className="size-3.5" />
              System posture
            </div>
            <div className="mt-4 grid gap-3">
              <PostureCard
                label="Routing"
                value={routeLabel}
                supporting={effectiveOrder}
              />
              <PostureCard
                label="Provider readiness"
                value={providerReadiness.value}
                supporting={providerReadiness.supporting}
              />
              <PostureCard
                label="Surface freshness"
                value={`${refreshedAt} · ${refreshMode}`}
                supporting="Tool exposure refresh state"
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
