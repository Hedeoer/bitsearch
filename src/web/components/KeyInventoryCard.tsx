import { useEffect, useState } from "react";
import { Eye, EyeOff, Copy, Trash2, FlaskConical, RefreshCw, Power } from "lucide-react";
import type {
  FirecrawlHistoricalQuotaSnapshot,
  FirecrawlTeamQuotaSnapshot,
  ProviderKeyRecord,
  TavilyAccountQuotaSnapshot,
} from "@shared/contracts";
import { formatDateTime, formatNumber } from "../format";
import { InlineSpinner } from "./Feedback";

type KeyCardProps = {
  item: ProviderKeyRecord;
  revealedValue?: string;
  selected: boolean;
  isCopying: boolean;
  isDeleting: boolean;
  isRevealing: boolean;
  onToggleSelected: (id: string) => void;
  onToggleReveal: (id: string) => void;
  onCopy: (id: string) => void;
  isSavingNote: boolean;
  onSaveNote: (id: string, note: string) => void;
  isSyncing: boolean;
  isTesting: boolean;
  isTogglingEnabled: boolean;
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
    return "Not synced";
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
    return "Not synced";
  }
  const teamText = team.planCredits > 0
    ? `${formatNumber(team.remainingCredits)} / ${formatNumber(team.planCredits)} credits`
    : `${formatNumber(team.remainingCredits)} credits`;
  if (!historical?.byApiKeyMatched) {
    return teamText;
  }
  return joinSummary(teamText, `history ${formatNumber(historical.historicalCredits)}`);
}

function MetaSep() {
  return <span className="meta-sep" aria-hidden="true">·</span>;
}

function MetaItem(props: { label: string; value: string }) {
  return (
    <>
      <span className="meta-label">{props.label}</span>
      <span className="meta-value">{props.value}</span>
    </>
  );
}

export function KeyInventoryCard(props: KeyCardProps) {
  const [noteDraft, setNoteDraft] = useState(props.item.note);

  useEffect(() => {
    setNoteDraft(props.item.note);
  }, [props.item.note]);

  const quotaText = props.item.provider === "tavily"
    ? renderTavilyQuota(props.item, props.item.quota?.tavily?.account ?? null)
    : renderFirecrawlQuota(
        props.item.quota?.firecrawl?.team ?? null,
        props.item.quota?.firecrawl?.historical ?? null,
      );

  return (
    <article className={`key-card interactive-card ${props.selected ? "key-card-selected" : ""}`}>
      {/* Row 1: Status + Key value + Tags */}
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
        </label>
        <div className="tag-list">
          {props.item.tags.length > 0 ? props.item.tags.map((tag) => (
            <span key={`${props.item.id}-${tag}`} className="tag-chip">{tag}</span>
          )) : <span className="tag-chip">untagged</span>}
        </div>
      </div>

      {/* Row 2: Masked key value */}
      <div className="key-card-value mono">
        {props.revealedValue ?? props.item.maskedValue}
      </div>

      {/* Row 3: Inline metadata */}
      <div className="key-inline-meta">
        <MetaItem label="Fingerprint:" value={props.item.fingerprint} />
        <MetaSep />
        <MetaItem label="Used:" value={formatDateTime(props.item.lastUsedAt)} />
        <MetaSep />
        <MetaItem label="Checked:" value={formatDateTime(props.item.lastCheckedAt)} />
        <MetaSep />
        <MetaItem label="Created:" value={formatDateTime(props.item.createdAt)} />
      </div>

      {/* Row 4: Inline stats */}
      <div className="key-inline-stats">
        <MetaItem label="Requests:" value={formatNumber(props.item.requestCount)} />
        <MetaSep />
        <MetaItem label="Failures:" value={formatNumber(props.item.failureCount)} />
        <MetaSep />
        <MetaItem label="Quota:" value={quotaText} />
      </div>

      {/* Row 5: Error (conditional) */}
      {props.item.lastError || props.item.lastCheckError ? (
        <p className="supporting compact key-card-error">
          {props.item.lastCheckError ?? props.item.lastError}
        </p>
      ) : null}

      {/* Row 6: Note editor + Actions */}
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "flex-end" }}>
        <label className="field note-editor" style={{ flex: "1 1 280px", margin: 0 }}>
          <span>Note</span>
          <div className="note-editor-row">
            <input
              value={noteDraft}
              onChange={(event) => setNoteDraft(event.target.value)}
              placeholder="Add operational note"
            />
            <button
              className="secondary-button key-action-button"
              disabled={props.isSavingNote || noteDraft === props.item.note}
              onClick={() => props.onSaveNote(props.item.id, noteDraft)}
            >
              {props.isSavingNote ? <InlineSpinner label="Saving" /> : "Save"}
            </button>
          </div>
        </label>
        <div className="key-card-actions">
          <button className="secondary-button key-action-button" disabled={props.isRevealing} onClick={() => props.onToggleReveal(props.item.id)}>
            {props.isRevealing ? <InlineSpinner label="" /> : props.revealedValue ? <><EyeOff size={13} /> Hide</> : <><Eye size={13} /> Show</>}
          </button>
          <button className="secondary-button key-action-button" disabled={props.isCopying || props.isRevealing} onClick={() => props.onCopy(props.item.id)}>
            {props.isCopying ? <InlineSpinner label="" /> : <><Copy size={13} /> Copy</>}
          </button>
          <button className="secondary-button key-action-button" disabled={props.isTesting} onClick={() => props.onTest([props.item.id])}>
            {props.isTesting ? <InlineSpinner label="" /> : <><FlaskConical size={13} /> Test</>}
          </button>
          <button className="secondary-button key-action-button" disabled={props.isSyncing} onClick={() => props.onSyncQuota([props.item.id])}>
            {props.isSyncing ? <InlineSpinner label="" /> : <><RefreshCw size={13} /> Sync</>}
          </button>
          <button className="secondary-button key-action-button" disabled={props.isTogglingEnabled} onClick={() => props.onToggleEnabled(props.item.id, !props.item.enabled)}>
            {props.isTogglingEnabled
              ? <InlineSpinner label="" />
              : <><Power size={13} /> {props.item.enabled ? "Disable" : "Enable"}</>}
          </button>
          <button className="danger-button key-action-button" disabled={props.isDeleting} onClick={() => props.onDelete([props.item.id])}>
            {props.isDeleting ? <InlineSpinner label="" /> : <><Trash2 size={13} /> Del</>}
          </button>
        </div>
      </div>
    </article>
  );
}
