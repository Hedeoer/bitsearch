export {
  GENERIC_LAYER_TOOLS,
  GENERIC_ROUTING_MODES,
  PROVIDER_LAYER_TOOLS,
  TOOL_HIDDEN_REASONS,
} from "./tool-surface.js";
export type {
  ClientGuidance,
  GenericRoutingMode,
  GenericRoutingSnapshot,
  HiddenToolRecord,
  ProviderCapabilitySnapshot,
  SystemSettings,
  ToolHiddenReason,
  ToolSurfaceSnapshot,
} from "./tool-surface.js";

export const SEARCH_ENGINE_PROVIDER = "search_engine";
export const REMOTE_PROVIDERS = [SEARCH_ENGINE_PROVIDER, "tavily", "firecrawl"] as const;
export const KEY_POOL_PROVIDERS = ["tavily", "firecrawl"] as const;
export const REQUEST_STATUSES = ["success", "failed"] as const;
export const ACTIVITY_TIME_PRESETS = [
  "all",
  "today",
  "last_hour",
  "last_24_hours",
  "custom",
] as const;
export const ACTIVITY_SORT_FIELDS = [
  "created_at",
  "duration_ms",
  "attempts",
] as const;
export const ACTIVITY_SORT_DIRECTIONS = ["asc", "desc"] as const;
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
export type RequestStatus = (typeof REQUEST_STATUSES)[number];
export type ActivityTimePreset = (typeof ACTIVITY_TIME_PRESETS)[number];
export type ActivitySortField = (typeof ACTIVITY_SORT_FIELDS)[number];
export type ActivitySortDirection = (typeof ACTIVITY_SORT_DIRECTIONS)[number];
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

export interface TavilyCrawlPage {
  url: string;
  rawContent: string | null;
  favicon: string | null;
}

export interface TavilyCrawlResult {
  baseUrl: string;
  results: TavilyCrawlPage[];
  responseTime: number | null;
  usage: Record<string, unknown> | null;
  requestId: string | null;
}

export interface FirecrawlAsyncSubmitResult {
  success: boolean;
  id: string;
  url: string | null;
  invalidUrls: string[] | null;
}

export interface FirecrawlCrawlStatusResult {
  status: string;
  total: number | null;
  completed: number | null;
  creditsUsed: number | null;
  expiresAt: string | null;
  next: string | null;
  data: Array<Record<string, unknown>>;
}

export interface FirecrawlBatchScrapeStatusResult {
  status: string;
  total: number | null;
  completed: number | null;
  creditsUsed: number | null;
  expiresAt: string | null;
  next: string | null;
  data: Array<Record<string, unknown>>;
}

export interface FirecrawlExtractResult {
  success: boolean;
  data: unknown;
  status: string;
  expiresAt: string | null;
  tokensUsed: number | null;
}

export interface ProviderConfigRecord {
  provider: RemoteProvider;
  enabled: boolean;
  baseUrl: string;
  timeoutMs: number;
  hasApiKey: boolean;
  apiKeyPreview: string | null;
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

export interface SearchEngineModelsResponse {
  provider: SearchEngineProvider;
  models: string[];
}

export interface SearchEngineModelProbeResult {
  status: RequestStatus;
  modelsCount: number | null;
  modelListed: boolean | null;
  message: string | null;
}

export interface SearchEngineRequestTestResponse {
  provider: SearchEngineProvider;
  status: RequestStatus;
  model: string;
  durationMs: number;
  responsePreview: string | null;
  statusCode: number | null;
  error: string | null;
  modelProbe: SearchEngineModelProbeResult;
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

export interface ActivityQuery {
  page: number;
  pageSize: number;
  q?: string;
  toolName?: string;
  status?: RequestStatus;
  provider?: RemoteProvider;
  errorType?: string;
  timePreset?: ActivityTimePreset;
  customStart?: string;
  customEnd?: string;
  minDurationMs?: number;
  maxDurationMs?: number;
  onlySlow?: boolean;
  onlyFallback?: boolean;
  sortBy: ActivitySortField;
  sortDir: ActivitySortDirection;
}

export interface ActivityListItem {
  id: string;
  toolName: string;
  targetUrl: string | null;
  finalProvider: RemoteProvider | null;
  attempts: number;
  status: RequestStatus;
  durationMs: number;
  errorSummary: string | null;
  resultPreview: string | null;
  primaryErrorType: string | null;
  providerOrder: RemoteProvider[];
  hasMessages: boolean;
  isSlow: boolean;
  isFallback: boolean;
  createdAt: string;
}

export interface ActivityListPageResult {
  items: ActivityListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ActivityFacetOption {
  value: string;
  count: number;
}

export interface ActivityStatusCounts {
  success: number;
  failed: number;
}

export interface ActivityTimeBounds {
  oldestCreatedAt: string | null;
  newestCreatedAt: string | null;
}

export interface ActivityFacets {
  tools: ActivityFacetOption[];
  providers: ActivityFacetOption[];
  errorTypes: ActivityFacetOption[];
  statuses: ActivityStatusCounts;
  timeBounds: ActivityTimeBounds;
}

export interface ActivityMetricCount {
  value: string;
  count: number;
}

export interface ActivitySummary {
  totalRequests: number;
  failedRequests: number;
  failureRate: number;
  p50DurationMs: number | null;
  p95DurationMs: number | null;
  avgAttempts: number;
  slowRequests: number;
  topTools: ActivityMetricCount[];
  topProviders: ActivityMetricCount[];
  topFailedProviders: ActivityMetricCount[];
}

export interface ActivityDiagnostics {
  primaryErrorType: string | null;
  isSlow: boolean;
  isFallback: boolean;
  retryChainLabel: string;
  failureStageHint: string | null;
}

export interface ActivityDetailRecord {
  request: RequestLogRecord;
  attempts: RequestAttemptRecord[];
  messages: Array<{ role: string; content: string }> | null;
  diagnostics: ActivityDiagnostics;
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
