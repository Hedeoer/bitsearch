import type {
  KeyListStatus,
  KeyPoolProvider,
  KeyPoolSummary,
  ProviderKeyRecord,
} from "@shared/contracts";
import { formatNumber } from "../format";
import type { KeySortMode } from "../types";
import { EmptyState, InlineSpinner, LoadingOverlay } from "./Feedback";
import {
  KeyInventoryCard,
  renderFirecrawlQuota,
} from "./KeyInventoryCard";
import { Database, Trash2, RefreshCw, FlaskConical, Power, CheckSquare, Square } from "lucide-react";

type KeyInventoryPanelProps = {
  provider: KeyPoolProvider;
  keys: ProviderKeyRecord[];
  summary: KeyPoolSummary | null;
  query: string;
  tag: string;
  status: KeyListStatus;
  selectedIds: string[];
  revealedValues: Record<string, string>;
  loading: boolean;
  isBatchDeleting: boolean;
  isBatchSyncing: boolean;
  isBatchTesting: boolean;
  isBulkUpdating: boolean;
  copyingIds: ReadonlySet<string>;
  deletingIds: ReadonlySet<string>;
  revealingIds: ReadonlySet<string>;
  savingNoteIds: ReadonlySet<string>;
  syncingIds: ReadonlySet<string>;
  sortMode: KeySortMode;
  testingIds: ReadonlySet<string>;
  togglingIds: ReadonlySet<string>;
  onQueryChange: (value: string) => void;
  onDisableSelected: () => void;
  onEnableSelected: () => void;
  onJumpToImport: () => void;
  onResetFilters: () => void;
  onTagChange: (value: string) => void;
  onStatusChange: (value: KeyListStatus) => void;
  onSortChange: (value: KeySortMode) => void;
  onToggleSelected: (id: string) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onDeleteSelected: () => void;
  onSyncSelected: () => void;
  onTestSelected: () => void;
  onToggleReveal: (id: string) => void;
  onCopy: (id: string) => void;
  onSaveNote: (id: string, note: string) => void;
  onDelete: (ids: string[]) => void;
  onToggleEnabled: (id: string, enabled: boolean) => void;
  onTest: (ids: string[]) => void;
  onSyncQuota: (ids: string[]) => void;
};

function renderSummaryQuota(summary: KeyPoolSummary | null): string {
  if (!summary) {
    return "...";
  }
  if (summary.provider === "tavily" && summary.tavily) {
    const base = `${formatNumber(summary.tavily.totalKeyUsage)} / ${formatNumber(summary.tavily.totalKeyLimit)} credits`;
    if (!summary.tavily.account) {
      return base;
    }
    return `${base} · ${summary.tavily.account.currentPlan ?? "plan"} ${formatNumber(summary.tavily.account.planUsage)} / ${formatNumber(summary.tavily.account.planLimit)}`;
  }
  if (summary.provider === "firecrawl") {
    return renderFirecrawlQuota(summary.firecrawl?.team ?? null, null);
  }
  return "Not synced";
}

function SummaryCards(props: { summary: KeyPoolSummary | null; loading: boolean }) {
  const s = props.summary;
  const loading = props.loading;
  return (
    <div className="key-summary-grid">
      <div className="key-summary-card">
        <span>Keys</span>
        <strong>{loading ? "..." : formatNumber(s?.totalKeys ?? 0)}</strong>
      </div>
      <div className="key-summary-card">
        <span>Healthy</span>
        <strong>{loading ? "..." : formatNumber(s?.healthyKeys ?? 0)}</strong>
      </div>
      <div className="key-summary-card">
        <span>Enabled</span>
        <strong>{loading ? "..." : formatNumber(s?.enabledKeys ?? 0)}</strong>
      </div>
      <div className="key-summary-card">
        <span>Req / Fail</span>
        <strong>
          {loading
            ? "..."
            : `${formatNumber(s?.totalRequests ?? 0)} / ${formatNumber(s?.totalFailures ?? 0)}`}
        </strong>
      </div>
      <div className="key-summary-card">
        <span>Quota</span>
        <strong>{loading ? "..." : renderSummaryQuota(s)}</strong>
      </div>
      {s?.quotaNote ? (
        <p className="warning-banner compact key-summary-note">{s.quotaNote}</p>
      ) : null}
      {loading ? <LoadingOverlay label="Refreshing" /> : null}
    </div>
  );
}

export function KeyInventoryPanel(props: KeyInventoryPanelProps) {
  const hasActiveFilters =
    props.status !== "all" || props.tag.length > 0 || props.query.trim().length > 0;

  return (
    <article className="surface-card key-inventory-panel">
      <div className="section-heading">
        <div>
          <div className="eyebrow">Inventory</div>
          <h3>{props.provider} Keys</h3>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span className="chip neutral-chip">{props.selectedIds.length} selected</span>
          <Database size={16} className="section-icon" />
        </div>
      </div>
      <SummaryCards loading={props.loading} summary={props.summary} />
      <div className="sticky-toolbar">
        <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", flexWrap: "wrap" }}>
          <div className="selection-summary">
            {props.selectedIds.length} selected
          </div>
          <button className="secondary-button key-action-button" disabled={props.isBulkUpdating} onClick={props.onEnableSelected}>
            <Power size={12} /> Enable
          </button>
          <button className="secondary-button key-action-button" disabled={props.isBulkUpdating} onClick={props.onDisableSelected}>
            <Power size={12} /> Disable
          </button>
          <span className="toolbar-separator" aria-hidden="true" />
          <button className="primary-button key-action-button" disabled={props.isBatchTesting} onClick={props.onTestSelected}>
            {props.isBatchTesting ? <InlineSpinner label="Testing" /> : <><FlaskConical size={12} /> Test</>}
          </button>
          <button className="secondary-button key-action-button" disabled={props.isBatchSyncing} onClick={props.onSyncSelected}>
            {props.isBatchSyncing ? <InlineSpinner label="Syncing" /> : <><RefreshCw size={12} /> Sync</>}
          </button>
          <span className="toolbar-separator" aria-hidden="true" />
          <button className="danger-button key-action-button" disabled={props.isBatchDeleting} onClick={props.onDeleteSelected}>
            {props.isBatchDeleting ? <InlineSpinner label="" /> : <><Trash2 size={12} /> Delete</>}
          </button>
          <button className="secondary-button key-action-button" onClick={props.onSelectAll}>
            <CheckSquare size={12} /> All
          </button>
          <button className="secondary-button key-action-button" onClick={props.onClearSelection}>
            <Square size={12} /> Clear
          </button>
        </div>
        <div className="inventory-filters">
          <label className="field inventory-field">
            <span>Status</span>
            <select value={props.status} onChange={(event) => props.onStatusChange(event.target.value as KeyListStatus)}>
              <option value="all">all</option>
              <option value="enabled">enabled</option>
              <option value="disabled">disabled</option>
              <option value="healthy">healthy</option>
              <option value="unhealthy">unhealthy</option>
            </select>
          </label>
          <label className="field inventory-field">
            <span>Tag</span>
            <select value={props.tag} onChange={(event) => props.onTagChange(event.target.value)}>
              <option value="">all tags</option>
              {(props.summary?.tags ?? []).map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
          <label className="field inventory-field">
            <span>Sort</span>
            <select value={props.sortMode} onChange={(event) => props.onSortChange(event.target.value as KeySortMode)}>
              <option value="requests_desc">Requests high to low</option>
              <option value="requests_asc">Requests low to high</option>
              <option value="failures_desc">Failures high to low</option>
              <option value="last_used_desc">Last used newest first</option>
              <option value="quota_remaining_desc">Quota remaining high to low</option>
            </select>
          </label>
          <label className="field inventory-field inventory-search-field">
            <span>Search</span>
            <input
              value={props.query}
              onChange={(event) => props.onQueryChange(event.target.value)}
              placeholder="Search key / fingerprint / note"
            />
          </label>
        </div>
      </div>
      {props.keys.length === 0 ? (
        <EmptyState
          actionLabel={hasActiveFilters ? "Clear filters" : "Import your first key"}
          description={hasActiveFilters
            ? "No keys match the current filters. Clear the filters or adjust the query to continue."
            : "No keys have been imported for this provider yet. Start by importing one or more keys."}
          onAction={hasActiveFilters ? props.onResetFilters : props.onJumpToImport}
          title={hasActiveFilters ? "No matching keys" : "No keys imported yet"}
        />
      ) : null}
      <div className="key-grid">
        {props.keys.map((item) => (
          <KeyInventoryCard
            key={item.id}
            isCopying={props.copyingIds.has(item.id)}
            isDeleting={props.deletingIds.has(item.id)}
            item={item}
            revealedValue={props.revealedValues[item.id]}
            isRevealing={props.revealingIds.has(item.id)}
            isSavingNote={props.savingNoteIds.has(item.id)}
            selected={props.selectedIds.includes(item.id)}
            isSyncing={props.syncingIds.has(item.id)}
            isTesting={props.testingIds.has(item.id)}
            isTogglingEnabled={props.togglingIds.has(item.id)}
            onToggleSelected={props.onToggleSelected}
            onToggleReveal={props.onToggleReveal}
            onCopy={props.onCopy}
            onSaveNote={props.onSaveNote}
            onDelete={props.onDelete}
            onToggleEnabled={props.onToggleEnabled}
            onTest={props.onTest}
            onSyncQuota={props.onSyncQuota}
          />
        ))}
      </div>
    </article>
  );
}
