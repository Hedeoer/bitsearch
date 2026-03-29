export const SEARCH_ENGINE_PROVIDER = "search_engine";
export const REMOTE_PROVIDERS = [SEARCH_ENGINE_PROVIDER, "tavily", "firecrawl"] as const;
export const KEY_POOL_PROVIDERS = ["tavily", "firecrawl"] as const;
export const FETCH_MODES = [
  "strict_firecrawl",
  "strict_tavily",
  "auto_ordered",
] as const;
export const REQUEST_STATUSES = ["success", "failed"] as const;
export const KEY_HEALTH_STATUSES = ["unknown", "healthy", "unhealthy"] as const;
export const KEY_LIST_STATUSES = [
  "all",
  "enabled",
  "disabled",
  "healthy",
  "unhealthy",
] as const;

export type RemoteProvider = (typeof REMOTE_PROVIDERS)[number];
export type SearchEngineProvider = typeof SEARCH_ENGINE_PROVIDER;
export type KeyPoolProvider = (typeof KEY_POOL_PROVIDERS)[number];
export type FetchMode = (typeof FETCH_MODES)[number];
export type RequestStatus = (typeof REQUEST_STATUSES)[number];
export type KeyHealthStatus = (typeof KEY_HEALTH_STATUSES)[number];
export type KeyListStatus = (typeof KEY_LIST_STATUSES)[number];

export interface TavilyKeyQuotaSnapshot {
  usage: number;
  limit: number;
  searchUsage: number;
  extractUsage: number;
  crawlUsage: number;
  mapUsage: number;
  researchUsage: number;
}

export interface TavilyAccountQuotaSnapshot {
  currentPlan: string | null;
  planUsage: number;
  planLimit: number;
  paygoUsage: number;
  paygoLimit: number;
  searchUsage: number;
  extractUsage: number;
  crawlUsage: number;
  mapUsage: number;
  researchUsage: number;
}

export interface FirecrawlTeamQuotaSnapshot {
  remainingCredits: number;
  planCredits: number;
  billingPeriodStart: string | null;
  billingPeriodEnd: string | null;
}

export interface FirecrawlHistoricalQuotaSnapshot {
  historicalCredits: number | null;
  startDate: string | null;
  endDate: string | null;
  byApiKeyMatched: boolean;
}

export interface ProviderKeyQuotaSnapshot {
  tavily?: {
    key: TavilyKeyQuotaSnapshot;
    account: TavilyAccountQuotaSnapshot | null;
  };
  firecrawl?: {
    team: FirecrawlTeamQuotaSnapshot;
    historical: FirecrawlHistoricalQuotaSnapshot | null;
  };
}

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
  maskedValue: string;
  enabled: boolean;
  tags: string[];
  note: string;
  healthStatus: KeyHealthStatus;
  lastCheckedAt: string | null;
  lastCheckError: string | null;
  lastUsedAt: string | null;
  lastError: string | null;
  lastStatusCode: number | null;
  requestCount: number;
  failureCount: number;
  quota: ProviderKeyQuotaSnapshot | null;
  quotaSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface KeyPoolSummary {
  provider: KeyPoolProvider;
  totalKeys: number;
  enabledKeys: number;
  healthyKeys: number;
  totalRequests: number;
  totalFailures: number;
  tags: string[];
  quotaSyncedAt: string | null;
  quotaNote: string | null;
  tavily: {
    totalKeyUsage: number;
    totalKeyLimit: number;
    account: TavilyAccountQuotaSnapshot | null;
  } | null;
  firecrawl: {
    team: FirecrawlTeamQuotaSnapshot | null;
    historicalByKey: boolean;
  } | null;
}

export interface ProviderErrorCount {
  provider: string;
  count: number;
}

export interface RequestRateSummary {
  rpm10m: number;
  requestCount10m: number;
}

export interface DeliveryWindowSummary {
  total: number;
  successful: number;
  failed: number;
  errorRate: number;
}

export interface DashboardTrendPoint {
  bucketStart: string;
  successCount: number;
  failedCount: number;
}

export interface DashboardSummary {
  requestRate: RequestRateSummary;
  delivery24h: DeliveryWindowSummary;
  trend24h: DashboardTrendPoint[];
  providerErrors24h: ProviderErrorCount[];
  latestErrors: RequestLogRecord[];
}

export interface SystemSettings {
  fetchMode: FetchMode;
  providerPriority: KeyPoolProvider[];
  defaultSearchModel: string;
  logRetentionDays: number;
  allowedOrigins: string[];
}

export interface SearchEngineModelsResponse {
  provider: SearchEngineProvider;
  models: string[];
}

export interface McpAccessInfo {
  streamHttpUrl: string;
  authScheme: "Bearer";
  hasBearerToken: boolean;
  tokenPreview: string | null;
}

export interface AdminAccessInfo {
  hasAuthKey: boolean;
  authKeyPreview: string | null;
}

export interface UpdateMcpAccessPayload {
  bearerToken: string;
}

export interface UpdateAdminAccessPayload {
  authKey: string;
}

export interface McpAccessSecretResponse {
  secret: string;
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
  messages: Array<{ role: string; content: string }> | null;
  providerOrder: RemoteProvider[];
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface RequestActivityRecord {
  request: RequestLogRecord;
  attempts: RequestAttemptRecord[];
}

export interface ActivityPageResult {
  items: RequestActivityRecord[];
  total: number;
  page: number;
  pageSize: number;
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
}
