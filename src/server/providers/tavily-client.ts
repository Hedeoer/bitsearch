import type { TavilyCrawlResult } from "../../shared/contracts.js";
import { requestJson } from "../lib/http.js";

export interface TavilyClientConfig {
  apiKey: string;
  baseUrl: string;
  timeoutMs: number;
}

export interface TavilyUsageResponse {
  key?: {
    usage?: number;
    limit?: number;
    search_usage?: number;
    extract_usage?: number;
    crawl_usage?: number;
    map_usage?: number;
    research_usage?: number;
  };
  account?: {
    current_plan?: string;
    plan_usage?: number;
    plan_limit?: number;
    paygo_usage?: number;
    paygo_limit?: number;
    search_usage?: number;
    extract_usage?: number;
    crawl_usage?: number;
    map_usage?: number;
    research_usage?: number;
  };
}

export interface TavilyCrawlInput {
  url: string;
  instructions?: string;
  chunksPerSource?: number;
  maxDepth?: number;
  maxBreadth?: number;
  limit?: number;
  selectPaths?: string[];
  selectDomains?: string[];
  excludePaths?: string[];
  excludeDomains?: string[];
  allowExternal?: boolean;
  includeImages?: boolean;
  extractDepth?: "basic" | "advanced";
  format?: "markdown" | "text";
  includeFavicon?: boolean;
  timeout?: number;
  includeUsage?: boolean;
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

export async function tavilyUsage(
  config: TavilyClientConfig,
): Promise<TavilyUsageResponse> {
  return requestJson<TavilyUsageResponse>(`${config.baseUrl.replace(/\/$/, "")}/usage`, {
    method: "GET",
    headers: { Authorization: `Bearer ${config.apiKey}` },
    timeoutMs: config.timeoutMs,
  });
}

export async function tavilyExtract(
  config: TavilyClientConfig,
  url: string,
): Promise<string | null> {
  const data = await requestJson<{
    results?: Array<{ raw_content?: string; content?: string }>;
  }>(`${config.baseUrl.replace(/\/$/, "")}/extract`, {
    headers: { Authorization: `Bearer ${config.apiKey}` },
    body: { urls: [url], format: "markdown" },
    timeoutMs: config.timeoutMs,
  });

  const result = data.results?.[0];
  return result?.raw_content?.trim() || result?.content?.trim() || null;
}

export async function tavilyCrawl(
  config: TavilyClientConfig,
  input: TavilyCrawlInput,
): Promise<TavilyCrawlResult> {
  const data = await requestJson<Record<string, unknown>>(
    `${config.baseUrl.replace(/\/$/, "")}/crawl`,
    {
      headers: { Authorization: `Bearer ${config.apiKey}` },
      body: {
        url: input.url,
        instructions: input.instructions || undefined,
        chunks_per_source: input.chunksPerSource,
        max_depth: input.maxDepth,
        max_breadth: input.maxBreadth,
        limit: input.limit,
        select_paths: input.selectPaths,
        select_domains: input.selectDomains,
        exclude_paths: input.excludePaths,
        exclude_domains: input.excludeDomains,
        allow_external: input.allowExternal,
        include_images: input.includeImages,
        extract_depth: input.extractDepth,
        format: input.format,
        include_favicon: input.includeFavicon,
        timeout: input.timeout,
        include_usage: input.includeUsage,
      },
      timeoutMs: Math.max(config.timeoutMs, (input.timeout ?? 30) * 1000),
    },
  );
  const results = Array.isArray(data.results) ? data.results : [];
  return {
    baseUrl: asString(data.base_url) ?? "",
    results: results.map((item) => {
      const record = asObject(item);
      return {
        url: asString(record?.url) ?? "",
        rawContent: asString(record?.raw_content),
        favicon: asString(record?.favicon),
      };
    }),
    responseTime: asNumber(data.response_time),
    usage: asObject(data.usage),
    requestId: asString(data.request_id),
  };
}

export async function tavilyMap(
  config: TavilyClientConfig,
  input: {
    url: string;
    instructions: string;
    maxDepth: number;
    maxBreadth: number;
    limit: number;
    timeout: number;
  },
): Promise<string> {
  const data = await requestJson<Record<string, unknown>>(
    `${config.baseUrl.replace(/\/$/, "")}/map`,
    {
      headers: { Authorization: `Bearer ${config.apiKey}` },
      body: {
        url: input.url,
        instructions: input.instructions || undefined,
        max_depth: input.maxDepth,
        max_breadth: input.maxBreadth,
        limit: input.limit,
        timeout: input.timeout,
      },
      timeoutMs: Math.max(config.timeoutMs, input.timeout * 1000),
    },
  );
  return JSON.stringify(data, null, 2);
}

export async function tavilySearch(
  config: TavilyClientConfig,
  query: string,
  maxResults: number,
): Promise<Array<Record<string, unknown>>> {
  const data = await requestJson<{
    results?: Array<{
      title?: string;
      url?: string;
      content?: string;
      score?: number;
    }>;
  }>(`${config.baseUrl.replace(/\/$/, "")}/search`, {
    headers: { Authorization: `Bearer ${config.apiKey}` },
    body: {
      query,
      max_results: maxResults,
      search_depth: "advanced",
      include_raw_content: false,
      include_answer: false,
    },
    timeoutMs: config.timeoutMs,
  });
  return (data.results ?? []).map((item) => ({
    title: item.title ?? "",
    url: item.url ?? "",
    content: item.content ?? "",
    score: item.score ?? 0,
    provider: "tavily",
  }));
}
