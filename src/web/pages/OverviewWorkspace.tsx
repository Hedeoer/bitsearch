import type { Dispatch, SetStateAction } from "react";
import type {
  AdminAccessInfo,
  DashboardSummary,
  McpAccessInfo,
  ProviderConfigRecord,
  SystemSettings,
  ToolSurfaceSnapshot,
} from "@shared/contracts";
import { OverviewLatestErrorsPanel } from "../components/OverviewLatestErrorsPanel";
import { OverviewPulsePanel } from "../components/OverviewPulsePanel";
import { RequestTrendPanel } from "../components/RequestTrendPanel";
import { StrategyPanel } from "../components/StrategyPanel";
import type { ToastTone } from "../components/Feedback";

type OverviewWorkspaceProps = Readonly<{
  dashboard: DashboardSummary | null;
  loading: boolean;
  adminAccess: AdminAccessInfo;
  onSaveAdminAccess: (authKey: string) => Promise<boolean>;
  mcpAccess: McpAccessInfo;
  onSaveMcpAccess: (token: string) => Promise<boolean>;
  onSaveSystem: () => void;
  onToast: (type: ToastTone, message: string) => void;
  setSystem: Dispatch<SetStateAction<SystemSettings>>;
  system: SystemSettings;
  toolSurface: ToolSurfaceSnapshot;
  providers: ProviderConfigRecord[];
}>;

export function OverviewWorkspace(props: OverviewWorkspaceProps) {
  return (
    <div className="workspace-stack">
      <OverviewPulsePanel
        dashboard={props.dashboard}
        loading={props.loading}
        providers={props.providers}
        system={props.system}
        toolSurface={props.toolSurface}
      />
      <div className="grid gap-4 2xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.92fr)]">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.08fr)_minmax(320px,0.92fr)]">
          <RequestTrendPanel
            loading={props.loading}
            trend={props.dashboard?.trend24h ?? []}
          />
          <OverviewLatestErrorsPanel
            errors={props.dashboard?.latestErrors ?? []}
            failedCount24h={props.dashboard?.delivery24h.failed ?? 0}
          />
        </div>
        <StrategyPanel
          loading={props.loading}
          adminAccess={props.adminAccess}
          onSaveAdminAccess={props.onSaveAdminAccess}
          mcpAccess={props.mcpAccess}
          onSaveMcpAccess={props.onSaveMcpAccess}
          system={props.system}
          onToast={props.onToast}
          setSystem={props.setSystem}
          onSave={props.onSaveSystem}
          toolSurface={props.toolSurface}
        />
      </div>
    </div>
  );
}
