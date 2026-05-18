import { generateText, streamText } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { requestJson } from "../lib/http.js";
import type { SearchEngineApiFormat } from "../../shared/contracts.js";

const SEARCH_PROMPT = [
  "Search the web broadly and answer with evidence.",
  "Use current information when the query is time-sensitive.",
  "At the end, include a source section with markdown links when available.",
].join(" ");

const ANTHROPIC_API_VERSION = "2023-06-01";

interface OpenAIModelListResponse {
  data?: Array<{ id?: string }>;
}

interface AnthropicModelListResponse {
  data?: Array<{ id?: string }>;
}

interface GoogleModelListResponse {
  models?: Array<{ name?: string }>;
  nextPageToken?: string;
}

interface UpstreamErrorLike {
  cause?: unknown;
  message?: string;
  name?: string;
  responseBody?: string;
  statusCode?: number;
}

export interface SearchEngineMessage {
  role: "system" | "user";
  content: string;
}

export interface SearchEngineClientConfig {
  apiUrl: string;
  apiKey: string;
  model: string;
  apiFormat: SearchEngineApiFormat;
  timeoutMs: number;
}

function needsTimeContext(query: string): boolean {
  const keywords = [
    "current",
    "now",
    "today",
    "latest",
    "recent",
    "今天",
    "当前",
    "最新",
    "最近",
  ];
  const lower = query.toLowerCase();
  return keywords.some((item) => lower.includes(item.toLowerCase()));
}

function buildUserPrompt(query: string, platform: string): string {
  const timeContext = needsTimeContext(query)
    ? `Current time: ${new Date().toISOString()}\n`
    : "";
  const platformContext = platform ? `Focus on: ${platform}\n` : "";
  return `${timeContext}${platformContext}${query}`;
}

export function buildSearchMessages(
  query: string,
  platform: string,
): SearchEngineMessage[] {
  return [
    {
      role: "system",
      content: SEARCH_PROMPT,
    },
    {
      role: "user",
      content: buildUserPrompt(query, platform),
    },
  ];
}

function trimApiUrl(url: string): string {
  return url.replace(/\/$/, "");
}

function hasVersionSegment(url: string): boolean {
  return /\/v\d+([a-z0-9.-]*)$/i.test(url);
}

function createAbortSignal(timeoutMs: number): AbortSignal {
  return AbortSignal.timeout(Math.max(timeoutMs, 120_000));
}

function uniqueModels(models: string[]): string[] {
  return [...new Set(models.map((item) => item.trim()).filter(Boolean))].sort();
}

function getSystemPrompt(messages: SearchEngineMessage[]): string {
  return messages.find((message) => message.role === "system")?.content ?? "";
}

function getPrompt(messages: SearchEngineMessage[]): string {
  return messages
    .filter((message) => message.role === "user")
    .map((message) => message.content)
    .join("\n")
    .trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function getUpstreamErrorLike(error: unknown): UpstreamErrorLike {
  if (!isRecord(error)) {
    return {};
  }
  return {
    cause: error.cause,
    message: typeof error.message === "string" ? error.message : undefined,
    name: typeof error.name === "string" ? error.name : undefined,
    responseBody: typeof error.responseBody === "string" ? error.responseBody : undefined,
    statusCode: typeof error.statusCode === "number" ? error.statusCode : undefined,
  };
}

function collectErrorDetails(error: unknown): {
  message: string;
  responseBody: string;
  statusCode: number | null;
} {
  const current = getUpstreamErrorLike(error);
  const cause = current.cause ? collectErrorDetails(current.cause) : null;
  return {
    message: [current.name, current.message, cause?.message].filter(Boolean).join(" "),
    responseBody: [current.responseBody, cause?.responseBody].filter(Boolean).join(" "),
    statusCode: current.statusCode ?? cause?.statusCode ?? null,
  };
}

function isStreamCompatibilityError(error: unknown): boolean {
  const details = collectErrorDetails(error);
  if (details.statusCode === null || ![400, 404, 405].includes(details.statusCode)) {
    return false;
  }

  const text = `${details.message} ${details.responseBody}`.toLowerCase();
  if (!text.includes("stream")) {
    return false;
  }

  return [
    "not support",
    "not supported",
    "unsupported",
    "not allowed",
    "stream_options",
    "unknown parameter",
    "unrecognized",
    "invalid parameter",
  ].some((indicator) => text.includes(indicator));
}

async function listOpenAIModels(config: SearchEngineClientConfig): Promise<string[]> {
  const data = await requestJson<OpenAIModelListResponse>(
    `${buildOpenAIApiBaseUrl(config.apiUrl)}/models`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
      },
      timeoutMs: Math.min(config.timeoutMs, 10_000),
    },
  );
  return uniqueModels((data.data ?? []).flatMap((item) => (item.id ? [item.id] : [])));
}

async function listAnthropicModels(config: SearchEngineClientConfig): Promise<string[]> {
  const data = await requestJson<AnthropicModelListResponse>(
    buildAnthropicModelsUrl(config.apiUrl),
    {
      method: "GET",
      headers: {
        "Anthropic-Version": ANTHROPIC_API_VERSION,
        "X-Api-Key": config.apiKey,
      },
      timeoutMs: Math.min(config.timeoutMs, 10_000),
    },
  );
  return uniqueModels((data.data ?? []).flatMap((item) => (item.id ? [item.id] : [])));
}

async function listGoogleModels(config: SearchEngineClientConfig): Promise<string[]> {
  const models: string[] = [];
  let pageToken = "";

  for (let index = 0; index < 50; index += 1) {
    const response = await requestJson<GoogleModelListResponse>(
      buildGoogleModelsUrl(config.apiUrl, pageToken),
      {
        method: "GET",
        headers: {
          "X-Goog-Api-Key": config.apiKey,
        },
        timeoutMs: Math.min(config.timeoutMs, 10_000),
      },
    );

    for (const model of response.models ?? []) {
      if (model.name) {
        models.push(model.name.replace(/^models\//, ""));
      }
    }

    if (!response.nextPageToken) {
      break;
    }
    pageToken = response.nextPageToken;
  }

  return uniqueModels(models);
}

function buildAnthropicModelsUrl(baseUrl: string): string {
  return `${buildAnthropicApiBaseUrl(baseUrl)}/models`;
}

function buildGoogleModelsUrl(baseUrl: string, pageToken: string): string {
  const url = new URL(`${buildGoogleApiBaseUrl(baseUrl)}/models`);
  url.searchParams.set("pageSize", "1000");
  if (pageToken) {
    url.searchParams.set("pageToken", pageToken);
  }
  return url.toString();
}

function buildAnthropicApiBaseUrl(baseUrl: string): string {
  const normalized = trimApiUrl(baseUrl)
    .replace(/\/anthropic$/, "")
    .replace(/\/claude$/, "");

  if (normalized.endsWith("/v1")) {
    return normalized;
  }

  return `${normalized}/v1`;
}

function buildGoogleApiBaseUrl(baseUrl: string): string {
  const normalized = trimApiUrl(baseUrl)
    .replace(/\/models$/, "")
    .replace(/\/generateContent$/, "");

  if (/\/v1(beta)?$/.test(normalized)) {
    return normalized;
  }

  return `${normalized}/v1beta`;
}

function buildOpenAIApiBaseUrl(baseUrl: string): string {
  const normalized = trimApiUrl(baseUrl).replace(/\/models$/, "");

  if (hasVersionSegment(normalized)) {
    return normalized;
  }

  return `${normalized}/v1`;
}

function createOpenAIProvider(config: SearchEngineClientConfig) {
  return createOpenAI({
    apiKey: config.apiKey,
    baseURL: buildOpenAIApiBaseUrl(config.apiUrl),
  });
}

function createAnthropicProvider(config: SearchEngineClientConfig) {
  return createAnthropic({
    apiKey: config.apiKey,
    baseURL: buildAnthropicApiBaseUrl(config.apiUrl),
  });
}

function createGoogleProvider(config: SearchEngineClientConfig) {
  return createGoogleGenerativeAI({
    apiKey: config.apiKey,
    baseURL: buildGoogleApiBaseUrl(config.apiUrl),
  });
}

async function generateOpenAIChatText(
  config: SearchEngineClientConfig,
  system: string,
  prompt: string,
): Promise<string> {
  const openai = createOpenAIProvider(config);
  const { text } = await generateText({
    model: openai.chat(config.model),
    system,
    prompt,
    abortSignal: createAbortSignal(config.timeoutMs),
  });
  return text.trim();
}

async function streamOpenAIChatText(
  config: SearchEngineClientConfig,
  system: string,
  prompt: string,
): Promise<string> {
  const openai = createOpenAIProvider(config);
  let streamError: unknown;
  const result = streamText({
    model: openai.chat(config.model),
    system,
    prompt,
    abortSignal: createAbortSignal(config.timeoutMs),
    onError: ({ error }) => {
      streamError = error;
    },
  });
  try {
    return (await result.text).trim();
  } catch (error) {
    throw streamError ?? error;
  }
}

async function searchWithOpenAIChatCompletions(
  config: SearchEngineClientConfig,
  system: string,
  prompt: string,
): Promise<string> {
  try {
    return await streamOpenAIChatText(config, system, prompt);
  } catch (error) {
    if (!isStreamCompatibilityError(error)) {
      throw error;
    }
    return generateOpenAIChatText(config, system, prompt);
  }
}

export async function listSearchEngineModels(
  config: SearchEngineClientConfig,
): Promise<string[]> {
  switch (config.apiFormat) {
    case "openai_chat_completions":
    case "openai_responses":
      return listOpenAIModels(config);
    case "anthropic_messages":
      return listAnthropicModels(config);
    case "google_gemini":
      return listGoogleModels(config);
  }
}

export async function searchWithSearchEngine(
  config: SearchEngineClientConfig,
  messages: SearchEngineMessage[],
): Promise<string> {
  const system = getSystemPrompt(messages);
  const prompt = getPrompt(messages);

  switch (config.apiFormat) {
    case "openai_chat_completions": {
      return searchWithOpenAIChatCompletions(config, system, prompt);
    }
    case "openai_responses": {
      const openai = createOpenAIProvider(config);
      const { text } = await generateText({
        model: openai.responses(config.model),
        system,
        prompt,
        abortSignal: createAbortSignal(config.timeoutMs),
      });
      return text.trim();
    }
    case "anthropic_messages": {
      const anthropic = createAnthropicProvider(config);
      const { text } = await generateText({
        model: anthropic.messages(config.model),
        system,
        prompt,
        abortSignal: createAbortSignal(config.timeoutMs),
      });
      return text.trim();
    }
    case "google_gemini": {
      const google = createGoogleProvider(config);
      const { text } = await generateText({
        model: google.chat(config.model),
        system,
        prompt,
        abortSignal: createAbortSignal(config.timeoutMs),
      });
      return text.trim();
    }
  }
}
