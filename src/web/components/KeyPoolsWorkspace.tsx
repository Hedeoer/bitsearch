import { Upload, Download, Key, Database, Trash2, RefreshCw, FlaskConical, Power, CheckSquare, Square, ChevronDown, ChevronRight, Heart, Activity, CheckCircle, AlertTriangle, Search, XSquare } from "lucide-react";
import { useState } from "react";
import type { ToastTone } from "./Feedback";
import { ConfirmDialog, InlineSpinner, LoadingOverlay, EmptyState } from "./Feedback";
import { formatNumber, formatDateTime } from "../format";
import type { KeySortMode } from "../types";
import { KeyInventoryCard, renderFirecrawlQuota } from "./KeyInventoryCard";
import type { KeyListStatus, KeyPoolSummary } from "@shared/contracts";
import { useKeyWorkspace } from "./useKeyWorkspace";

function renderSummaryQuota(summary: KeyPoolSummary | null): string {
  if (!summary) return "...";
  if (summary.provider === "tavily" && summary.tavily) {
    const base = `${formatNumber(summary.tavily.totalKeyUsage)} / ${formatNumber(summary.tavily.totalKeyLimit)} credits`;
    if (!summary.tavily.account) return base;
    return `${base} · ${summary.tavily.account.currentPlan ?? "plan"} ${formatNumber(summary.tavily.account.planUsage)} / ${formatNumber(summary.tavily.account.planLimit)}`;
  }
  if (summary.provider === "firecrawl") {
    return renderFirecrawlQuota(summary.firecrawl?.team ?? null, null);
  }
  return "Not synced";
}

function computeQuotaPercentage(summary: KeyPoolSummary | null): number | null {
  if (!summary) return null;
  if (summary.provider === "tavily" && summary.tavily) {
    if (summary.tavily.account && summary.tavily.account.planLimit > 0) {
      return summary.tavily.account.planUsage / summary.tavily.account.planLimit;
    }
    if (summary.tavily.totalKeyLimit > 0) {
      return summary.tavily.totalKeyUsage / summary.tavily.totalKeyLimit;
    }
  }
  if (summary.provider === "firecrawl" && summary.firecrawl?.team) {
    if (summary.firecrawl.team.planCredits > 0) {
      const team = summary.firecrawl.team;
      const usage = team.planCredits - team.remainingCredits;
      return usage / team.planCredits;
    }
  }
  return null;
}

function QuotaBar({ percentage }: { percentage: number | null }) {
  if (percentage === null) return null;
  const p = Math.max(0, Math.min(100, percentage * 100)); // clamp to 0-100
  const isDanger = p >= 85;
  const isWarning = p >= 70 && p < 85;
  return (
    <div style={{ height: '3px', background: 'var(--bg-primary)', borderRadius: '4px', overflow: 'hidden', marginTop: '0.45rem', width: '100%', opacity: 0.8 }}>
      <div style={{ height: '100%', width: `${p}%`, background: isDanger ? 'var(--danger)' : isWarning ? 'var(--warning)' : 'var(--primary-strong)' }} />
    </div>
  );
}

function SummaryCards(props: { summary: KeyPoolSummary | null; loading: boolean }) {
  const s = props.summary;
  const loading = props.loading;
  
  const iconStyle = { position: 'absolute' as const, right: '-8px', bottom: '-8px', opacity: 0.04, color: 'var(--primary-strong)' };
  
  return (
    <div className="key-summary-grid">
      <div className="key-summary-card" style={{ display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
        <Key size={48} style={iconStyle} />
        <span>Keys</span>
        <strong>{loading ? "..." : formatNumber(s?.totalKeys ?? 0)}</strong>
      </div>
      <div className="key-summary-card" style={{ display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
        <Heart size={48} style={iconStyle} />
        <span>Healthy</span>
        <strong>{loading ? "..." : formatNumber(s?.healthyKeys ?? 0)}</strong>
      </div>
      <div className="key-summary-card" style={{ display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
        <CheckCircle size={48} style={iconStyle} />
        <span>Enabled</span>
        <strong>{loading ? "..." : formatNumber(s?.enabledKeys ?? 0)}</strong>
      </div>
      <div className="key-summary-card" style={{ display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
        <Activity size={48} style={iconStyle} />
        <span>Req / Fail</span>
        <strong>{loading ? "..." : `${formatNumber(s?.totalRequests ?? 0)} / ${formatNumber(s?.totalFailures ?? 0)}`}</strong>
      </div>
      <div className="key-summary-card" style={{ display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden', justifyContent: 'center' }}>
        <Database size={48} style={iconStyle} />
        <span>Quota</span>
        <strong style={{ position: 'relative', zIndex: 1 }}>{loading ? "..." : renderSummaryQuota(s)}</strong>
        {!loading && <QuotaBar percentage={computeQuotaPercentage(s)} />}
      </div>
      {s?.quotaNote ? (
        <div className="key-summary-note" style={{ display: 'flex', gap: '0.65rem', alignItems: 'center', background: 'rgba(216, 87, 87, 0.08)', border: '1px solid rgba(216, 87, 87, 0.2)', borderLeft: '4px solid rgba(216, 87, 87, 0.6)', padding: '0.75rem 1rem', borderRadius: '8px', color: 'var(--warning-text)', gridColumn: '1 / -1', marginTop: '0.2rem' }}>
          <AlertTriangle size={18} style={{ color: 'rgba(216, 87, 87, 0.8)' }} />
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'rgba(255,255,255,0.85)' }}>{s.quotaNote}</p>
        </div>
      ) : null}
    </div>
  );
}

type KeyPoolsWorkspaceProps = {
  refreshNonce: number;
  onToast: (type: ToastTone, message: string) => void;
};

export function KeyPoolsWorkspace(props: KeyPoolsWorkspaceProps) {
  const workspace = useKeyWorkspace(props.refreshNonce, props.onToast);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const hasActiveFilters = workspace.status !== "all" || workspace.tag.length > 0 || workspace.query.trim().length > 0;

  return (
    <>
      <section className="page-panel">
        <article className="surface-card key-inventory-panel" id="keys">
          {workspace.loading ? <LoadingOverlay label="Refreshing workspace" /> : null}

          {/* 1. Combined Header & Overview */}
          <div className="section-heading" style={{ marginBottom: '1rem' }}>
            <div>
              <div className="eyebrow">Key Pools</div>
              <h3>{workspace.provider} Workspace</h3>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
              <button 
                className={workspace.summary?.totalKeys === 0 ? "primary-button pulse" : "secondary-button"}
                onClick={() => setIsImportOpen(!isImportOpen)}
                style={{ padding: '0.2rem 0.65rem', minHeight: '30px' }}
              >
                {isImportOpen ? <ChevronDown size={14} style={{ marginRight: '4px' }} /> : <ChevronRight size={14} style={{ marginRight: '4px' }} />}
                Manage & Import
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', margin: 0 }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: 0 }}>Provider:</span>
                <select
                  value={workspace.provider}
                  onChange={(event) => workspace.setProvider(event.target.value as any)}
                  style={{ padding: '0.2rem 1.5rem 0.2rem 0.6rem', minHeight: '30px' }}
                >
                  <option value="tavily">Tavily</option>
                  <option value="firecrawl">Firecrawl</option>
                </select>
              </div>
            </div>
          </div>
          
          <SummaryCards loading={workspace.loading} summary={workspace.summary} />

          {/* Collapsible Import / Export */}
          {isImportOpen && (
            <div className="import-panel" style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(255, 255, 255, 0.02)', border: '1px dashed var(--border)', borderRadius: '8px' }}>
              <div className="import-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <label className="field">
                  <span>Import Tags</span>
                  <input
                    value={workspace.importTags}
                    onChange={(event) => workspace.setImportTags(event.target.value)}
                    placeholder="search, production, backup"
                  />
                </label>
              </div>
              <label className="field" style={{ marginTop: '0.85rem' }}>
                <span>Paste Keys</span>
                <textarea
                  rows={4}
                  value={workspace.rawKeys}
                  onChange={(event) => workspace.setRawKeys(event.target.value)}
                  placeholder="One API key per line"
                />
              </label>
              <div className="action-row" style={{ marginTop: '0.85rem', display: 'flex', gap: '0.65rem' }}>
                <button
                  className="primary-button"
                  disabled={workspace.isImporting}
                  onClick={() => void workspace.importKeys()}
                >
                  {workspace.isImporting ? <InlineSpinner label="Importing" /> : <><Upload size={14} /> Import Text</>}
                </button>
                <a
                  className="secondary-button link-button"
                  href={`/api/admin/keys/export.csv?provider=${workspace.provider}`}
                >
                  <Download size={14} /> Export CSV
                </a>
              </div>
              <p className="supporting compact" style={{ marginTop: '0.5rem' }}>
                Last quota sync: {formatDateTime(workspace.summary?.quotaSyncedAt ?? null)}
              </p>
            </div>
          )}

          <div style={{ paddingBottom: '1.25rem' }} />

          {/* 3. Key Inventory */}
          <div className="section-heading" style={{ marginBottom: '0.5rem' }}>
            <div>
              <h3>Key Inventory</h3>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Database size={16} className="section-icon" />
            </div>
          </div>

          {workspace.selectedIds.length === 0 ? (
            <div className="inventory-filters-single-line">
              <button className="tiny-icon-btn" title="Select All" onClick={workspace.selectAllVisible} style={{ padding: '0.4rem', background: 'rgba(255,255,255,0.05)' }}>
                <CheckSquare size={16} />
              </button>
              
              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flex: "1 1 200px", background: "rgba(0,0,0,0.2)", borderRadius: "6px", padding: "0 0.5rem" }}>
                 <Search size={14} color="var(--text-dim)" />
                 <input
                    value={workspace.query}
                    onChange={(event) => workspace.setQuery(event.target.value)}
                    placeholder="Search key / fingerprint / note"
                    style={{ border: "none", background: "transparent", outline: "none", width: "100%", height: "32px", fontSize: "0.85rem", color: "var(--text)" }}
                 />
              </div>

              <select value={workspace.status} onChange={(event) => workspace.setStatus(event.target.value as KeyListStatus)} style={{ height: "32px", fontSize: "0.8rem", borderRadius: "6px", border: "none", background: "rgba(255,255,255,0.05)", outline: 'none', color: 'var(--text)', padding: '0 0.6rem' }}>
                <option value="all">Status: All</option>
                <option value="enabled">Status: Enabled</option>
                <option value="disabled">Status: Disabled</option>
                <option value="healthy">Status: Healthy</option>
                <option value="unhealthy">Status: Unhealthy</option>
              </select>

              <select value={workspace.tag} onChange={(event) => workspace.setTag(event.target.value)} style={{ height: "32px", fontSize: "0.8rem", borderRadius: "6px", border: "none", background: "rgba(255,255,255,0.05)", outline: 'none', color: 'var(--text)', padding: '0 0.6rem' }}>
                <option value="">Tag: All tags</option>
                {(workspace.summary?.tags ?? []).map((item) => (
                  <option key={item} value={item}>Tag: {item}</option>
                ))}
              </select>

              <select value={workspace.sortMode} onChange={(event) => workspace.setSortMode(event.target.value as KeySortMode)} style={{ height: "32px", fontSize: "0.8rem", borderRadius: "6px", border: "none", background: "rgba(255,255,255,0.05)", outline: 'none', color: 'var(--text)', padding: '0 0.6rem' }}>
                <option value="requests_desc">Sort: High Requests</option>
                <option value="requests_asc">Sort: Low Requests</option>
                <option value="failures_desc">Sort: High Failures</option>
                <option value="last_used_desc">Sort: Recently Used</option>
                <option value="quota_remaining_desc">Sort: High Quota</option>
              </select>
            </div>
          ) : (
            <div className="bulk-action-bar">
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <button className="tiny-icon-btn" title="Cancel Selection" onClick={workspace.clearSelection} style={{ padding: "0.2rem", background: 'rgba(0, 229, 255, 0.1)', color: 'var(--primary)' }}>
                  <XSquare size={16} />
                </button>
                <span style={{ fontWeight: 600, color: "rgba(0, 229, 255, 0.9)", fontSize: "0.85rem" }}>{workspace.selectedIds.length} Keys Selected</span>
              </div>

              <div style={{ flex: 1 }} />

              <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", flexWrap: "wrap" }}>
                <button className="primary-button key-action-button" disabled={workspace.isBatchTesting} onClick={() => void workspace.testSelectedKeys()}>
                  {workspace.isBatchTesting ? <InlineSpinner label="" /> : <><FlaskConical size={12} /> Test</>}
                </button>
                <button className="secondary-button key-action-button" disabled={workspace.isBatchSyncing} onClick={() => void workspace.syncSelectedKeys()}>
                  {workspace.isBatchSyncing ? <InlineSpinner label="" /> : <><RefreshCw size={12} /> Sync</>}
                </button>
                <span className="toolbar-separator" aria-hidden="true" />
                <button className="secondary-button key-action-button" disabled={workspace.isBulkUpdating} onClick={() => void workspace.enableSelectedKeys()}>
                  <Power size={12} /> Enable
                </button>
                <button className="secondary-button key-action-button" disabled={workspace.isBulkUpdating} onClick={() => void workspace.disableSelectedKeys()}>
                  <Power size={12} /> Disable
                </button>
                <span className="toolbar-separator" aria-hidden="true" />
                <button className="danger-button key-action-button" disabled={workspace.isBatchDeleting} onClick={workspace.deleteSelectedKeys}>
                  {workspace.isBatchDeleting ? <InlineSpinner label="" /> : <><Trash2 size={12} /> Delete</>}
                </button>
              </div>
            </div>
          )}
          {workspace.keys.length === 0 ? (
            <EmptyState
              actionLabel={hasActiveFilters ? "Clear filters" : "Import your first key"}
              description={hasActiveFilters
                ? "No keys match the current filters. Clear the filters or adjust the query to continue."
                : "No keys have been imported for this provider yet. Start by importing one or more keys."}
              onAction={hasActiveFilters ? workspace.resetFilters : workspace.scrollToImportPanel}
              title={hasActiveFilters ? "No matching keys" : "No keys imported yet"}
            />
          ) : null}
          <div className="key-grid">
            {workspace.keys.map((item) => (
              <KeyInventoryCard
                key={item.id}
                isCopying={workspace.copyingIds.has(item.id)}
                isDeleting={workspace.deletingIds.has(item.id)}
                item={item}
                revealedValue={workspace.revealedValues[item.id]}
                isRevealing={workspace.revealingIds.has(item.id)}
                isSavingNote={workspace.savingNoteIds.has(item.id)}
                selected={workspace.selectedIds.includes(item.id)}
                isSyncing={workspace.syncingIds.has(item.id)}
                isTesting={workspace.testingIds.has(item.id)}
                isTogglingEnabled={workspace.togglingIds.has(item.id)}
                onToggleSelected={workspace.toggleSelected}
                onToggleReveal={(id) => void workspace.toggleReveal(id)}
                onCopy={(id) => void workspace.copyKey(id)}
                onSaveNote={(id, note) => void workspace.saveNote(id, note)}
                onDelete={(ids) => workspace.deleteCardKeys(ids)}
                onToggleEnabled={(id, enabled) => void workspace.toggleCardEnabled([id], enabled)}
                onTest={(ids) => void workspace.testCardKeys(ids)}
                onSyncQuota={(ids) => void workspace.syncCardKeys(ids)}
              />
            ))}
          </div>
        </article>
      </section>
      <ConfirmDialog
        cancelLabel="Cancel"
        confirmLabel="Delete keys"
        danger
        description={workspace.confirmDelete?.description ?? ""}
        onCancel={workspace.cancelDeleteConfirmation}
        onConfirm={() => void workspace.confirmDeleteKeys()}
        open={Boolean(workspace.confirmDelete)}
        pending={workspace.isConfirmingDelete}
        title={workspace.confirmDelete?.title ?? ""}
      />
    </>
  );
}
