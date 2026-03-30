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

export const TOOL_HIDDEN_REASONS = [
  "provider_disabled",
  "no_enabled_keys",
  "generic_provider_unavailable",
  "capability_unavailable",
] as const;

export type GenericRoutingMode = (typeof GENERIC_ROUTING_MODES)[number];
export type ToolHiddenReason = (typeof TOOL_HIDDEN_REASONS)[number];

export interface SystemSettings {
  genericRoutingMode: GenericRoutingMode;
  genericProviderOrder: Array<"tavily" | "firecrawl">;
  defaultSearchModel: string;
  logRetentionDays: number;
  allowedOrigins: string[];
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
  exposedTools: string[];
  hiddenTools: HiddenToolRecord[];
  requiresReconnect: boolean;
  behaviorChangesApplyImmediately: boolean;
  lastRefreshedAt: string;
  clientGuidance: ClientGuidance;
}
