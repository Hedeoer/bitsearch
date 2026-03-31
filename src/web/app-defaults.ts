import type {
  AdminAccessInfo,
  McpAccessInfo,
  SystemSettings,
  ToolSurfaceSnapshot,
} from "@shared/contracts";

export const EMPTY_SYSTEM: SystemSettings = {
  genericRoutingMode: "ordered_failover",
  genericProviderOrder: ["tavily", "firecrawl"],
  defaultSearchModel: "grok-4-fast",
  logRetentionDays: 7,
  allowedOrigins: [],
};

export const EMPTY_MCP_ACCESS: McpAccessInfo = {
  streamHttpUrl: "",
  authScheme: "Bearer",
  hasBearerToken: false,
  tokenPreview: null,
};

export const EMPTY_TOOL_SURFACE: ToolSurfaceSnapshot = {
  genericRouting: {
    mode: "ordered_failover",
    requestedProviderOrder: ["tavily", "firecrawl"],
    effectiveProviderOrder: [],
    affectedTools: ["web_fetch", "web_map", "web_search.extra_sources"],
    unaffectedTools: [],
  },
  providerCapabilities: [],
  genericTools: ["web_search", "get_sources"],
  providerTools: [],
  exposedTools: ["web_search", "get_sources"],
  hiddenTools: [],
  requiresReconnect: true,
  behaviorChangesApplyImmediately: true,
  lastRefreshedAt: "",
  clientGuidance: {
    systemBehavior: [],
    recommendedPrompt: "",
  },
};

export const EMPTY_ADMIN_ACCESS: AdminAccessInfo = {
  hasAuthKey: false,
  authKeyPreview: null,
};
