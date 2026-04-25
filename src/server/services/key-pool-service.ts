import type {
  FirecrawlHistoricalQuotaSnapshot,
  FirecrawlTeamQuotaSnapshot,
  KeyPoolProvider,
  ProviderKeyQuotaSnapshot,
  TavilyAccountQuotaSnapshot,
  TavilyKeyQuotaSnapshot,
} from "../../shared/contracts.js";
import type { AppContext } from "../app-context.js";
import {
  firecrawlCreditUsage,
  firecrawlHistoricalCreditUsage,
} from "../providers/firecrawl-client.js";
import { tavilyUsage } from "../providers/tavily-client.js";
import {
  listActionableKeys,
  saveKeyHealth,
  saveKeyQuota,
} from "../repos/key-pool-repo.js";
import { getProviderConfig } from "../repos/provider-repo.js";

interface BatchActionResult {
  updated: number;
  failed: number;
}

function requireProviderConfig(context: AppContext, provider: KeyPoolProvider) {
  const config = getProviderConfig(context.db, provider);
  if (!config) {
    throw new Error(`provider_config_not_found:${provider}`);
  }
  return config;
}

function toNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function mapTavilyKeyQuota(payload: Awaited<ReturnType<typeof tavilyUsage>>): TavilyKeyQuotaSnapshot {
  return {
    usage: toNumber(payload.key?.usage),
    limit: toNumber(payload.key?.limit),
    searchUsage: toNumber(payload.key?.search_usage),
    extractUsage: toNumber(payload.key?.extract_usage),
    crawlUsage: toNumber(payload.key?.crawl_usage),
    mapUsage: toNumber(payload.key?.map_usage),
    researchUsage: toNumber(payload.key?.research_usage),
  };
}

function mapTavilyAccountQuota(
  payload: Awaited<ReturnType<typeof tavilyUsage>>,
): TavilyAccountQuotaSnapshot | null {
  if (!payload.account) {
    return null;
  }
  return {
    currentPlan: payload.account.current_plan ?? null,
    planUsage: toNumber(payload.account.plan_usage),
    planLimit: toNumber(payload.account.plan_limit),
    paygoUsage: toNumber(payload.account.paygo_usage),
    paygoLimit: toNumber(payload.account.paygo_limit),
    searchUsage: toNumber(payload.account.search_usage),
    extractUsage: toNumber(payload.account.extract_usage),
    crawlUsage: toNumber(payload.account.crawl_usage),
    mapUsage: toNumber(payload.account.map_usage),
    researchUsage: toNumber(payload.account.research_usage),
  };
}

function mapFirecrawlTeamQuota(
  payload: Awaited<ReturnType<typeof firecrawlCreditUsage>>,
): FirecrawlTeamQuotaSnapshot {
  return {
    remainingCredits: toNumber(payload.data?.remainingCredits),
    planCredits: toNumber(payload.data?.planCredits),
    billingPeriodStart: payload.data?.billingPeriodStart ?? null,
    billingPeriodEnd: payload.data?.billingPeriodEnd ?? null,
  };
}

function pickHistoricalQuota(
  payload: Awaited<ReturnType<typeof firecrawlHistoricalCreditUsage>>,
): FirecrawlHistoricalQuotaSnapshot {
  const periods = (payload.periods ?? [])
    .sort((left, right) => (left.startDate ?? "").localeCompare(right.startDate ?? ""));
  const latest = periods.at(-1);
  if (!latest) {
    return {
      totalCredits: null,
      startDate: null,
      endDate: null,
    };
  }
  return {
    totalCredits: toNumber(latest.creditsUsed ?? latest.totalCredits),
    startDate: latest.startDate ?? null,
    endDate: latest.endDate ?? null,
  };
}

function mergeQuota(
  current: ProviderKeyQuotaSnapshot | null,
  next: ProviderKeyQuotaSnapshot,
): ProviderKeyQuotaSnapshot {
  return {
    ...(current ?? {}),
    ...next,
  };
}

async function refreshTavilyKeys(
  context: AppContext,
  ids: string[],
): Promise<BatchActionResult> {
  const config = requireProviderConfig(context, "tavily");
  const keys = listActionableKeys(context.db, "tavily", ids, context.bootstrap.encryptionKey);
  let updated = 0;
  let failed = 0;

  for (const key of keys) {
    try {
      const usage = await tavilyUsage({
        apiKey: key.secret,
        baseUrl: config.baseUrl,
        timeoutMs: config.timeoutMs,
      });
      saveKeyHealth(context.db, key.id, "healthy", null);
      saveKeyQuota(context.db, key.id, {
        tavily: {
          key: mapTavilyKeyQuota(usage),
          account: mapTavilyAccountQuota(usage),
        },
      });
      updated += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "quota_sync_failed";
      saveKeyHealth(context.db, key.id, "unhealthy", message);
      failed += 1;
    }
  }

  return { updated, failed };
}

async function refreshFirecrawlKeys(
  context: AppContext,
  ids: string[],
  includeHistorical: boolean,
): Promise<BatchActionResult> {
  const config = requireProviderConfig(context, "firecrawl");
  const keys = listActionableKeys(context.db, "firecrawl", ids, context.bootstrap.encryptionKey);
  let updated = 0;
  let failed = 0;

  for (const key of keys) {
    try {
      const teamUsage = await firecrawlCreditUsage({
        apiKey: key.secret,
        baseUrl: config.baseUrl,
        timeoutMs: config.timeoutMs,
      });
      const historical = includeHistorical
        ? await firecrawlHistoricalCreditUsage({
            apiKey: key.secret,
            baseUrl: config.baseUrl,
            timeoutMs: config.timeoutMs,
          })
        : null;
      saveKeyHealth(context.db, key.id, "healthy", null);
      saveKeyQuota(
        context.db,
        key.id,
        mergeQuota(key.quota, {
          firecrawl: {
            team: mapFirecrawlTeamQuota(teamUsage),
            historical: historical ? pickHistoricalQuota(historical) : key.quota?.firecrawl?.historical ?? null,
          },
        }),
      );
      updated += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "quota_sync_failed";
      saveKeyHealth(context.db, key.id, "unhealthy", message);
      failed += 1;
    }
  }

  return { updated, failed };
}

export async function testKeys(
  context: AppContext,
  provider: KeyPoolProvider,
  ids: string[],
): Promise<BatchActionResult> {
  return provider === "tavily"
    ? refreshTavilyKeys(context, ids)
    : refreshFirecrawlKeys(context, ids, false);
}

export async function syncKeyQuotas(
  context: AppContext,
  provider: KeyPoolProvider,
  ids: string[],
): Promise<BatchActionResult> {
  return provider === "tavily"
    ? refreshTavilyKeys(context, ids)
    : refreshFirecrawlKeys(context, ids, true);
}
