import { requestJson } from "../lib/http.js";

export interface FirecrawlClientConfig {
  apiKey: string;
  baseUrl: string;
  timeoutMs: number;
}

export async function firecrawlScrape(
  config: FirecrawlClientConfig,
  url: string,
): Promise<string | null> {
  const data = await requestJson<{
    data?: { markdown?: string };
  }>(`${config.baseUrl.replace(/\/$/, "")}/scrape`, {
    headers: { Authorization: `Bearer ${config.apiKey}` },
    body: {
      url,
      formats: ["markdown"],
    },
    timeoutMs: Math.max(config.timeoutMs, 60000),
  });

  return data.data?.markdown?.trim() || null;
}

export async function firecrawlMap(
  config: FirecrawlClientConfig,
  input: { url: string; instructions: string; limit: number },
): Promise<string> {
  const data = await requestJson<Record<string, unknown>>(
    `${config.baseUrl.replace(/\/$/, "")}/map`,
    {
      headers: { Authorization: `Bearer ${config.apiKey}` },
      body: {
        url: input.url,
        search: input.instructions || undefined,
        limit: input.limit,
      },
      timeoutMs: Math.max(config.timeoutMs, 60000),
    },
  );
  return JSON.stringify(data, null, 2);
}

export async function firecrawlSearch(
  config: FirecrawlClientConfig,
  query: string,
  limit: number,
): Promise<Array<Record<string, unknown>>> {
  const data = await requestJson<{
    data?: {
      web?: Array<{ title?: string; url?: string; description?: string }>;
    };
  }>(`${config.baseUrl.replace(/\/$/, "")}/search`, {
    headers: { Authorization: `Bearer ${config.apiKey}` },
    body: { query, limit },
    timeoutMs: config.timeoutMs,
  });

  return (data.data?.web ?? []).map((item) => ({
    title: item.title ?? "",
    url: item.url ?? "",
    description: item.description ?? "",
    provider: "firecrawl",
  }));
}
