import { SEARCH_ENGINE_PROVIDER } from "../../shared/contracts.js";
import type { SearchEngineRequestTestResponse } from "../../shared/contracts.js";
import type { SearchEngineApiFormat } from "../../shared/contracts.js";
import type { AppContext } from "../app-context.js";
import { getProviderApiKey, getProviderConfig } from "../repos/provider-repo.js";
import { getSystemSettings } from "../repos/settings-repo.js";
import {
  buildSearchMessages,
  listSearchEngineModels,
  searchWithSearchEngine,
  type SearchEngineClientConfig,
} from "../providers/search-engine-client.js";
import { HttpRequestError } from "../lib/http.js";

const SEARCH_ENGINE_TEST_QUERY =
  "What is today's UTC date? Answer in one short sentence. If web access is available, include one source link.";
const EMPTY_SEARCH_RESPONSE_ERROR = "search_engine returned an empty response";

interface SearchEngineConfigOverrides {
  apiKey?: string;
  baseUrl?: string;
  apiFormat?: SearchEngineApiFormat;
  model?: string;
  timeoutMs?: number;
}

export function requireSearchEngineConfig(
  context: AppContext,
  overrides: SearchEngineConfigOverrides = {},
): SearchEngineClientConfig {
  const providerConfig = getProviderConfig(context.db, SEARCH_ENGINE_PROVIDER);
  const savedApiKey = getProviderApiKey(
    context.db,
    SEARCH_ENGINE_PROVIDER,
    context.bootstrap.encryptionKey,
  );
  const settings = getSystemSettings(context.db);
  const baseUrl = overrides.baseUrl || providerConfig?.baseUrl || "";
  const apiKey = overrides.apiKey || savedApiKey || "";
  if (!baseUrl || !apiKey) {
    throw new Error("Configuration error: search_engine is not fully configured");
  }
  return {
    apiUrl: baseUrl,
    apiKey,
    apiFormat: overrides.apiFormat ?? providerConfig?.apiFormat ?? "openai_chat_completions",
    model: overrides.model || settings.defaultSearchModel,
    timeoutMs: overrides.timeoutMs ?? providerConfig?.timeoutMs ?? 30000,
  };
}

export async function listAvailableSearchEngineModels(
  context: AppContext,
  overrides: SearchEngineConfigOverrides = {},
): Promise<string[]> {
  return listSearchEngineModels(requireSearchEngineConfig(context, overrides));
}

function getSavedSearchEngineApiKey(context: AppContext): string {
  const savedApiKey = getProviderApiKey(
    context.db,
    SEARCH_ENGINE_PROVIDER,
    context.bootstrap.encryptionKey,
  );
  if (!savedApiKey) {
    throw new Error("Configuration error: search_engine API key is not configured");
  }
  return savedApiKey;
}

function buildDraftSearchEngineConfig(
  context: AppContext,
  input: {
    baseUrl: string;
    timeoutMs: number;
    apiFormat: SearchEngineApiFormat;
    apiKey: string;
    useSavedApiKey: boolean;
    model?: string;
  },
): SearchEngineClientConfig {
  const apiKey = input.useSavedApiKey ? getSavedSearchEngineApiKey(context) : input.apiKey;
  if (!apiKey) {
    throw new Error("Configuration error: search_engine API key is not configured");
  }
  return {
    apiUrl: input.baseUrl,
    apiKey,
    apiFormat: input.apiFormat,
    model: input.model || getSystemSettings(context.db).defaultSearchModel,
    timeoutMs: input.timeoutMs,
  };
}

function getErrorDetails(error: unknown): {
  message: string;
  statusCode: number | null;
} {
  if (error instanceof HttpRequestError) {
    return {
      message: error.message || "search_engine_request_failed",
      statusCode: error.statusCode,
    };
  }
  return {
    message: error instanceof Error ? error.message : "search_engine_request_failed",
    statusCode: null,
  };
}

function buildModelProbeResult(
  inputModel: string,
  result: PromiseSettledResult<string[]>,
): SearchEngineRequestTestResponse["modelProbe"] {
  if (result.status === "rejected") {
    return {
      status: "failed",
      probeMode: "models_endpoint",
      modelsCount: null,
      modelListed: null,
      message: getErrorDetails(result.reason).message,
    };
  }
  return {
    status: "success",
    probeMode: "models_endpoint",
    modelsCount: result.value.length,
    modelListed: result.value.includes(inputModel),
    message: result.value.includes(inputModel)
      ? "Model appears in /models."
      : "Model was not returned by /models.",
  };
}

function buildRequestTestResult(
  input: { model: string },
  apiFormat: SearchEngineApiFormat,
  startedAt: number,
  modelProbe: SearchEngineRequestTestResponse["modelProbe"],
  payload: {
    error: string | null;
    responsePreview: string | null;
    status: SearchEngineRequestTestResponse["status"];
    statusCode: number | null;
  },
): SearchEngineRequestTestResponse {
  return {
    provider: SEARCH_ENGINE_PROVIDER,
    apiFormat,
    status: payload.status,
    model: input.model,
    durationMs: Date.now() - startedAt,
    responsePreview: payload.responsePreview,
    statusCode: payload.statusCode,
    error: payload.error,
    modelProbe,
  };
}

export async function runSearchEngineRequestTest(
  context: AppContext,
  input: {
    baseUrl: string;
    timeoutMs: number;
    apiFormat: SearchEngineApiFormat;
    apiKey: string;
    useSavedApiKey: boolean;
    model: string;
  },
): Promise<SearchEngineRequestTestResponse> {
  const startedAt = Date.now();
  const config = buildDraftSearchEngineConfig(context, input);
  const [modelProbeResult, requestResult] = await Promise.allSettled([
    listSearchEngineModels(config),
    searchWithSearchEngine(config, buildSearchMessages(SEARCH_ENGINE_TEST_QUERY, "")),
  ]);
  const modelProbe = buildModelProbeResult(
    input.model,
    modelProbeResult,
  );

  if (requestResult.status === "rejected") {
    const errorDetails = getErrorDetails(requestResult.reason);
    return buildRequestTestResult(input, input.apiFormat, startedAt, modelProbe, {
      status: "failed",
      responsePreview: null,
      statusCode: errorDetails.statusCode,
      error: errorDetails.message,
    });
  }

  const responseText = requestResult.value.trim();
  if (!responseText) {
    return buildRequestTestResult(input, input.apiFormat, startedAt, modelProbe, {
      status: "failed",
      responsePreview: null,
      statusCode: null,
      error: EMPTY_SEARCH_RESPONSE_ERROR,
    });
  }

  return buildRequestTestResult(input, input.apiFormat, startedAt, modelProbe, {
    status: "success",
    responsePreview: responseText.slice(0, 280),
    statusCode: null,
    error: null,
  });
}
