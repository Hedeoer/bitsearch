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
