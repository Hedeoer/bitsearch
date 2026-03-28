import type { Dispatch, SetStateAction } from "react";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import type { DashboardSummary, SystemSettings } from "@shared/contracts";
import { formatDateTime, formatNumber } from "../format";
import {
  OverviewPanel,
  StrategyPanel,
} from "../components/OverviewPanels";
import { WorkspaceIntro } from "../components/WorkspaceIntro";

type OverviewWorkspaceProps = Readonly<{
  dashboard: DashboardSummary | null;
  loading: boolean;
  onSaveSystem: () => void;
  setSystem: Dispatch<SetStateAction<SystemSettings>>;
  system: SystemSettings;
}>;

function LatestErrorsPanel(props: Readonly<{
  errors: DashboardSummary["latestErrors"];
}>) {
  if (props.errors.length === 0) {
    return (
      <article className="surface-card page-panel">
        <div className="page-panel-header">
          <div>
            <div className="eyebrow">Exceptions</div>
            <h3>Latest Errors</h3>
          </div>
          <span className="chip success-chip">
            <ShieldCheck size={12} />
            No active failure feed
          </span>
        </div>
        <p className="supporting">
          Recent request errors will appear here once the console records failed tool
          runs.
        </p>
      </article>
    );
  }

  return (
    <article className="surface-card page-panel">
      <div className="page-panel-header">
        <div>
          <div className="eyebrow">Exceptions</div>
          <h3>Latest Errors</h3>
        </div>
        <span className="chip warning-chip">
          <AlertTriangle size={12} />
          {props.errors.length} recent failures
        </span>
      </div>
      <div className="workspace-feed">
        {props.errors.slice(0, 4).map((item) => (
          <div key={item.id} className="workspace-feed-item">
            <div className="workspace-feed-top">
              <strong>{item.toolName}</strong>
              <span className="mono">{formatDateTime(item.createdAt)}</span>
            </div>
            <p className="supporting compact mono">
              {item.finalProvider ?? "no provider"} · {item.targetUrl ?? "no target"}
            </p>
            <p className="supporting compact">
              {item.errorSummary ?? item.resultPreview ?? "No summary"}
            </p>
          </div>
        ))}
      </div>
    </article>
  );
}

export function OverviewWorkspace(props: OverviewWorkspaceProps) {
  const providerOrder = props.system.providerPriority.join(" -> ");
  const metrics = [
    {
      label: "Total Requests",
      value: formatNumber(props.dashboard?.totalRequests ?? 0),
      tone: "live" as const,
    },
    {
      label: "Provider Order",
      value: providerOrder,
    },
    {
      label: "Retention",
      value: `${props.system.logRetentionDays} days`,
    },
    {
      label: "Provider Errors",
      value: String(props.dashboard?.providerErrors.length ?? 0),
      tone: props.dashboard?.providerErrors.length ? ("warning" as const) : undefined,
    },
  ];

  return (
    <div className="workspace-stack">
      <WorkspaceIntro
        eyebrow="Overview"
        title="Command-level visibility into routing, health, and operator posture."
        description="This workspace consolidates request volume, failure pressure, provider priority, and system policy into one cockpit surface."
        metrics={metrics}
      />
      <div className="workspace-grid-two">
        <OverviewPanel dashboard={props.dashboard} loading={props.loading} />
        <StrategyPanel
          loading={props.loading}
          system={props.system}
          setSystem={props.setSystem}
          onSave={props.onSaveSystem}
        />
      </div>
      <LatestErrorsPanel errors={props.dashboard?.latestErrors ?? []} />
    </div>
  );
}
