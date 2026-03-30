import {
  GENERIC_LAYER_TOOLS,
  KEY_POOL_PROVIDERS,
  PROVIDER_LAYER_TOOLS,
  type ClientGuidance,
  type GenericRoutingSnapshot,
  type HiddenToolRecord,
  type KeyPoolProvider,
  type ProviderCapabilitySnapshot,
  type ToolSurfaceSnapshot,
} from "../../shared/contracts.js";
import type { AppContext } from "../app-context.js";
import {
  normalizeGenericProviderOrder,
  resolveEffectiveGenericProviderOrder,
} from "../lib/generic-routing.js";
import { getCandidateKeys, getProviderConfig } from "../repos/provider-repo.js";
import { getSystemSettings } from "../repos/settings-repo.js";

const GENERIC_ROUTED_TOOLS = ["web_fetch", "web_map"];

function getProviderHiddenReason(
  enabled: boolean,
  enabledKeyCount: number,
): HiddenToolRecord["reason"] {
  if (!enabled) {
    return "provider_disabled";
  }
  if (enabledKeyCount === 0) {
    return "no_enabled_keys";
  }
  return "capability_unavailable";
}

function createProviderSnapshot(
  context: AppContext,
  provider: KeyPoolProvider,
): ProviderCapabilitySnapshot {
  const config = getProviderConfig(context.db, provider);
  const enabled = Boolean(config?.enabled);
  const enabledKeyCount = enabled
    ? getCandidateKeys(context.db, provider, context.bootstrap.encryptionKey).length
    : 0;
  const genericAvailable = enabled && enabledKeyCount > 0;
  const nativeTools = [...PROVIDER_LAYER_TOOLS[provider]];
  const hiddenReason = getProviderHiddenReason(enabled, enabledKeyCount);

  return {
    provider,
    enabled,
    enabledKeyCount,
    genericAvailable,
    exposedTools: genericAvailable ? nativeTools : [],
    hiddenTools: genericAvailable
      ? []
      : nativeTools.map((tool) => ({
          tool,
          reason: hiddenReason,
          provider,
        })),
  };
}

function createClientGuidance(snapshot: ToolSurfaceSnapshot): ClientGuidance {
  const behavior = [
    `Generic routing uses ${snapshot.genericRouting.mode} with ${snapshot.genericRouting.effectiveProviderOrder.join(" -> ") || "no available providers"}.`,
    "web_fetch and web_map follow generic routing only.",
    "Provider-native tools never participate in generic routing.",
  ];

  const promptLines = [
    "Use web_search for open-web discovery and get_sources when source listing is needed.",
  ];
  if (snapshot.genericTools.includes("web_fetch")) {
    promptLines.push("Use web_fetch for a single known page when plain content is needed.");
  }
  if (snapshot.genericTools.includes("web_map")) {
    promptLines.push("Use web_map only for URL discovery, not for full content retrieval.");
  }
  if (snapshot.providerTools.includes("tavily_crawl")) {
    promptLines.push("Use tavily_crawl for synchronous site traversal when page content from one site is needed in one call.");
  }
  if (snapshot.providerTools.includes("firecrawl_batch_scrape")) {
    promptLines.push("Use firecrawl_batch_scrape for scraping multiple known URLs in parallel.");
  }
  if (snapshot.providerTools.includes("firecrawl_extract")) {
    promptLines.push("Use firecrawl_extract for structured extraction and always poll firecrawl_extract_status until terminal.");
  }
  if (snapshot.providerTools.includes("firecrawl_crawl")) {
    promptLines.push("Use firecrawl_crawl for deep asynchronous crawling and always poll firecrawl_crawl_status.");
  }
  promptLines.push("Do not assume provider-native tools follow generic routing.");

  return {
    systemBehavior: behavior,
    recommendedPrompt: promptLines.join("\n"),
  };
}

export function getCurrentGenericRoutingSnapshot(
  context: AppContext,
): GenericRoutingSnapshot {
  const settings = getSystemSettings(context.db);
  const providerCapabilities = KEY_POOL_PROVIDERS.map((provider) =>
    createProviderSnapshot(context, provider),
  );
  const requestedProviderOrder = normalizeGenericProviderOrder(
    settings.genericRoutingMode,
    settings.genericProviderOrder,
  );
  const effectiveProviderOrder = resolveEffectiveGenericProviderOrder(
    settings,
    providerCapabilities
      .filter((item) => item.genericAvailable)
      .map((item) => item.provider),
  );

  return {
    mode: settings.genericRoutingMode,
    requestedProviderOrder,
    effectiveProviderOrder,
    affectedTools: ["web_fetch", "web_map", "web_search.extra_sources"],
    unaffectedTools: Object.values(PROVIDER_LAYER_TOOLS).flat(),
  };
}

export function getToolSurfaceSnapshot(context: AppContext): ToolSurfaceSnapshot {
  const genericRouting = getCurrentGenericRoutingSnapshot(context);
  const providerCapabilities = KEY_POOL_PROVIDERS.map((provider) =>
    createProviderSnapshot(context, provider),
  );

  const hiddenGenericTools: HiddenToolRecord[] =
    genericRouting.effectiveProviderOrder.length > 0
      ? []
      : GENERIC_ROUTED_TOOLS.map((tool) => ({
          tool,
          reason: "generic_provider_unavailable",
          provider: null,
        }));

  const genericTools = [
    "web_search",
    "get_sources",
    ...(genericRouting.effectiveProviderOrder.length > 0 ? GENERIC_ROUTED_TOOLS : []),
  ];
  const providerTools = providerCapabilities.flatMap((item) => item.exposedTools);

  const snapshot: ToolSurfaceSnapshot = {
    genericRouting,
    providerCapabilities,
    genericTools,
    providerTools,
    exposedTools: [...genericTools, ...providerTools],
    hiddenTools: [
      ...hiddenGenericTools,
      ...providerCapabilities.flatMap((item) => item.hiddenTools),
    ],
    requiresReconnect: true,
    behaviorChangesApplyImmediately: true,
    lastRefreshedAt: new Date().toISOString(),
    clientGuidance: { systemBehavior: [], recommendedPrompt: "" },
  };

  snapshot.clientGuidance = createClientGuidance(snapshot);
  return snapshot;
}

export function shouldExposeTool(
  snapshot: ToolSurfaceSnapshot,
  tool: (typeof GENERIC_LAYER_TOOLS)[number] | string,
): boolean {
  return snapshot.exposedTools.includes(tool);
}

export function hasToolSurfaceChanged(
  before: ToolSurfaceSnapshot,
  after: ToolSurfaceSnapshot,
): boolean {
  if (before.exposedTools.length !== after.exposedTools.length) {
    return true;
  }
  const beforeTools = [...before.exposedTools].sort();
  const afterTools = [...after.exposedTools].sort();
  return beforeTools.some((tool, index) => tool !== afterTools[index]);
}
