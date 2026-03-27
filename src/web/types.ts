import type {
  DashboardSummary,
  ProviderConfigRecord,
  ProviderKeyRecord,
  SystemSettings,
} from "@shared/contracts";

export type SessionState = {
  loggedIn: boolean;
  username: string | null;
};

export type AttemptLog = Record<string, unknown>;

export type ProviderDraft = {
  enabled: boolean;
  baseUrl: string;
  timeoutMs: number;
  apiKey: string;
};

export type ProviderDrafts = Record<string, ProviderDraft>;

export type AppDataBundle = {
  dashboard: DashboardSummary | null;
  providers: ProviderConfigRecord[];
  keys: ProviderKeyRecord[];
  system: SystemSettings;
  logs: Array<Record<string, unknown>>;
  attempts: AttemptLog[];
};
