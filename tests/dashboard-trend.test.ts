import assert from "node:assert/strict";
import test from "node:test";
import { aggregateHourlyBuckets } from "../src/server/repos/dashboard-repo.js";
import type { DashboardTrendPoint } from "../src/shared/contracts.js";

function hourlyPoint(iso: string, successCount: number, failedCount = 0): DashboardTrendPoint {
  return { bucketStart: iso, successCount, failedCount };
}

test("aggregateHourlyBuckets keeps hourly series untouched for 1h buckets", () => {
  const now = new Date("2026-08-25T16:37:00Z");
  const hourly = [
    hourlyPoint("2026-08-25T15:00:00.000Z", 3, 1),
    hourlyPoint("2026-08-25T16:00:00.000Z", 5, 2),
  ];
  assert.deepEqual(aggregateHourlyBuckets(hourly, 1, now), hourly);
});

test("aggregateHourlyBuckets merges across 6h boundaries and aligns the tail to the current bucket", () => {
  const now = new Date("2026-08-25T16:37:00Z");
  const hourly = [
    hourlyPoint("2026-08-25T04:00:00.000Z", 1),
    hourlyPoint("2026-08-25T05:00:00.000Z", 2, 1),
    // 06:00 bucket
    hourlyPoint("2026-08-25T06:00:00.000Z", 3),
    hourlyPoint("2026-08-25T11:00:00.000Z", 4, 2),
    // 12:00 bucket is the current bucket (now = 16:37), tail merges into 12:00
    hourlyPoint("2026-08-25T12:00:00.000Z", 5),
    hourlyPoint("2026-08-25T16:00:00.000Z", 6, 3),
  ];
  const merged = aggregateHourlyBuckets(hourly, 6, now);
  assert.deepEqual(
    merged.map((point) => point.bucketStart),
    [
      "2026-08-25T00:00:00.000Z",
      "2026-08-25T06:00:00.000Z",
      "2026-08-25T12:00:00.000Z",
    ],
  );
  assert.deepEqual(
    merged.map((point) => ({ s: point.successCount, f: point.failedCount })),
    [
      { s: 3, f: 1 },
      { s: 7, f: 2 },
      { s: 11, f: 3 },
    ],
  );
});

test("aggregateHourlyBuckets aligns 24h buckets to UTC midnight across day boundaries", () => {
  const now = new Date("2026-08-25T01:20:00Z");
  const hourly = [
    hourlyPoint("2026-08-24T22:00:00.000Z", 1),
    hourlyPoint("2026-08-24T23:00:00.000Z", 2),
    // previous UTC day ends here
    hourlyPoint("2026-08-25T00:00:00.000Z", 3, 4),
    hourlyPoint("2026-08-25T01:00:00.000Z", 5),
  ];
  const merged = aggregateHourlyBuckets(hourly, 24, now);
  assert.equal(merged.length, 2);
  assert.equal(merged[0]?.bucketStart, "2026-08-24T00:00:00.000Z");
  assert.equal(merged[0]?.successCount, 3);
  assert.equal(merged[1]?.bucketStart, "2026-08-25T00:00:00.000Z");
  assert.equal(merged[1]?.successCount, 8);
  assert.equal(merged[1]?.failedCount, 4);
});

test("aggregateHourlyBuckets returns an empty series unchanged", () => {
  const now = new Date("2026-08-25T16:37:00Z");
  assert.deepEqual(aggregateHourlyBuckets([], 6, now), []);
  assert.deepEqual(aggregateHourlyBuckets([], 24, now), []);
});

test("aggregateHourlyBuckets sorts merged buckets chronologically", () => {
  const now = new Date("2026-08-25T16:37:00Z");
  // Input arrives in ascending order from SQL, but the merge must not rely on it.
  const hourly = [
    hourlyPoint("2026-08-25T12:00:00.000Z", 1),
    hourlyPoint("2026-08-25T02:00:00.000Z", 2),
    hourlyPoint("2026-08-25T07:00:00.000Z", 3),
  ];
  const merged = aggregateHourlyBuckets(hourly, 6, now);
  assert.deepEqual(
    merged.map((point) => [point.bucketStart, point.successCount]),
    [
      ["2026-08-25T00:00:00.000Z", 2],
      ["2026-08-25T06:00:00.000Z", 3],
      ["2026-08-25T12:00:00.000Z", 1],
    ],
  );
});
