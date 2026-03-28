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
    <div className="metric-grid">
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index} className="metric-card metric-card--primary">
          <span className="skeleton-text" />
          <span className="skeleton-text" />
        </div>
      ))}
    </div>
  );
}

function MetaSummary(props: Readonly<{ providers: ProviderConfigRecord[] }>) {
  const activeProviders = props.providers.filter((provider) => provider.enabled).length;
  const totalKeys = props.providers.reduce((sum, provider) => sum + provider.keyCount, 0);

  return (
    <div className="overview-meta-grid">
      <div className="overview-meta-card">
        <span className="chip neutral-chip">
          <Server size={12} />
          Active Providers
        </span>
        <strong>{formatNumber(activeProviders)}</strong>
      </div>
      <div className="overview-meta-card">
        <span className="chip neutral-chip">
          <KeyRound size={12} />
          Total Keys
        </span>
        <strong>{formatNumber(totalKeys)}</strong>
      </div>
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

function DashboardMetrics(props: Readonly<{ dashboard: DashboardSummary }>) {
  return (
    <div className="metric-grid">
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
    </div>
  );
}

function ProviderErrorChips(props: Readonly<{ dashboard: DashboardSummary }>) {
  if (props.dashboard.providerErrors24h.length === 0) {
    return null;
  }
  return (
    <div className="chip-row">
      {props.dashboard.providerErrors24h.map((item) => (
        <span key={item.provider} className="chip warning-chip">
          <AlertTriangle size={11} />
          {item.provider}: {formatNumber(item.count)} failed attempts / 24h
        </span>
      ))}
    </div>
  );
}

export function OverviewPulsePanel(props: OverviewPulsePanelProps) {
  return (
    <article className="surface-card page-panel">
      {props.loading ? <LoadingOverlay label="Refreshing overview" /> : null}
      <PanelHeading />
      {props.dashboard ? <DashboardMetrics dashboard={props.dashboard} /> : <LoadingMetrics />}
      <MetaSummary providers={props.providers} />
      {props.dashboard ? <ProviderErrorChips dashboard={props.dashboard} /> : null}
    </article>
  );
}
