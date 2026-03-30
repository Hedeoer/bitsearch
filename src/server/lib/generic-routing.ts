import type { KeyPoolProvider } from "../../shared/contracts.js";
import type { GenericRoutingMode, SystemSettings } from "../../shared/tool-surface.js";

const DEFAULT_PROVIDER_ORDER: KeyPoolProvider[] = ["tavily", "firecrawl"];
const LEGACY_FETCH_MODES = [
  "strict_firecrawl",
  "strict_tavily",
  "auto_ordered",
] as const;

type LegacyFetchMode = (typeof LEGACY_FETCH_MODES)[number];

function dedupeProviders(order: KeyPoolProvider[]): KeyPoolProvider[] {
  return order.filter((provider, index) => order.indexOf(provider) === index);
}

export function normalizeGenericProviderOrder(
  mode: GenericRoutingMode,
  order: KeyPoolProvider[],
): KeyPoolProvider[] {
  const unique = dedupeProviders(order).filter((provider) =>
    DEFAULT_PROVIDER_ORDER.includes(provider),
  );
  if (mode === "single_provider") {
    return [unique[0] ?? DEFAULT_PROVIDER_ORDER[0]];
  }
  if (unique.length === DEFAULT_PROVIDER_ORDER.length) {
    return unique;
  }
  const fallback = DEFAULT_PROVIDER_ORDER.filter((provider) => !unique.includes(provider));
  return [...unique, ...fallback].slice(0, DEFAULT_PROVIDER_ORDER.length);
}

export function createDefaultSystemSettings(): SystemSettings {
  return {
    genericRoutingMode: "ordered_failover",
    genericProviderOrder: [...DEFAULT_PROVIDER_ORDER],
    defaultSearchModel: "grok-4-fast",
    logRetentionDays: 7,
    allowedOrigins: [],
  };
}

export function mapLegacyRoutingSettings(
  fetchMode: LegacyFetchMode | null,
  providerPriority: KeyPoolProvider[] | null,
): Pick<SystemSettings, "genericRoutingMode" | "genericProviderOrder"> {
  if (fetchMode === "strict_tavily") {
    return {
      genericRoutingMode: "single_provider",
      genericProviderOrder: ["tavily"],
    };
  }
  if (fetchMode === "strict_firecrawl") {
    return {
      genericRoutingMode: "single_provider",
      genericProviderOrder: ["firecrawl"],
    };
  }
  return {
    genericRoutingMode: "ordered_failover",
    genericProviderOrder: normalizeGenericProviderOrder(
      "ordered_failover",
      providerPriority ?? DEFAULT_PROVIDER_ORDER,
    ),
  };
}

export function resolveEffectiveGenericProviderOrder(
  settings: Pick<SystemSettings, "genericRoutingMode" | "genericProviderOrder">,
  availableProviders: KeyPoolProvider[],
): KeyPoolProvider[] {
  const requested = normalizeGenericProviderOrder(
    settings.genericRoutingMode,
    settings.genericProviderOrder,
  );
  return requested.filter((provider) => availableProviders.includes(provider));
}
