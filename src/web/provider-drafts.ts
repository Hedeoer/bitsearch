import {
  REMOTE_PROVIDERS,
  SEARCH_ENGINE_PROVIDER,
  type ProviderConfigRecord,
  type RemoteProvider,
  type SystemSettings,
} from "@shared/contracts";
import type { ProviderDraft, ProviderDrafts } from "./types";

export const PROVIDER_SAVE_ORDER: RemoteProvider[] = [...REMOTE_PROVIDERS];

export function createProviderDraft(
  provider: ProviderConfigRecord,
  system: SystemSettings,
): ProviderDraft {
  return {
    enabled: provider.enabled,
    baseUrl: provider.baseUrl,
    timeoutMs: provider.timeoutMs,
    apiKey: provider.apiKeyPreview ?? "",
    apiKeyPreview: provider.apiKeyPreview ?? "",
    revealedApiKey: "",
    apiFormat: provider.apiFormat ?? "openai_chat_completions",
    searchModel: provider.provider === SEARCH_ENGINE_PROVIDER ? system.defaultSearchModel : "",
  };
}

export function createProviderDrafts(
  providers: ProviderConfigRecord[],
  system: SystemSettings,
): ProviderDrafts {
  return Object.fromEntries(
    providers.map((provider) => [provider.provider, createProviderDraft(provider, system)]),
  );
}

export function getProviderDraft(
  provider: ProviderConfigRecord,
  drafts: ProviderDrafts,
  system: SystemSettings,
): ProviderDraft {
  return drafts[provider.provider] ?? createProviderDraft(provider, system);
}

export function isProviderDirty(
  provider: ProviderConfigRecord,
  draft: ProviderDraft,
  system: SystemSettings,
): boolean {
  if (provider.enabled !== draft.enabled) {
    return true;
  }
  if (provider.baseUrl !== draft.baseUrl) {
    return true;
  }
  if (provider.timeoutMs !== draft.timeoutMs) {
    return true;
  }
  if (
    provider.provider === SEARCH_ENGINE_PROVIDER &&
    draft.apiFormat !== (provider.apiFormat ?? "openai_chat_completions")
  ) {
    return true;
  }
  const savedApiKeyValues = [draft.apiKeyPreview, draft.revealedApiKey].filter(Boolean);
  if (savedApiKeyValues.length === 0) {
    if (draft.apiKey.trim().length > 0) {
      return true;
    }
  } else if (!savedApiKeyValues.includes(draft.apiKey)) {
    return true;
  }
  if (
    provider.provider === SEARCH_ENGINE_PROVIDER &&
    draft.searchModel.trim() !== system.defaultSearchModel.trim()
  ) {
    return true;
  }
  return false;
}

export function listDirtyProviders(
  providers: ProviderConfigRecord[],
  drafts: ProviderDrafts,
  system: SystemSettings,
): RemoteProvider[] {
  return providers
    .filter((provider) => isProviderDirty(provider, getProviderDraft(provider, drafts, system), system))
    .map((provider) => provider.provider);
}
