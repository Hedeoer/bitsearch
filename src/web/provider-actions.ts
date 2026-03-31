import {
  SEARCH_ENGINE_PROVIDER,
  type ProviderConfigRecord,
  type RemoteProvider,
  type SearchEngineRequestTestResponse,
  type SystemSettings,
  type ToolSurfaceSnapshot,
} from "@shared/contracts";
import { apiRequest, type ApiResult } from "./api";
import { createProviderDraft, PROVIDER_SAVE_ORDER } from "./provider-drafts";
import type { ProviderDrafts } from "./types";

export type ProviderSaveErrors = Partial<Record<RemoteProvider, string>>;

export type SaveDirtyProvidersResult = Readonly<{
  drafts: ProviderDrafts;
  errors: ProviderSaveErrors;
  providers: ProviderConfigRecord[];
  savedCount: number;
  system: SystemSettings;
  toolSurface: ToolSurfaceSnapshot | null;
}>;

function buildSearchModelSaveError(message: string): string {
  return `Provider config saved, but the default search model could not be updated: ${message}`;
}

export function revealSearchEngineApiKey(): Promise<ApiResult<{ apiKey: string }>> {
  return apiRequest<{ apiKey: string }>(
    "POST",
    `/admin/providers/${SEARCH_ENGINE_PROVIDER}/reveal-key`,
  );
}

export async function probeSearchEngineModels(
  baseUrl: string,
  timeoutMs: number,
  apiKey: string,
  useSavedApiKey: boolean,
): Promise<ApiResult<import("@shared/contracts").SearchEngineModelsResponse>> {
  return apiRequest<import("@shared/contracts").SearchEngineModelsResponse>(
    "POST",
    `/admin/providers/${SEARCH_ENGINE_PROVIDER}/models`,
    { baseUrl, timeoutMs, apiKey, useSavedApiKey },
  );
}

export async function testSearchEngineRequest(
  baseUrl: string,
  timeoutMs: number,
  apiKey: string,
  useSavedApiKey: boolean,
  model: string,
): Promise<ApiResult<SearchEngineRequestTestResponse>> {
  return apiRequest<SearchEngineRequestTestResponse>(
    "POST",
    `/admin/providers/${SEARCH_ENGINE_PROVIDER}/request-test`,
    { baseUrl, timeoutMs, apiKey, useSavedApiKey, model },
  );
}

function shouldPersistApiKey(
  draft: ProviderDrafts[typeof SEARCH_ENGINE_PROVIDER],
): boolean {
  const savedApiKeyValues = [draft.apiKeyPreview, draft.revealedApiKey].filter(Boolean);
  if (savedApiKeyValues.length === 0) {
    return draft.apiKey.trim().length > 0;
  }
  return !savedApiKeyValues.includes(draft.apiKey);
}

export function buildSearchEngineConnectionPayload(
  draft: ProviderDrafts[typeof SEARCH_ENGINE_PROVIDER],
): {
  baseUrl: string;
  timeoutMs: number;
  apiKey: string;
  useSavedApiKey: boolean;
  model: string;
} {
  const savedApiKeyValues = [draft.apiKeyPreview, draft.revealedApiKey].filter(Boolean);
  const useSavedApiKey = draft.apiKey.length > 0 && savedApiKeyValues.includes(draft.apiKey);
  return {
    baseUrl: draft.baseUrl,
    timeoutMs: draft.timeoutMs,
    apiKey: useSavedApiKey ? "" : draft.apiKey,
    useSavedApiKey,
    model: draft.searchModel,
  };
}

export async function saveDirtyProviders(input: {
  dirtyProviders: RemoteProvider[];
  drafts: ProviderDrafts;
  providers: ProviderConfigRecord[];
  system: SystemSettings;
}): Promise<SaveDirtyProvidersResult> {
  let nextProviders = input.providers;
  let nextSystem = input.system;
  const nextDrafts = { ...input.drafts };
  const errors: ProviderSaveErrors = {};
  let savedCount = 0;

  for (const provider of PROVIDER_SAVE_ORDER) {
    if (!input.dirtyProviders.includes(provider)) {
      continue;
    }
    const draft = nextDrafts[provider];
    if (!draft) {
      continue;
    }

    const providerRes = await apiRequest<ProviderConfigRecord[]>("PUT", `/admin/providers/${provider}`, {
      enabled: draft.enabled,
      baseUrl: draft.baseUrl,
      timeoutMs: draft.timeoutMs,
      ...(provider === SEARCH_ENGINE_PROVIDER
        ? { apiKey: shouldPersistApiKey(draft) ? draft.apiKey : undefined }
        : {}),
    });
    if (!providerRes.ok) {
      errors[provider] = providerRes.message;
      continue;
    }

    nextProviders = providerRes.data;
    const updatedProvider = nextProviders.find((item) => item.provider === provider);
    nextDrafts[provider] = {
      ...(updatedProvider ? createProviderDraft(updatedProvider, nextSystem) : draft),
    };
    savedCount += 1;

    if (provider !== SEARCH_ENGINE_PROVIDER) {
      continue;
    }

    const systemRes = await apiRequest<SystemSettings>("PUT", "/admin/system", {
      ...nextSystem,
      defaultSearchModel: draft.searchModel,
    });
    if (!systemRes.ok) {
      errors[provider] = buildSearchModelSaveError(systemRes.message);
      continue;
    }
    nextSystem = systemRes.data;
    if (updatedProvider) {
      nextDrafts[provider] = createProviderDraft(updatedProvider, nextSystem);
    }
  }

  const toolSurfaceRes = savedCount
    ? await apiRequest<ToolSurfaceSnapshot>("GET", "/admin/tool-surface")
    : null;

  return {
    drafts: nextDrafts,
    errors,
    providers: nextProviders,
    savedCount,
    system: nextSystem,
    toolSurface: toolSurfaceRes?.ok ? toolSurfaceRes.data : null,
  };
}
