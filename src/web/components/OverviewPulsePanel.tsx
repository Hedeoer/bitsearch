import {
  Activity,
  AlertTriangle,
  CheckCircle,
  KeyRound,
  Server,
  XCircle,
} from "lucide-react";
import type { DashboardSummary, ProviderConfigRecord } from "@shared/contracts";
import { formatDecimal, formatNumber, formatPercentage } from "../format";
import { LoadingOverlay } from "./Feedback";

type OverviewPulsePanelProps = Readonly<{
  dashboard: DashboardSummary | null;
  loading: boolean;
  providers: ProviderConfigRecord[];
}>;

type MetricCardProps = Readonly<{
  icon: typeof Activity;
  label: string;
  tone: "primary" | "success" | "danger";
  value: string;
  supporting: string;
}>;

function MetricCard(props: MetricCardProps) {
  return (
    <div className={`metric-card metric-card--${props.tone}`}>
      <div className="metric-icon">
        <props.icon size={16} />
      </div>
      <strong className="metric-value">{props.value}</strong>
      <span className="metric-label">{props.label}</span>
      <span className="metric-supporting">{props.supporting}</span>
    </div>
  );
}

function LoadingMetrics() {
  return (
    <div className="metric-grid metric-grid--3col">
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="metric-card metric-card--primary">
          <span className="skeleton-text" />
          <span className="skeleton-text" />
        </div>
      ))}
    </div>
  );
}

function PanelHeading() {
  return (
    <div className="section-heading">
      <div>
        <div className="eyebrow">Dashboard</div>
        <h3>Service Pulse</h3>
      </div>
    </div>
  );
}

function DashboardMetrics(props: Readonly<{ dashboard: DashboardSummary; providers: ProviderConfigRecord[] }>) {
  const activeProviders = props.providers.filter((p) => p.enabled).length;
  const totalKeys = props.providers.reduce((sum, p) => sum + p.keyCount, 0);
  return (
    <div className="metric-grid metric-grid--3col">
      <MetricCard
        icon={Activity}
        label="10m RPM"
        tone="primary"
        value={formatDecimal(props.dashboard.requestRate.rpm10m)}
        supporting={`${formatNumber(props.dashboard.requestRate.requestCount10m)} requests in 10 minutes`}
      />
      <MetricCard
        icon={CheckCircle}
        label="24h Successful"
        tone="success"
        value={formatNumber(props.dashboard.delivery24h.successful)}
        supporting={`${formatNumber(props.dashboard.delivery24h.total)} total requests`}
      />
      <MetricCard
        icon={XCircle}
        label="24h Failed"
        tone="danger"
        value={formatNumber(props.dashboard.delivery24h.failed)}
        supporting="Final request outcomes only"
      />
      <MetricCard
        icon={AlertTriangle}
        label="24h Error Rate"
        tone="danger"
        value={formatPercentage(props.dashboard.delivery24h.errorRate)}
        supporting="Failed / total over rolling 24h"
      />
      <MetricCard
        icon={Server}
        label="Active Providers"
        tone="success"
        value={String(activeProviders)}
        supporting={`${props.providers.length} providers configured`}
      />
      <MetricCard
        icon={KeyRound}
        label="Total Keys"
        tone="primary"
        value={String(totalKeys)}
        supporting="Across all key pool providers"
      />
    </div>
  );
}

function ProviderAlertBlock(props: Readonly<{ dashboard: DashboardSummary }>) {
  const errors = props.dashboard.providerErrors24h;
  return (
    <div className="provider-alert-block">
      <span className="eyebrow provider-alert-title">Provider Alerts</span>
      {errors.length === 0 ? (
        <span className="chip success-chip">
          <CheckCircle size={11} />
          All providers healthy
        </span>
      ) : (
        errors.map((item) => (
          <div key={item.provider} className="provider-alert-row">
            <AlertTriangle size={12} />
            <span className="provider-alert-name">{item.provider}</span>
            <span className="provider-alert-count">{formatNumber(item.count)}</span>
            <span className="provider-alert-suffix">failed / 24h</span>
          </div>
        ))
      )}
    </div>
  );
}

export function OverviewPulsePanel(props: OverviewPulsePanelProps) {
  return (
    <article className="surface-card page-panel">
      {props.loading ? <LoadingOverlay label="Refreshing overview" /> : null}
      <PanelHeading />
      {props.dashboard ? <DashboardMetrics dashboard={props.dashboard} providers={props.providers} /> : <LoadingMetrics />}
      {props.dashboard ? <ProviderAlertBlock dashboard={props.dashboard} /> : null}
    </article>
  );
}
