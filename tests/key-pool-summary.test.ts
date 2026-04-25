import assert from "node:assert/strict";
import test from "node:test";
import { buildKeyPoolSummary } from "../src/server/repos/key-pool-summary.js";
import type { ProviderKeyRecord } from "../src/shared/contracts.js";

function makeFirecrawlKey(
  id: string,
  remainingCredits: number,
  usedCredits: number | null,
): ProviderKeyRecord {
  return {
    id,
    provider: "firecrawl",
    name: id,
    fingerprint: `${id}-fp`,
    maskedValue: `${id}...mask`,
    enabled: true,
    tags: [],
    note: "",
    healthStatus: "healthy",
    lastCheckedAt: null,
    lastCheckError: null,
    lastUsedAt: null,
    lastError: null,
    lastStatusCode: null,
    requestCount: 0,
    failureCount: 0,
    quota: {
      firecrawl: {
        team: {
          remainingCredits,
          planCredits: 500,
          billingPeriodStart: "2026-04-01T00:00:00.000Z",
          billingPeriodEnd: "2026-04-30T23:59:59.999Z",
        },
        historical: {
          totalCredits: usedCredits,
          startDate: "2026-04-01T00:00:00.000Z",
          endDate: "2026-04-30T23:59:59.999Z",
        },
      },
    },
    quotaSyncedAt: "2026-04-25T05:22:34.843Z",
    createdAt: "2026-04-25T05:22:34.843Z",
    updatedAt: "2026-04-25T05:22:34.843Z",
  };
}

test("buildKeyPoolSummary aggregates Firecrawl used, remaining, and total credits", () => {
  const summary = buildKeyPoolSummary("firecrawl", [
    makeFirecrawlKey("fc-1", 100, 25),
    makeFirecrawlKey("fc-2", 80, 20),
  ]);

  assert.deepEqual(summary.firecrawl, {
    totalUsedCredits: 45,
    totalRemainingCredits: 180,
    totalCredits: 225,
    billingPeriodStart: "2026-04-01T00:00:00.000Z",
    billingPeriodEnd: "2026-04-30T23:59:59.999Z",
  });
});

test("buildKeyPoolSummary treats missing Firecrawl historical usage as zero", () => {
  const summary = buildKeyPoolSummary("firecrawl", [
    makeFirecrawlKey("fc-1", 150, null),
  ]);

  assert.equal(summary.firecrawl?.totalUsedCredits, 0);
  assert.equal(summary.firecrawl?.totalRemainingCredits, 150);
  assert.equal(summary.firecrawl?.totalCredits, 150);
});
