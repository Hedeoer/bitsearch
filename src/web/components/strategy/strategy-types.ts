import type { Dispatch, SetStateAction } from "react";
import type {
  AdminAccessInfo,
  McpAccessInfo,
  SystemSettings,
  ToolSurfaceSnapshot,
} from "@shared/contracts";
import type { ToastTone } from "../Feedback";

export type StrategyPanelProps = Readonly<{
  loading: boolean;
  adminAccess: AdminAccessInfo;
  onSaveAdminAccess: (authKey: string) => Promise<boolean>;
  mcpAccess: McpAccessInfo;
  onSaveMcpAccess: (token: string) => Promise<boolean>;
  system: SystemSettings;
  toolSurface: ToolSurfaceSnapshot;
  onToast: (type: ToastTone, message: string) => void;
  setSystem: Dispatch<SetStateAction<SystemSettings>>;
  onSave: () => void;
}>;
