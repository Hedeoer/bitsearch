import { SEARCH_ENGINE_PROVIDER } from "../../shared/contracts.js";
import type { AppContext } from "../app-context.js";
import { getProviderApiKey, getProviderConfig } from "../repos/provider-repo.js";
import { getSystemSettings } from "../repos/settings-repo.js";
import {
  listSearchEngineModels,
  type SearchEngineClientConfig,
} from "../providers/search-engine-client.js";

export function requireSearchEngineConfig(
  context: AppContext,
  overrideModel = "",
): SearchEngineClientConfig {
  const providerConfig = getProviderConfig(context.db, SEARCH_ENGINE_PROVIDER);
  const apiKey = getProviderApiKey(
    context.db,
    SEARCH_ENGINE_PROVIDER,
    context.bootstrap.encryptionKey,
  );
  const settings = getSystemSettings(context.db);
  if (!providerConfig?.baseUrl || !apiKey) {
    throw new Error("配置错误: Search engine provider 未完整配置");
  }
  return {
    apiUrl: providerConfig.baseUrl,
    apiKey,
    model: overrideModel || settings.defaultSearchModel,
    timeoutMs: providerConfig.timeoutMs,
  };
}

export async function listAvailableSearchEngineModels(
  context: AppContext,
): Promise<string[]> {
  return listSearchEngineModels(requireSearchEngineConfig(context));
}
