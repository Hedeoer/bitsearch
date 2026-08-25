export const GENERIC_ROUTING_MODES = [
  "single_provider",
  "ordered_failover",
] as const;

export const GENERIC_LAYER_TOOLS = [
  "web_search",
  "get_sources",
  "web_fetch",
  "web_map",
] as const;

export const PROVIDER_LAYER_TOOLS = {
  tavily: ["tavily_crawl"],
  firecrawl: [
    "firecrawl_crawl",
    "firecrawl_crawl_status",
    "firecrawl_batch_scrape",
    "firecrawl_batch_scrape_status",
    "firecrawl_extract",
    "firecrawl_extract_status",
  ],
} as const;

export const META_LAYER_TOOLS = [
  "get_result_page",
  "get_config_info",
  "switch_model",
] as const;

export const PLANNING_LAYER_TOOLS = [
  "plan_intent",
  "plan_complexity",
  "plan_sub_query",
  "plan_search_term",
  "plan_tool_mapping",
  "plan_execution",
] as const;

export const TOOL_HIDDEN_REASONS = [
  "provider_disabled",
  "no_enabled_keys",
  "generic_provider_unavailable",
  "capability_unavailable",
  "manually_disabled",
] as const;

const PROVIDER_LAYER_TOOL_LIST = Object.values(PROVIDER_LAYER_TOOLS).flat();

export const KNOWN_MCP_TOOLS = [
  ...GENERIC_LAYER_TOOLS,
  ...PROVIDER_LAYER_TOOL_LIST,
  ...META_LAYER_TOOLS,
  ...PLANNING_LAYER_TOOLS,
] as const;

export type KnownMcpTool = (typeof KNOWN_MCP_TOOLS)[number];

export type GenericRoutingMode = (typeof GENERIC_ROUTING_MODES)[number];
export type ToolHiddenReason = (typeof TOOL_HIDDEN_REASONS)[number];

export interface SystemSettings {
  genericRoutingMode: GenericRoutingMode;
  genericProviderOrder: Array<"tavily" | "firecrawl">;
  defaultSearchModel: string;
  logRetentionDays: number;
  allowedOrigins: string[];
  disabledTools: string[];
  mcpResultBudget: {
    firstResponseChars: number;
    pageChars: number;
    hardResponseChars: number;
  };
}

export interface GenericRoutingSnapshot {
  mode: GenericRoutingMode;
  requestedProviderOrder: Array<"tavily" | "firecrawl">;
  effectiveProviderOrder: Array<"tavily" | "firecrawl">;
  affectedTools: string[];
  unaffectedTools: string[];
}

export interface HiddenToolRecord {
  tool: string;
  reason: ToolHiddenReason;
  provider: "tavily" | "firecrawl" | null;
}

export interface ProviderCapabilitySnapshot {
  provider: "tavily" | "firecrawl";
  enabled: boolean;
  enabledKeyCount: number;
  genericAvailable: boolean;
  exposedTools: string[];
  hiddenTools: HiddenToolRecord[];
}

export interface ClientGuidance {
  systemBehavior: string[];
  recommendedPrompt: string;
}

export interface ToolSurfaceSnapshot {
  genericRouting: GenericRoutingSnapshot;
  providerCapabilities: ProviderCapabilitySnapshot[];
  genericTools: string[];
  providerTools: string[];
  metaTools: string[];
  planningTools: string[];
  exposedTools: string[];
  hiddenTools: HiddenToolRecord[];
  requiresReconnect: boolean;
  behaviorChangesApplyImmediately: boolean;
  lastRefreshedAt: string;
  clientGuidance: ClientGuidance;
}
