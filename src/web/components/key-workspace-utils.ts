import type { Dispatch, SetStateAction } from "react";
import type { KeyListStatus, KeyPoolProvider, ProviderKeyRecord } from "@shared/contracts";
import type { KeySortMode } from "../types";

export const DEFAULT_PROVIDER: KeyPoolProvider = "tavily";
export const DEFAULT_SORT: KeySortMode = "requests_desc";
export const DEFAULT_STATUS: KeyListStatus = "all";

export type ActionResponse = {
  ok?: boolean;
  updated?: number;
  failed?: number;
  changed?: number;
  inserted?: number;
  skipped?: number;
};

export type ConfirmDeleteState = {
  description: string;
  ids: string[];
  source: "batch" | "card";
  title: string;
};

export type PendingStateSetter = Dispatch<SetStateAction<Set<string>>>;

export function buildActionIds(selectedIds: string[], visibleKeys: ProviderKeyRecord[]): string[] {
  if (selectedIds.length > 0) {
    return selectedIds;
  }
  return visibleKeys.map((item) => item.id);
}

export function updatePendingIds(
  setter: PendingStateSetter,
  ids: string[],
  active: boolean,
) {
  setter((current) => {
    const next = new Set(current);
    ids.forEach((id) => {
      if (active) {
        next.add(id);
        return;
      }
      next.delete(id);
    });
    return next;
  });
}

export function summarizeAction(label: string, response: ActionResponse): string {
  if (typeof response.inserted === "number") {
    return `${label}: ${response.inserted} inserted, ${response.skipped ?? 0} skipped`;
  }
  if (typeof response.changed === "number") {
    return `${label}: ${response.changed} changed`;
  }
  if (response.ok) {
    return label;
  }
  return `${label}: ${response.updated ?? 0} succeeded, ${response.failed ?? 0} failed`;
}

function quotaRemaining(item: ProviderKeyRecord): number {
  if (item.provider === "tavily") {
    const quota = item.quota?.tavily?.key;
    return quota ? quota.limit - quota.usage : -1;
  }
  return item.quota?.firecrawl?.team.remainingCredits ?? -1;
}

export function sortKeys(items: ProviderKeyRecord[], sortMode: KeySortMode): ProviderKeyRecord[] {
  const next = [...items];
  next.sort((left, right) => {
    if (sortMode === "requests_asc") {
      return left.requestCount - right.requestCount;
    }
    if (sortMode === "requests_desc") {
      return right.requestCount - left.requestCount;
    }
    if (sortMode === "failures_desc") {
      return right.failureCount - left.failureCount;
    }
    if (sortMode === "quota_remaining_desc") {
      return quotaRemaining(right) - quotaRemaining(left);
    }
    return (Date.parse(right.lastUsedAt ?? "") || 0) - (Date.parse(left.lastUsedAt ?? "") || 0);
  });
  return next;
}
