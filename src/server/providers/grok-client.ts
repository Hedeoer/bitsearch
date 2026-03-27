import { requestJson, requestTextStream } from "../lib/http.js";

const SEARCH_PROMPT = [
  "Search the web broadly and answer with evidence.",
  "Use current information when the query is time-sensitive.",
  "At the end, include a source section with markdown links when available.",
].join(" ");

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

export interface GrokClientConfig {
  apiUrl: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
}

export async function listGrokModels(config: GrokClientConfig): Promise<string[]> {
  const data = await requestJson<{ data?: Array<{ id?: string }> }>(
    `${config.apiUrl.replace(/\/$/, "")}/models`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
      },
      timeoutMs: Math.min(config.timeoutMs, 10000),
    },
  );
  return (data.data ?? []).flatMap((item) => (item.id ? [item.id] : []));
}

export async function searchWithGrok(
  config: GrokClientConfig,
  query: string,
  platform: string,
): Promise<string> {
  return requestTextStream(`${config.apiUrl.replace(/\/$/, "")}/chat/completions`, {
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: {
      model: config.model,
      stream: true,
      messages: [
        {
          role: "system",
          content: SEARCH_PROMPT,
        },
        {
          role: "user",
          content: buildUserPrompt(query, platform),
        },
      ],
    },
    timeoutMs: Math.max(config.timeoutMs, 120000),
  });
}
