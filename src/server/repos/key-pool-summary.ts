import type {
  KeyPoolProvider,
  KeyPoolSummary,
  ProviderKeyQuotaSnapshot,
  ProviderKeyRecord,
  TavilyAccountQuotaSnapshot,
} from "../../shared/contracts.js";
import { getFirecrawlQuotaMetrics } from "../../shared/firecrawl-quota.js";

const MULTI_TAVILY_ACCOUNT_NOTE =
  "Detected multiple Tavily account snapshots. Showing aggregated account quota.";
const FIRECRAWL_KEY_HISTORY_NOTE =
  "Firecrawl totals assume each imported key belongs to a different team.";

function selectQuotaSyncedAt(records: ProviderKeyRecord[]): string | null {
  return records
    .map((item) => item.quotaSyncedAt)
    .filter((item): item is string => Boolean(item))
    .sort()
    .at(-1) ?? null;
}

function buildTavilySummary(
  records: ProviderKeyRecord[],
): { summary: KeyPoolSummary["tavily"]; note: string | null } {
  const snapshots = records
    .map((item) => item.quota?.tavily)
    .filter((item): item is NonNullable<ProviderKeyQuotaSnapshot["tavily"]> => Boolean(item));
  if (snapshots.length === 0) {
    return { summary: null, note: null };
  }

  const accounts = new Map<string, TavilyAccountQuotaSnapshot>();
  let totalKeyUsage = 0;
  let totalKeyLimit = 0;
  for (const snapshot of snapshots) {
    totalKeyUsage += snapshot.key.usage;
    totalKeyLimit += snapshot.key.limit;
    if (snapshot.account) {
      accounts.set(JSON.stringify(snapshot.account), snapshot.account);
    }
  }

  const uniqueAccounts = [...accounts.values()];
  if (uniqueAccounts.length > 0) {
    totalKeyUsage = uniqueAccounts.reduce((sum, item) => sum + item.planUsage, 0);
    totalKeyLimit = uniqueAccounts.reduce((sum, item) => sum + item.planLimit, 0);
  }

  return {
    summary: {
      totalKeyUsage,
      totalKeyLimit,
      account: uniqueAccounts.length === 1 ? uniqueAccounts[0] : null,
    },
    note: uniqueAccounts.length > 1 ? MULTI_TAVILY_ACCOUNT_NOTE : null,
  };
}

function buildFirecrawlSummary(
  records: ProviderKeyRecord[],
): { summary: KeyPoolSummary["firecrawl"]; note: string | null } {
  const snapshots = records
    .map((item) => item.quota?.firecrawl)
    .filter((item): item is NonNullable<ProviderKeyQuotaSnapshot["firecrawl"]> => Boolean(item));
  if (snapshots.length === 0) {
    return { summary: null, note: null };
  }

  const starts = new Set<string>();
  const ends = new Set<string>();
  let totalUsedCredits = 0;
  let totalRemainingCredits = 0;
  for (const snapshot of snapshots) {
    const metrics = getFirecrawlQuotaMetrics(snapshot.team, snapshot.historical);
    if (metrics) {
      totalUsedCredits += metrics.usedCredits;
      totalRemainingCredits += metrics.remainingCredits;
    }
    if (snapshot.team.billingPeriodStart) {
      starts.add(snapshot.team.billingPeriodStart);
    }
    if (snapshot.team.billingPeriodEnd) {
      ends.add(snapshot.team.billingPeriodEnd);
    }
  }

  return {
    summary: {
      totalUsedCredits,
      totalRemainingCredits,
      totalCredits: totalUsedCredits + totalRemainingCredits,
      billingPeriodStart: starts.size === 1 ? [...starts][0] : null,
      billingPeriodEnd: ends.size === 1 ? [...ends][0] : null,
    },
    note: FIRECRAWL_KEY_HISTORY_NOTE,
  };
}

export function buildKeyPoolSummary(
  provider: KeyPoolProvider,
  records: ProviderKeyRecord[],
): KeyPoolSummary {
  const tavily = provider === "tavily" ? buildTavilySummary(records) : null;
  const firecrawl = provider === "firecrawl" ? buildFirecrawlSummary(records) : null;

  return {
    provider,
    totalKeys: records.length,
    enabledKeys: records.filter((item) => item.enabled).length,
    healthyKeys: records.filter((item) => item.healthStatus === "healthy").length,
    totalRequests: records.reduce((sum, item) => sum + item.requestCount, 0),
    totalFailures: records.reduce((sum, item) => sum + item.failureCount, 0),
    tags: [...new Set(records.flatMap((item) => item.tags))].sort(),
    quotaSyncedAt: selectQuotaSyncedAt(records),
    quotaNote: tavily?.note ?? firecrawl?.note ?? null,
    tavily: tavily?.summary ?? null,
    firecrawl: firecrawl?.summary ?? null,
  };
}
