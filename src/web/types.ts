import type {
  ActivityListPageResult,
  DashboardSummary,
  ProviderConfigRecord,
  ProviderKeyRecord,
  SystemSettings,
  ToolSurfaceSnapshot,
} from "@shared/contracts";

export type SessionState = {
  loggedIn: boolean;
};

export type ProviderDraft = {
  enabled: boolean;
  baseUrl: string;
  timeoutMs: number;
  apiKey: string;
  searchModel: string;
};

export type ProviderDrafts = Record<string, ProviderDraft>;

export type KeySortMode =
  | "requests_desc"
  | "requests_asc"
  | "failures_desc"
  | "last_used_desc"
  | "quota_remaining_desc";

export type AppDataBundle = {
  dashboard: DashboardSummary | null;
  providers: ProviderConfigRecord[];
  keys: ProviderKeyRecord[];
  system: SystemSettings;
  toolSurface: ToolSurfaceSnapshot;
  activity: ActivityListPageResult | null;
};
