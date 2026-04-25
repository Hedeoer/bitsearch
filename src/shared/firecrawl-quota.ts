import type {
  FirecrawlHistoricalQuotaSnapshot,
  FirecrawlTeamQuotaSnapshot,
} from "./contracts.js";

export interface FirecrawlQuotaMetrics {
  usedCredits: number;
  remainingCredits: number;
  totalCredits: number;
}

export function getFirecrawlQuotaMetrics(
  team: FirecrawlTeamQuotaSnapshot | null | undefined,
  historical: FirecrawlHistoricalQuotaSnapshot | null | undefined,
): FirecrawlQuotaMetrics | null {
  if (!team) {
    return null;
  }

  const usedCredits = Math.max(0, historical?.totalCredits ?? 0);
  const remainingCredits = Math.max(0, team.remainingCredits);
  return {
    usedCredits,
    remainingCredits,
    totalCredits: usedCredits + remainingCredits,
  };
}
