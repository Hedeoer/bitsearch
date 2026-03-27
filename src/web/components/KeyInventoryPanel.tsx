import type {
  KeyListStatus,
  KeyPoolProvider,
  KeyPoolSummary,
  ProviderKeyRecord,
} from "@shared/contracts";
import { formatNumber } from "../format";
import {
  KeyInventoryCard,
  renderFirecrawlQuota,
} from "./KeyInventoryCard";

type KeyInventoryPanelProps = {
  provider: KeyPoolProvider;
  keys: ProviderKeyRecord[];
  summary: KeyPoolSummary | null;
  query: string;
  tag: string;
  status: KeyListStatus;
  selectedIds: string[];
  revealedValues: Record<string, string>;
  busy: boolean;
  loading: boolean;
  onQueryChange: (value: string) => void;
  onTagChange: (value: string) => void;
  onStatusChange: (value: KeyListStatus) => void;
  onToggleSelected: (id: string) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onBulkToggle: (enabled: boolean) => void;
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
  return "未同步";
}

function SummaryCards(props: { summary: KeyPoolSummary | null; loading: boolean }) {
  return (
    <div className="key-summary-grid">
      <div className="key-summary-card">
        <span>Keys</span>
        <strong>{props.loading ? "..." : formatNumber(props.summary?.totalKeys ?? 0)}</strong>
      </div>
      <div className="key-summary-card">
        <span>Healthy</span>
        <strong>{props.loading ? "..." : formatNumber(props.summary?.healthyKeys ?? 0)}</strong>
      </div>
      <div className="key-summary-card">
        <span>Enabled</span>
        <strong>{props.loading ? "..." : formatNumber(props.summary?.enabledKeys ?? 0)}</strong>
      </div>
      <div className="key-summary-card">
        <span>Requests / Failures</span>
        <strong>
          {props.loading
            ? "..."
            : `${formatNumber(props.summary?.totalRequests ?? 0)} / ${formatNumber(props.summary?.totalFailures ?? 0)}`}
        </strong>
      </div>
      <div className="key-summary-card">
        <span>Quota</span>
        <strong>{props.loading ? "..." : renderSummaryQuota(props.summary)}</strong>
      </div>
      {props.summary?.quotaNote ? (
        <p className="warning-banner compact key-summary-note">{props.summary.quotaNote}</p>
      ) : null}
    </div>
  );
}

export function KeyInventoryPanel(props: KeyInventoryPanelProps) {
  return (
    <article className="surface-card key-inventory-panel">
      <div className="section-heading">
        <div>
          <div className="eyebrow">Inventory</div>
          <h3>{props.provider} Keys</h3>
        </div>
        <span className="chip neutral-chip">
          {props.selectedIds.length} selected
        </span>
      </div>
      <SummaryCards loading={props.loading} summary={props.summary} />
      <div className="inventory-toolbar">
        <div className="inventory-block">
          <div className="eyebrow">Batch Actions</div>
          <div className="toolbar-actions">
            <button className="primary-button" disabled={props.busy} onClick={() => props.onTest(props.selectedIds)}>
              Test Selected
            </button>
            <button className="secondary-button" disabled={props.busy} onClick={() => props.onSyncQuota(props.selectedIds)}>
              Refresh Quota
            </button>
            <button className="secondary-button" disabled={props.busy} onClick={() => props.onDelete(props.selectedIds)}>
              Delete Selected
            </button>
            <button className="secondary-button" disabled={props.busy} onClick={props.onSelectAll}>
              Select Visible
            </button>
            <button className="secondary-button" disabled={props.busy} onClick={props.onClearSelection}>
              Clear
            </button>
          </div>
        </div>
        <div className="inventory-block">
          <div className="eyebrow">Selection State</div>
          <div className="selection-summary">
            {props.selectedIds.length} selected
          </div>
          <div className="toolbar-actions">
            <button className="secondary-button" disabled={props.busy} onClick={() => props.onBulkToggle(true)}>
              Enable
            </button>
            <button className="secondary-button" disabled={props.busy} onClick={() => props.onBulkToggle(false)}>
              Disable
            </button>
          </div>
        </div>
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
        <label className="field inventory-field inventory-search-field">
          <span>Search</span>
          <input
            value={props.query}
            onChange={(event) => props.onQueryChange(event.target.value)}
            placeholder="Search key / fingerprint / note"
          />
        </label>
      </div>
      {props.keys.length === 0 ? (
        <p className="warning-banner compact">No keys match the current filters.</p>
      ) : null}
      <div className="key-grid">
        {props.keys.map((item) => (
          <KeyInventoryCard
            key={item.id}
            busy={props.busy}
            item={item}
            revealedValue={props.revealedValues[item.id]}
            selected={props.selectedIds.includes(item.id)}
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
