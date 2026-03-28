import type { Dispatch, SetStateAction } from "react";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import type { DashboardSummary, SystemSettings } from "@shared/contracts";
import { formatDateTime } from "../format";
import {
  OverviewPanel,
  StrategyPanel,
} from "../components/OverviewPanels";

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
  return (
    <div className="workspace-stack">
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
