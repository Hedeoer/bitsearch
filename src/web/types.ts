import type {
  AdminProfile,
  DashboardSummary,
  ProviderConfigRecord,
  ProviderKeyRecord,
  RequestActivityRecord,
  SystemSettings,
} from "@shared/contracts";

export type SessionState = {
  loggedIn: boolean;
  username: string | null;
};

export type ProviderDraft = {
  enabled: boolean;
  baseUrl: string;
  timeoutMs: number;
  apiKey: string;
};

export type ProviderDrafts = Record<string, ProviderDraft>;

export type AppDataBundle = {
  profile: AdminProfile | null;
  dashboard: DashboardSummary | null;
  providers: ProviderConfigRecord[];
  keys: ProviderKeyRecord[];
  system: SystemSettings;
  activity: RequestActivityRecord[];
};
