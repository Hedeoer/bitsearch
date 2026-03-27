export const REMOTE_PROVIDERS = ["grok", "tavily", "firecrawl"] as const;
export const KEY_POOL_PROVIDERS = ["tavily", "firecrawl"] as const;
export const FETCH_MODES = [
  "strict_firecrawl",
  "strict_tavily",
  "auto_ordered",
] as const;
export const REQUEST_STATUSES = ["success", "failed"] as const;

export type RemoteProvider = (typeof REMOTE_PROVIDERS)[number];
export type KeyPoolProvider = (typeof KEY_POOL_PROVIDERS)[number];
export type FetchMode = (typeof FETCH_MODES)[number];
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export interface ProviderConfigRecord {
  provider: RemoteProvider;
  enabled: boolean;
  baseUrl: string;
  timeoutMs: number;
  hasApiKey: boolean;
  keyCount: number;
  updatedAt: string;
}

export interface ProviderKeyRecord {
  id: string;
  provider: KeyPoolProvider;
  name: string;
  fingerprint: string;
  enabled: boolean;
  tags: string[];
  lastUsedAt: string | null;
  lastError: string | null;
  lastStatusCode: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardSummary {
  totalRequests: number;
  successCount: number;
  failedCount: number;
  providerErrors: Array<{ provider: string; count: number }>;
  latestErrors: RequestLogRecord[];
}

export interface AdminProfile {
  username: string;
  createdAt: string;
  passwordUpdatedAt: string | null;
}

export interface SystemSettings {
  fetchMode: FetchMode;
  providerPriority: KeyPoolProvider[];
  defaultGrokModel: string;
  logRetentionDays: number;
  allowedOrigins: string[];
}

export interface RequestAttemptRecord {
  id: string;
  requestLogId: string;
  provider: RemoteProvider;
  keyFingerprint: string | null;
  attemptNo: number;
  status: RequestStatus;
  statusCode: number | null;
  durationMs: number;
  errorSummary: string | null;
  errorType: string | null;
  providerBaseUrl: string | null;
  createdAt: string;
}

export interface RequestLogRecord {
  id: string;
  toolName: string;
  targetUrl: string | null;
  strategy: string | null;
  finalProvider: string | null;
  finalKeyFingerprint: string | null;
  attempts: number;
  status: RequestStatus;
  durationMs: number;
  errorSummary: string | null;
  inputJson: Record<string, unknown> | null;
  resultPreview: string | null;
  providerOrder: RemoteProvider[];
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface RequestActivityRecord {
  request: RequestLogRecord;
  attempts: RequestAttemptRecord[];
}

export interface SearchSessionRecord {
  id: string;
  content: string;
  sources: Array<Record<string, unknown>>;
  sourcesCount: number;
  createdAt: string;
}

export interface AdminSessionPayload {
  loggedIn: boolean;
  username: string | null;
}
