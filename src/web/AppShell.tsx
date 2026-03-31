import type { Dispatch, SetStateAction } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import type {
  AdminAccessInfo,
  McpAccessInfo,
  ProviderConfigRecord,
  RemoteProvider,
  SystemSettings,
  ToolSurfaceSnapshot,
} from "@shared/contracts";
import { ConsoleLayout } from "./components/ConsoleChrome";
import { ActivityWorkspace } from "./pages/ActivityWorkspace";
import { KeysWorkspace } from "./pages/KeysWorkspace";
import { OverviewWorkspace } from "./pages/OverviewWorkspace";
import { ProvidersWorkspace } from "./pages/ProvidersWorkspace";
import type { ProviderSaveErrors } from "./provider-actions";
import type {
  AppDataBundle,
  ProviderDraft,
  ProviderDrafts,
} from "./types";
import type { ToastTone } from "./components/Feedback";

type AppShellProps = Readonly<{
  adminAccess: AdminAccessInfo;
  dashboard: AppDataBundle["dashboard"];
  dirtyProviders: RemoteProvider[];
  isConsoleBusy: boolean;
  isRefreshing: boolean;
  onDraftChange: (provider: RemoteProvider, patch: Partial<ProviderDraft>) => void;
  onLogout: () => void;
  onRefresh: () => void;
  onSaveAdminAccess: (authKey: string) => Promise<boolean>;
  onSaveAllProviderChanges: () => void;
  onSaveMcpAccess: (bearerToken: string) => Promise<boolean>;
  onSaveSystem: () => void;
  onToast: (type: ToastTone, message: string) => void;
  providerDrafts: ProviderDrafts;
  providerSaveErrors: ProviderSaveErrors;
  providers: ProviderConfigRecord[];
  savingProviders: boolean;
  setSystem: Dispatch<SetStateAction<SystemSettings>>;
  system: SystemSettings;
  toolSurface: ToolSurfaceSnapshot;
  workspaceRefreshNonce: number;
  mcpAccess: McpAccessInfo;
}>;

export function AppShell(props: AppShellProps) {
  return (
    <Routes>
      <Route
        element={
          <ConsoleLayout
            dashboard={props.dashboard}
            providers={props.providers}
            system={props.system}
            isRefreshing={props.isConsoleBusy}
            onRefresh={props.onRefresh}
            onLogout={props.onLogout}
          />
        }
      >
        <Route index element={<Navigate replace to="/overview" />} />
        <Route
          path="/overview"
          element={
            <OverviewWorkspace
              dashboard={props.dashboard}
              loading={props.isRefreshing}
              adminAccess={props.adminAccess}
              onSaveAdminAccess={props.onSaveAdminAccess}
              mcpAccess={props.mcpAccess}
              onSaveMcpAccess={props.onSaveMcpAccess}
              onSaveSystem={props.onSaveSystem}
              onToast={props.onToast}
              setSystem={props.setSystem}
              system={props.system}
              toolSurface={props.toolSurface}
              providers={props.providers}
            />
          }
        />
        <Route
          path="/providers"
          element={
            <ProvidersWorkspace
              dirtyProviders={props.dirtyProviders}
              drafts={props.providerDrafts}
              loading={props.isRefreshing}
              onDraftChange={props.onDraftChange}
              onSaveAll={props.onSaveAllProviderChanges}
              providers={props.providers}
              saveErrors={props.providerSaveErrors}
              saving={props.savingProviders}
              system={props.system}
            />
          }
        />
        <Route
          path="/keys"
          element={
            <KeysWorkspace
              onToast={props.onToast}
              refreshNonce={props.workspaceRefreshNonce}
            />
          }
        />
        <Route path="/activity" element={<ActivityWorkspace />} />
        <Route path="*" element={<Navigate replace to="/overview" />} />
      </Route>
    </Routes>
  );
}
