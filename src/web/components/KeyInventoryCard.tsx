import { useEffect, useState } from "react";
import type {
  FirecrawlHistoricalQuotaSnapshot,
  FirecrawlTeamQuotaSnapshot,
  ProviderKeyRecord,
  TavilyAccountQuotaSnapshot,
} from "@shared/contracts";
import { formatDateTime, formatNumber } from "../format";

type KeyCardProps = {
  item: ProviderKeyRecord;
  revealedValue?: string;
  selected: boolean;
  busy: boolean;
  onToggleSelected: (id: string) => void;
  onToggleReveal: (id: string) => void;
  onCopy: (id: string) => void;
  onSaveNote: (id: string, note: string) => void;
  onDelete: (ids: string[]) => void;
  onToggleEnabled: (id: string, enabled: boolean) => void;
  onTest: (ids: string[]) => void;
  onSyncQuota: (ids: string[]) => void;
};

function joinSummary(primary: string, secondary: string | null): string {
  return secondary ? `${primary} · ${secondary}` : primary;
}

function healthLabel(status: ProviderKeyRecord["healthStatus"]): string {
  if (status === "healthy") {
    return "healthy";
  }
  if (status === "unhealthy") {
    return "unhealthy";
  }
  return "unknown";
}

export function renderTavilyQuota(
  item: ProviderKeyRecord,
  account: TavilyAccountQuotaSnapshot | null,
): string {
  const quota = item.quota?.tavily;
  if (!quota) {
    return "未同步";
  }
  const keyUsage = quota.key.limit > 0
    ? `${formatNumber(quota.key.usage)} / ${formatNumber(quota.key.limit)} credits`
    : `${formatNumber(quota.key.usage)} credits`;
  if (!account) {
    return keyUsage;
  }
  return joinSummary(
    keyUsage,
    `${account.currentPlan ?? "plan"} ${formatNumber(account.planUsage)} / ${formatNumber(account.planLimit)}`,
  );
}

export function renderFirecrawlQuota(
  team: FirecrawlTeamQuotaSnapshot | null,
  historical: FirecrawlHistoricalQuotaSnapshot | null,
): string {
  if (!team) {
    return "未同步";
  }
  const teamText = team.planCredits > 0
    ? `${formatNumber(team.remainingCredits)} / ${formatNumber(team.planCredits)} credits`
    : `${formatNumber(team.remainingCredits)} credits`;
  if (!historical?.byApiKeyMatched) {
    return teamText;
  }
  return joinSummary(teamText, `history ${formatNumber(historical.historicalCredits)}`);
}

export function KeyInventoryCard(props: KeyCardProps) {
  const [noteDraft, setNoteDraft] = useState(props.item.note);

  useEffect(() => {
    setNoteDraft(props.item.note);
  }, [props.item.note]);

  return (
    <article className={`key-card interactive-card ${props.selected ? "key-card-selected" : ""}`}>
      <div className="key-card-head">
        <label className="selection-toggle">
          <input
            checked={props.selected}
            type="checkbox"
            onChange={() => props.onToggleSelected(props.item.id)}
          />
          <span className={`status-pill ${props.item.enabled ? "positive" : "danger"}`}>
            {props.item.enabled ? "enabled" : "disabled"}
          </span>
        </label>
        <span
          className={`status-pill ${
            props.item.healthStatus === "healthy"
              ? "positive"
              : props.item.healthStatus === "unhealthy"
                ? "danger"
                : "neutral"
          }`}
        >
          {healthLabel(props.item.healthStatus)}
        </span>
      </div>
      <div className="key-card-value mono">
        {props.revealedValue ?? props.item.maskedValue}
      </div>
      <div className="key-card-meta-grid">
        <div className="key-meta-card">
          <span>Fingerprint</span>
          <strong className="mono">{props.item.fingerprint}</strong>
        </div>
        <div className="key-meta-card">
          <span>Last Used</span>
          <strong>{formatDateTime(props.item.lastUsedAt)}</strong>
        </div>
        <div className="key-meta-card">
          <span>Checked</span>
          <strong>{formatDateTime(props.item.lastCheckedAt)}</strong>
        </div>
      </div>
      <div className="key-stat-grid">
        <div className="key-stat-card">
          <span>Requests</span>
          <strong>{formatNumber(props.item.requestCount)}</strong>
        </div>
        <div className="key-stat-card">
          <span>Failures</span>
          <strong>{formatNumber(props.item.failureCount)}</strong>
        </div>
        <div className="key-stat-card key-stat-wide">
          <span>Quota</span>
          <strong>
            {props.item.provider === "tavily"
              ? renderTavilyQuota(props.item, props.item.quota?.tavily?.account ?? null)
              : renderFirecrawlQuota(
                  props.item.quota?.firecrawl?.team ?? null,
                  props.item.quota?.firecrawl?.historical ?? null,
                )}
          </strong>
        </div>
      </div>
      <div className="tag-list">
        {props.item.tags.length > 0 ? props.item.tags.map((tag) => (
          <span key={`${props.item.id}-${tag}`} className="tag-chip">{tag}</span>
        )) : <span className="tag-chip">untagged</span>}
      </div>
      {props.item.lastError || props.item.lastCheckError ? (
        <p className="supporting compact key-card-error">
          {props.item.lastCheckError ?? props.item.lastError}
        </p>
      ) : null}
      <label className="field note-editor">
        <span>Note</span>
        <div className="note-editor-row">
          <input
            value={noteDraft}
            onChange={(event) => setNoteDraft(event.target.value)}
            placeholder="Add operational note"
          />
          <button
            className="secondary-button key-action-button"
            disabled={props.busy || noteDraft === props.item.note}
            onClick={() => props.onSaveNote(props.item.id, noteDraft)}
          >
            Save Note
          </button>
        </div>
      </label>
      <div className="key-card-actions">
        <button className="secondary-button key-action-button" disabled={props.busy} onClick={() => props.onToggleReveal(props.item.id)}>
          {props.revealedValue ? "Hide" : "Show"}
        </button>
        <button className="secondary-button key-action-button" disabled={props.busy} onClick={() => props.onCopy(props.item.id)}>
          Copy
        </button>
        <button className="secondary-button key-action-button" disabled={props.busy} onClick={() => props.onTest([props.item.id])}>
          Test
        </button>
        <button className="secondary-button key-action-button" disabled={props.busy} onClick={() => props.onSyncQuota([props.item.id])}>
          Sync
        </button>
        <button className="secondary-button key-action-button" disabled={props.busy} onClick={() => props.onToggleEnabled(props.item.id, !props.item.enabled)}>
          {props.item.enabled ? "Disable" : "Enable"}
        </button>
        <button className="secondary-button key-action-button key-action-danger" disabled={props.busy} onClick={() => props.onDelete([props.item.id])}>
          Delete
        </button>
      </div>
    </article>
  );
}
