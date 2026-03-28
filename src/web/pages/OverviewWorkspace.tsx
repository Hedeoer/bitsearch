import type { Dispatch, SetStateAction } from "react";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import type {
  DashboardSummary,
  McpAccessInfo,
  ProviderConfigRecord,
  SystemSettings,
} from "@shared/contracts";
import { formatDateTime } from "../format";
import { OverviewPulsePanel } from "../components/OverviewPulsePanel";
import { RequestTrendPanel } from "../components/RequestTrendPanel";
import { StrategyPanel } from "../components/StrategyPanel";
import type { ToastTone } from "../components/Feedback";

type OverviewWorkspaceProps = Readonly<{
  dashboard: DashboardSummary | null;
  loading: boolean;
  mcpAccess: McpAccessInfo;
  onSaveMcpAccess: (token: string) => Promise<boolean>;
  onSaveSystem: () => void;
  onToast: (type: ToastTone, message: string) => void;
  setSystem: Dispatch<SetStateAction<SystemSettings>>;
  system: SystemSettings;
  providers: ProviderConfigRecord[];
}>;

function LatestErrorsEmptyState() {
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
        Failed requests from the last 24 hours will appear here once the console
        records an error.
      </p>
    </article>
  );
}

function LatestErrorsPanel(props: Readonly<{
  failedCount24h: number;
  errors: DashboardSummary["latestErrors"];
}>) {
  if (props.errors.length === 0) {
    return <LatestErrorsEmptyState />;
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
          {props.failedCount24h} failures / 24h
        </span>
      </div>
      <div className="error-feed">
        {props.errors.slice(0, 4).map((item) => (
          <div key={item.id} className="error-feed-item">
            <div className="workspace-feed-top">
              <strong>{item.toolName}</strong>
              <span className="mono text-dim">{formatDateTime(item.createdAt)}</span>
            </div>
            <p className="supporting compact mono">
              {item.finalProvider ?? "no provider"} · {item.targetUrl ?? "no target"}
            </p>
            <p className="supporting compact error-summary">
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
        <OverviewPulsePanel
          dashboard={props.dashboard}
          loading={props.loading}
          providers={props.providers}
        />
        <StrategyPanel
          loading={props.loading}
          mcpAccess={props.mcpAccess}
          onSaveMcpAccess={props.onSaveMcpAccess}
          system={props.system}
          onToast={props.onToast}
          setSystem={props.setSystem}
          onSave={props.onSaveSystem}
        />
      </div>
      <RequestTrendPanel
        loading={props.loading}
        trend={props.dashboard?.trend24h ?? []}
      />
      <LatestErrorsPanel
        errors={props.dashboard?.latestErrors ?? []}
        failedCount24h={props.dashboard?.delivery24h.failed ?? 0}
      />
    </div>
  );
}
