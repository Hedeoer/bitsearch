import type {
  FirecrawlAsyncSubmitResult,
  FirecrawlBatchScrapeStatusResult,
  FirecrawlCrawlStatusResult,
  FirecrawlExtractResult,
} from "../../shared/contracts.js";
import { requestJson } from "../lib/http.js";

export interface FirecrawlClientConfig {
  apiKey: string;
  baseUrl: string;
  timeoutMs: number;
}

export interface FirecrawlCreditUsageResponse {
  data?: {
    remainingCredits?: number;
    planCredits?: number;
    billingPeriodStart?: string;
    billingPeriodEnd?: string;
  };
}

export interface FirecrawlHistoricalCreditUsageResponse {
  periods?: Array<{
    startDate?: string;
    endDate?: string;
    apiKey?: string;
    totalCredits?: number;
  }>;
}

export type FirecrawlFormatOption = string | Record<string, unknown>;

export interface FirecrawlCrawlInput {
  url: string;
  prompt?: string;
  excludePaths?: string[];
  includePaths?: string[];
  maxDiscoveryDepth?: number;
  sitemap?: "skip" | "include" | "only";
  ignoreQueryParameters?: boolean;
  regexOnFullURL?: boolean;
  limit?: number;
  crawlEntireDomain?: boolean;
  allowExternalLinks?: boolean;
  allowSubdomains?: boolean;
  delay?: number;
  maxConcurrency?: number;
  webhook?: Record<string, unknown>;
  scrapeOptions?: Record<string, unknown>;
  zeroDataRetention?: boolean;
}

export interface FirecrawlBatchScrapeInput {
  urls: string[];
  webhook?: Record<string, unknown>;
  maxConcurrency?: number;
  ignoreInvalidURLs?: boolean;
  formats?: FirecrawlFormatOption[];
  onlyMainContent?: boolean;
  includeTags?: string[];
  excludeTags?: string[];
  maxAge?: number;
  minAge?: number;
  headers?: Record<string, string>;
  waitFor?: number;
  mobile?: boolean;
  skipTlsVerification?: boolean;
  timeout?: number;
  parsers?: Array<Record<string, unknown>>;
  actions?: Array<Record<string, unknown>>;
  location?: Record<string, unknown>;
  removeBase64Images?: boolean;
  blockAds?: boolean;
  proxy?: "basic" | "enhanced" | "auto";
  storeInCache?: boolean;
  profile?: Record<string, unknown>;
  zeroDataRetention?: boolean;
}

export interface FirecrawlExtractInput {
  urls: string[];
  prompt?: string;
  schema?: Record<string, unknown>;
  enableWebSearch?: boolean;
  ignoreSitemap?: boolean;
  includeSubdomains?: boolean;
  showSources?: boolean;
  scrapeOptions?: Record<string, unknown>;
  ignoreInvalidURLs?: boolean;
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

function asBoolean(value: unknown): boolean {
  return value === true;
}

function asStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  return value.filter((item): item is string => typeof item === "string");
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function asRecordArray(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? value.map((item) => asRecord(item)).filter((item): item is Record<string, unknown> => item !== null)
    : [];
}

function normalizeSubmitResult(payload: Record<string, unknown>): FirecrawlAsyncSubmitResult {
  return {
    success: asBoolean(payload.success),
    id: asString(payload.id) ?? "",
    url: asString(payload.url),
    invalidUrls: asStringArray(payload.invalidURLs),
  };
}

function normalizeStatusResult(
  payload: Record<string, unknown>,
): FirecrawlCrawlStatusResult {
  return {
    status: asString(payload.status) ?? "",
    total: asNumber(payload.total),
    completed: asNumber(payload.completed),
    creditsUsed: asNumber(payload.creditsUsed),
    expiresAt: asString(payload.expiresAt),
    next: asString(payload.next),
    data: asRecordArray(payload.data),
  };
}

export async function firecrawlCreditUsage(
  config: FirecrawlClientConfig,
): Promise<FirecrawlCreditUsageResponse> {
  return requestJson<FirecrawlCreditUsageResponse>(
    `${config.baseUrl.replace(/\/$/, "")}/team/credit-usage`,
    {
      method: "GET",
      headers: { Authorization: `Bearer ${config.apiKey}` },
      timeoutMs: config.timeoutMs,
    },
  );
}

export async function firecrawlHistoricalCreditUsage(
  config: FirecrawlClientConfig,
): Promise<FirecrawlHistoricalCreditUsageResponse> {
  const baseUrl = config.baseUrl.replace(/\/$/, "");
  return requestJson<FirecrawlHistoricalCreditUsageResponse>(
    `${baseUrl}/team/credit-usage/historical?byApiKey=true`,
    {
      method: "GET",
      headers: { Authorization: `Bearer ${config.apiKey}` },
      timeoutMs: config.timeoutMs,
    },
  );
}

export async function firecrawlCrawl(
  config: FirecrawlClientConfig,
  input: FirecrawlCrawlInput,
): Promise<FirecrawlAsyncSubmitResult> {
  const data = await requestJson<Record<string, unknown>>(
    `${config.baseUrl.replace(/\/$/, "")}/crawl`,
    {
      headers: { Authorization: `Bearer ${config.apiKey}` },
      body: {
        url: input.url,
        prompt: input.prompt || undefined,
        excludePaths: input.excludePaths,
        includePaths: input.includePaths,
        maxDiscoveryDepth: input.maxDiscoveryDepth,
        sitemap: input.sitemap,
        ignoreQueryParameters: input.ignoreQueryParameters,
        regexOnFullURL: input.regexOnFullURL,
        limit: input.limit,
        crawlEntireDomain: input.crawlEntireDomain,
        allowExternalLinks: input.allowExternalLinks,
        allowSubdomains: input.allowSubdomains,
        delay: input.delay,
        maxConcurrency: input.maxConcurrency,
        webhook: input.webhook,
        scrapeOptions: input.scrapeOptions,
        zeroDataRetention: input.zeroDataRetention,
      },
      timeoutMs: Math.max(config.timeoutMs, 60000),
    },
  );
  return normalizeSubmitResult(data);
}

export async function firecrawlCrawlStatus(
  config: FirecrawlClientConfig,
  id: string,
): Promise<FirecrawlCrawlStatusResult> {
  const data = await requestJson<Record<string, unknown>>(
    `${config.baseUrl.replace(/\/$/, "")}/crawl/${id}`,
    {
      method: "GET",
      headers: { Authorization: `Bearer ${config.apiKey}` },
      timeoutMs: Math.max(config.timeoutMs, 60000),
    },
  );
  return normalizeStatusResult(data);
}

export async function firecrawlBatchScrape(
  config: FirecrawlClientConfig,
  input: FirecrawlBatchScrapeInput,
): Promise<FirecrawlAsyncSubmitResult> {
  const data = await requestJson<Record<string, unknown>>(
    `${config.baseUrl.replace(/\/$/, "")}/batch/scrape`,
    {
      headers: { Authorization: `Bearer ${config.apiKey}` },
      body: {
        urls: input.urls,
        webhook: input.webhook,
        maxConcurrency: input.maxConcurrency,
        ignoreInvalidURLs: input.ignoreInvalidURLs,
        formats: input.formats,
        onlyMainContent: input.onlyMainContent,
        includeTags: input.includeTags,
        excludeTags: input.excludeTags,
        maxAge: input.maxAge,
        minAge: input.minAge,
        headers: input.headers,
        waitFor: input.waitFor,
        mobile: input.mobile,
        skipTlsVerification: input.skipTlsVerification,
        timeout: input.timeout,
        parsers: input.parsers,
        actions: input.actions,
        location: input.location,
        removeBase64Images: input.removeBase64Images,
        blockAds: input.blockAds,
        proxy: input.proxy,
        storeInCache: input.storeInCache,
        profile: input.profile,
        zeroDataRetention: input.zeroDataRetention,
      },
      timeoutMs: Math.max(config.timeoutMs, 60000),
    },
  );
  return normalizeSubmitResult(data);
}

export async function firecrawlBatchScrapeStatus(
  config: FirecrawlClientConfig,
  id: string,
): Promise<FirecrawlBatchScrapeStatusResult> {
  const data = await requestJson<Record<string, unknown>>(
    `${config.baseUrl.replace(/\/$/, "")}/batch/scrape/${id}`,
    {
      method: "GET",
      headers: { Authorization: `Bearer ${config.apiKey}` },
      timeoutMs: Math.max(config.timeoutMs, 60000),
    },
  );
  return normalizeStatusResult(data);
}

export async function firecrawlExtract(
  config: FirecrawlClientConfig,
  input: FirecrawlExtractInput,
): Promise<FirecrawlAsyncSubmitResult> {
  const data = await requestJson<Record<string, unknown>>(
    `${config.baseUrl.replace(/\/$/, "")}/extract`,
    {
      headers: { Authorization: `Bearer ${config.apiKey}` },
      body: {
        urls: input.urls,
        prompt: input.prompt || undefined,
        schema: input.schema,
        enableWebSearch: input.enableWebSearch,
        ignoreSitemap: input.ignoreSitemap,
        includeSubdomains: input.includeSubdomains,
        showSources: input.showSources,
        scrapeOptions: input.scrapeOptions,
        ignoreInvalidURLs: input.ignoreInvalidURLs,
      },
      timeoutMs: Math.max(config.timeoutMs, 60000),
    },
  );
  return normalizeSubmitResult(data);
}

export async function firecrawlExtractStatus(
  config: FirecrawlClientConfig,
  id: string,
): Promise<FirecrawlExtractResult> {
  const data = await requestJson<Record<string, unknown>>(
    `${config.baseUrl.replace(/\/$/, "")}/extract/${id}`,
    {
      method: "GET",
      headers: { Authorization: `Bearer ${config.apiKey}` },
      timeoutMs: Math.max(config.timeoutMs, 60000),
    },
  );
  return {
    success: asBoolean(data.success),
    data: data.data ?? null,
    status: asString(data.status) ?? "",
    expiresAt: asString(data.expiresAt),
    tokensUsed: asNumber(data.tokensUsed),
  };
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
