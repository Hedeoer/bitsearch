import { generateText } from "ai";
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
      const openai = createOpenAIProvider(config);
      const { text } = await generateText({
        model: openai.chat(config.model),
        system,
        prompt,
        abortSignal: createAbortSignal(config.timeoutMs),
      });
      return text.trim();
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
