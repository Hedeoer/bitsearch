import { useEffect, useState } from "react";
import { Eye, EyeOff, Copy, Trash2, FlaskConical, RefreshCw, Power, MoreHorizontal, Edit2, CheckCircle, AlertCircle, XCircle, Activity, Clock, Database } from "lucide-react";
import type {
  FirecrawlHistoricalQuotaSnapshot,
  FirecrawlTeamQuotaSnapshot,
  ProviderKeyRecord,
  TavilyAccountQuotaSnapshot,
} from "@shared/contracts";
import { getFirecrawlQuotaMetrics } from "@shared/firecrawl-quota";
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
  if (!quota) return "Not synced";

  if (account && account.planLimit > 0) {
    return `${formatNumber(account.planUsage)}/${formatNumber(account.planLimit)}`;
  }
  
  if (quota.key.limit > 0) {
    return `${formatNumber(quota.key.usage)}/${formatNumber(quota.key.limit)}`;
  }
  
  return `${formatNumber(quota.key.usage)}`;
}

export function renderFirecrawlQuota(
  team: FirecrawlTeamQuotaSnapshot | null,
  historical: FirecrawlHistoricalQuotaSnapshot | null,
): string {
  if (!team) return "Not synced";

  const metrics = getFirecrawlQuotaMetrics(team, historical);
  if (!metrics) {
    return "Not synced";
  }
  return `${formatNumber(metrics.usedCredits)}/${formatNumber(metrics.remainingCredits)}`;
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
  const [isNoteOpen, setIsNoteOpen] = useState(false);
  const [isMoreActionsOpen, setIsMoreActionsOpen] = useState(false);

  useEffect(() => {
    setNoteDraft(props.item.note);
    setIsNoteOpen(false);
  }, [props.item.note]);

  const quotaText = props.item.provider === "tavily"
    ? renderTavilyQuota(props.item, props.item.quota?.tavily?.account ?? null)
    : renderFirecrawlQuota(
        props.item.quota?.firecrawl?.team ?? null,
        props.item.quota?.firecrawl?.historical ?? null,
      );

  return (
    <article 
      className={`compact-key-card ${props.selected ? "key-card-selected" : ""}`}
      onClick={() => props.onToggleSelected(props.item.id)}
      style={{ cursor: 'pointer' }}
    >
      {/* Row 1: Status, Key, Inline Icons */}
      <div className="compact-row-upper">
        
        {(() => {
          if (!props.item.enabled) {
            return <span className="status-pill danger" style={{ padding: '0.15rem 0.5rem', borderRadius: '12px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><XCircle size={12}/> Disabled</span>;
          }
          if (props.item.healthStatus === "unhealthy") {
            return <span className="status-pill danger" style={{ padding: '0.15rem 0.5rem', borderRadius: '12px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><AlertCircle size={12}/> Error</span>;
          }
          return <span className="status-pill positive" style={{ padding: '0.15rem 0.5rem', borderRadius: '12px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(56, 178, 102, 0.15)', color: '#4ADE80', border: 'none' }}><CheckCircle size={12}/> Active</span>;
        })()}

        <span className="compact-key-string" title={`Fingerprint: ${props.item.fingerprint}`}>
          {props.revealedValue ?? props.item.maskedValue}
        </span>

        <div style={{ display: 'flex', gap: '0.15rem' }}>
          <button className="tiny-icon-btn" title="Edit Note" onClick={(e) => { e.stopPropagation(); setIsNoteOpen(!isNoteOpen); }}>
             <Edit2 size={13} />
          </button>
          <button className="tiny-icon-btn" disabled={props.isRevealing} title={props.revealedValue ? "Hide Key" : "Reveal Key"} onClick={(e) => { e.stopPropagation(); props.onToggleReveal(props.item.id); }}>
             {props.isRevealing ? <InlineSpinner label=""/> : props.revealedValue ? <EyeOff size={13} /> : <Eye size={13} />}
          </button>
          <button className="tiny-icon-btn" disabled={props.isCopying || props.isRevealing} title="Copy Key" onClick={(e) => { e.stopPropagation(); props.onCopy(props.item.id); }}>
             {props.isCopying ? <InlineSpinner label=""/> : <Copy size={13} />}
          </button>
        </div>
      </div>

      {/* Row 2: Metrics OR Note Editor */}
      <div className="compact-row-lower">
        {isNoteOpen ? (
          <div style={{ display: 'flex', gap: '0.4rem', width: '100%', alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
            <input
              style={{ flex: 1, padding: '0.2rem 0.5rem', fontSize: '0.8rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)' }}
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              placeholder="Add note... (Press Enter to save)"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !props.isSavingNote) {
                  props.onSaveNote(props.item.id, noteDraft);
                  setIsNoteOpen(false);
                } else if (e.key === 'Escape') {
                  setNoteDraft(props.item.note);
                  setIsNoteOpen(false);
                }
              }}
            />
            <button className="text-action-link primary" disabled={props.isSavingNote} onClick={(e) => { e.stopPropagation(); props.onSaveNote(props.item.id, noteDraft); setIsNoteOpen(false); }}>Save</button>
            <button className="text-action-link neutral" onClick={(e) => { e.stopPropagation(); setNoteDraft(props.item.note); setIsNoteOpen(false); }}>Cancel</button>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <span title="Requests" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <Activity size={12} /> <strong>{formatNumber(props.item.requestCount)}</strong>
              </span>
              <span title="Failures" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: props.item.failureCount > 0 ? 'var(--danger)' : 'inherit' }}>
                <AlertCircle size={12} /> <strong>{formatNumber(props.item.failureCount)}</strong>
              </span>
              <span title={`Used (Created: ${formatDateTime(props.item.createdAt)})`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <Clock size={12} /> {formatDateTime(props.item.lastUsedAt)}
              </span>
              <span
                title={props.item.provider === "firecrawl" ? "Used / Remaining" : "Quota"}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              >
                <Database size={12} /> {quotaText}
              </span>
              {props.item.note && (
                <>
                   <span style={{ color: 'var(--border)', userSelect: 'none' }}>|</span>
                   <span style={{ color: 'rgba(0, 229, 255, 0.8)', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '3px' }}><Edit2 size={10}/> {props.item.note}</span>
                </>
              )}
            </div>
            <div style={{ flex: 1 }} />
            
            <div style={{ display: 'flex', gap: '0.1rem' }}>
              {!isMoreActionsOpen ? (
                <button className="text-action-link neutral" onClick={(e) => { e.stopPropagation(); setIsMoreActionsOpen(true); }} style={{ padding: '0 0.2rem' }}>
                  <MoreHorizontal size={14} />
                </button>
              ) : (
                <>
                   <button className="text-action-link primary" disabled={props.isTesting} onClick={(e) => { e.stopPropagation(); props.onTest([props.item.id]); }}>Test</button>
                   <button className="text-action-link neutral" disabled={props.isSyncing} onClick={(e) => { e.stopPropagation(); props.onSyncQuota([props.item.id]); }}>Sync</button>
                   <button className="text-action-link neutral" disabled={props.isTogglingEnabled} onClick={(e) => { e.stopPropagation(); props.onToggleEnabled(props.item.id, !props.item.enabled); }}>{props.item.enabled ? "Disable" : "Enable"}</button>
                   <button className="text-action-link danger" disabled={props.isDeleting} onClick={(e) => { e.stopPropagation(); props.onDelete([props.item.id]); }}>Delete</button>
                   <button className="text-action-link neutral" onClick={(e) => { e.stopPropagation(); setIsMoreActionsOpen(false); }}>Less</button>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* Row 3 (Optional Error Context) */}
      {(props.item.lastError || props.item.lastCheckError) && !isNoteOpen && (
        <p className="supporting compact key-card-error" style={{ padding: '0.2rem 0.5rem', margin: '0', fontSize: '0.75rem' }}>
          {props.item.lastCheckError ?? props.item.lastError}
        </p>
      )}
    </article>
  );
}
