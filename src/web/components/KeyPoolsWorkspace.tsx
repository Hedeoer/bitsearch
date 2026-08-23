import { Upload, Download, Key, Database, Trash2, RefreshCw, FlaskConical, Power, CheckSquare, XSquare, Activity, AlertTriangle, Search, X } from "lucide-react";
import { useState, useEffect } from "react";

const PAGE_SIZE = 16;
import type { ToastTone } from "./Feedback";
import { ConfirmDialog, InlineSpinner, LoadingOverlay, EmptyState } from "./Feedback";
import { formatNumber, formatDateTime } from "../format";
import type { KeySortMode } from "../types";
import { KeyInventoryCard } from "./KeyInventoryCard";
import type { KeyListStatus, KeyPoolSummary, KeyPoolProvider } from "@shared/contracts";
import { KeyPoolProviderPicker } from "./KeyPoolProviderPicker";
import { useKeyWorkspace } from "./useKeyWorkspace";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

function renderSummaryQuota(summary: KeyPoolSummary | null): string {
  if (!summary) return "...";
  if (summary.provider === "tavily" && summary.tavily) {
    const base = `${formatNumber(summary.tavily.totalKeyUsage)} / ${formatNumber(summary.tavily.totalKeyLimit)} credits`;
    if (!summary.tavily.account) return base;
    return `${base} · ${summary.tavily.account.currentPlan ?? "plan"} ${formatNumber(summary.tavily.account.planUsage)} / ${formatNumber(summary.tavily.account.planLimit)}`;
  }
  if (summary.provider === "firecrawl") {
    const firecrawl = summary.firecrawl;
    if (!firecrawl) return "Not synced";
    return `${formatNumber(firecrawl.totalUsedCredits)}/${formatNumber(firecrawl.totalRemainingCredits)}`;
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
  if (summary.provider === "firecrawl" && summary.firecrawl) {
    if (summary.firecrawl.totalCredits > 0) {
      return summary.firecrawl.totalUsedCredits / summary.firecrawl.totalCredits;
    }
  }
  return null;
}

function QuotaBar({ percentage }: { percentage: number | null }) {
  if (percentage === null) return null;
  const p = Math.max(0, Math.min(100, percentage * 100)); // clamp to 0-100
  const isDanger = p >= 85;
  const isWarning = p >= 70 && p < 85;

  const barColor = isDanger ? 'var(--danger)' : isWarning ? 'var(--warning)' : '#00e5ff';

  return (
    <div style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden', marginTop: '0.6rem', width: '100%', border: '1px solid rgba(255,255,255,0.05)' }}>
      <div style={{
        height: '100%',
        width: `${p}%`,
        background: barColor,
        boxShadow: `0 0 10px ${barColor}44`,
        transition: 'width 0.4s ease-out'
      }} />
    </div>
  );
}

function SummaryCards(props: { summary: KeyPoolSummary | null; loading: boolean }) {
  const s = props.summary;
  const loading = props.loading;
  const [isAlertClosed, setIsAlertClosed] = useState(false);
  
  const issues = (s?.totalKeys ?? 0) - (s?.healthyKeys ?? 0);
  const quotaPercent = computeQuotaPercentage(s);
  
  return (
    <div className="key-summary-grid">
      {/* 1. Consolidated Keys Card */}
      <div className="key-summary-card">
        <div className="stat-icon-tile" style={{ color: '#00e5ff' }}>
          <Key size={20} />
        </div>
        <div className="stat-content">
          <span>Total Keys</span>
          <strong>{loading ? "..." : formatNumber(s?.totalKeys ?? 0)}</strong>
          {!loading && (
            <div className="stat-subtext">
              <span className="highlight">{formatNumber(s?.healthyKeys ?? 0)} Healthy</span>
              <span className={issues > 0 ? "danger" : ""}>{formatNumber(issues)} Issues</span>
            </div>
          )}
        </div>
      </div>

      {/* 2. Req / Fail Card */}
      <div className="key-summary-card">
        <div className="stat-icon-tile" style={{ color: '#ffcc00' }}>
          <Activity size={20} />
        </div>
        <div className="stat-content">
          <span>Req / Fail</span>
          <strong>{loading ? "..." : `${formatNumber(s?.totalRequests ?? 0)} / ${formatNumber(s?.totalFailures ?? 0)}`}</strong>
          {!loading && s?.totalRequests ? (
            <div className="stat-subtext">
              Success Rate: <span className="highlight">{((1 - (s.totalFailures / s.totalRequests)) * 100).toFixed(1)}%</span>
            </div>
          ) : null}
        </div>
      </div>

      {/* 3. Quota Card */}
      <div className="key-summary-card">
        <div className="stat-icon-tile" style={{ color: '#a855f7' }}>
          <Database size={20} />
        </div>
        <div className="stat-content">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span>Quota</span>
            {quotaPercent !== null && !loading && (
              <span style={{ fontSize: '0.7rem', color: '#a855f7', fontWeight: 700 }}>
                {(quotaPercent * 100).toFixed(1)}% Used
              </span>
            )}
          </div>
          <strong style={{ fontSize: '0.85rem' }}>{loading ? "..." : renderSummaryQuota(s)}</strong>
          {!loading && <QuotaBar percentage={quotaPercent} />}
        </div>
      </div>

      {s?.quotaNote && !isAlertClosed ? (
        <div className="key-summary-note info-alert">
          <AlertTriangle size={16} style={{ color: 'var(--primary-strong)' }} />
          <p style={{ margin: 0, paddingRight: '1.5rem' }}>{s.quotaNote}</p>
          <button className="alert-close" onClick={() => setIsAlertClosed(true)} title="Close">
            <X size={14} />
          </button>
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
  const [currentPage, setCurrentPage] = useState(1);
  const hasActiveFilters = workspace.status !== "all" || workspace.tag.length > 0 || workspace.query.trim().length > 0;

  useEffect(() => {
    setCurrentPage(1);
  }, [workspace.keys.length]);

  const totalPages = Math.ceil(workspace.keys.length / PAGE_SIZE);
  const pagedKeys = workspace.keys.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <>
      <section className="page-panel">
        <article className="surface-card key-inventory-panel" id="keys">
          {workspace.loading ? <LoadingOverlay label="Refreshing workspace" /> : null}

          {/* 1. Combined Header & Overview */}
          <div className="section-heading" style={{ marginBottom: '1rem', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'center' }}>
              <div>
                <div className="eyebrow">Key Pools</div>
                <h3>{workspace.provider} Workspace</h3>
              </div>
              <div className="key-pool-provider-inline-picker">
                <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontWeight: 500 }}>Provider:</span>
                <KeyPoolProviderPicker
                  value={workspace.provider as KeyPoolProvider}
                  onChange={(provider) => workspace.setProvider(provider)}
                />
                {/*
                  Native select menus render with browser/system colors. Use a themed picker
                  here so the options menu matches the rest of the console.
                */}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <Button className="min-h-9 px-3" type="button" onClick={() => setIsImportOpen(true)}>
                <Upload className="size-3.5" />
                Manage & Import
              </Button>
            </div>
          </div>
          
          <SummaryCards loading={workspace.loading} summary={workspace.summary} />



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
              <Button aria-label="Select all visible keys" className="size-8" size="icon" type="button" variant="ghost" onClick={workspace.selectAllVisible}>
                <CheckSquare className="size-4" />
              </Button>
              
              <div className="search-container">
                 <Search size={14} color="var(--text-dim)" />
                 <Input
                    value={workspace.query}
                    onChange={(event) => workspace.setQuery(event.target.value)}
                    placeholder="Search key / fingerprint / note"
                 />
              </div>

              <Select value={workspace.status} onValueChange={(value) => workspace.setStatus(value as KeyListStatus)}>
                <SelectTrigger aria-label="Filter key status" className="h-8 w-[140px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">Status: All</SelectItem><SelectItem value="enabled">Status: Enabled</SelectItem><SelectItem value="disabled">Status: Disabled</SelectItem><SelectItem value="healthy">Status: Healthy</SelectItem><SelectItem value="unhealthy">Status: Unhealthy</SelectItem></SelectContent>
              </Select>
              <Select value={workspace.tag || "all"} onValueChange={(value) => workspace.setTag(value === "all" ? "" : value)}>
                <SelectTrigger aria-label="Filter key tag" className="h-8 w-[130px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tag: All tags</SelectItem>
                  {(workspace.summary?.tags ?? []).map((item) => (<SelectItem key={item} value={item}>Tag: {item}</SelectItem>))}
                </SelectContent>
              </Select>
              <Select value={workspace.sortMode} onValueChange={(value) => workspace.setSortMode(value as KeySortMode)}>
                <SelectTrigger aria-label="Sort keys" className="h-8 w-[170px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="requests_desc">Sort: High Requests</SelectItem><SelectItem value="requests_asc">Sort: Low Requests</SelectItem><SelectItem value="failures_desc">Sort: High Failures</SelectItem><SelectItem value="last_used_desc">Sort: Recently Used</SelectItem><SelectItem value="quota_remaining_desc">Sort: High Quota</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="bulk-action-bar">
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <Button aria-label="Cancel selection" className="size-7" size="icon" type="button" variant="ghost" onClick={workspace.clearSelection}>
                  <XSquare className="size-4" />
                </Button>
                <span style={{ fontWeight: 600, color: "rgba(0, 229, 255, 0.9)", fontSize: "0.85rem" }}>{workspace.selectedIds.length} Keys Selected</span>
              </div>

              <div style={{ flex: 1 }} />

              <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", flexWrap: "wrap" }}>
                <Button className="min-h-8 px-3 text-xs" disabled={workspace.isBatchTesting} type="button" variant="default" onClick={() => void workspace.testSelectedKeys()}>
                  {workspace.isBatchTesting ? <InlineSpinner label="" /> : <><FlaskConical className="size-3.5" /> Test</>}
                </Button>
                <Button className="min-h-8 px-3 text-xs" disabled={workspace.isBatchSyncing} type="button" variant="secondary" onClick={() => void workspace.syncSelectedKeys()}>
                  {workspace.isBatchSyncing ? <InlineSpinner label="" /> : <><RefreshCw className="size-3.5" /> Sync</>}
                </Button>
                <span className="toolbar-separator" aria-hidden="true" />
                <Button className="min-h-8 px-3 text-xs" disabled={workspace.isBulkUpdating} type="button" variant="secondary" onClick={() => void workspace.enableSelectedKeys()}>
                  <Power className="size-3.5" /> Enable
                </Button>
                <Button className="min-h-8 px-3 text-xs" disabled={workspace.isBulkUpdating} type="button" variant="secondary" onClick={() => void workspace.disableSelectedKeys()}>
                  <Power className="size-3.5" /> Disable
                </Button>
                <span className="toolbar-separator" aria-hidden="true" />
                <Button className="min-h-8 px-3 text-xs" disabled={workspace.isBatchDeleting} type="button" variant="destructive" onClick={workspace.deleteSelectedKeys}>
                  {workspace.isBatchDeleting ? <InlineSpinner label="" /> : <><Trash2 className="size-3.5" /> Delete</>}
                </Button>
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
          <div>
            <Table className="table-fixed">
              <TableBody>
                {pagedKeys.map((item) => (
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
              </TableBody>
            </Table>
          </div>
          {totalPages > 1 && (
            <div className="key-pagination">
              <span className="key-pagination-info">
                {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, workspace.keys.length)} of {workspace.keys.length}
              </span>
              <div className="key-pagination-controls">
                <button
                  className="key-pagination-btn"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => p - 1)}
                >
                  ‹
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                  .reduce<(number | string)[]>((acc, p, idx, arr) => {
                    if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push(`ellipsis-${p}`);
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((item) =>
                    typeof item === "string" ? (
                      <span key={item} className="key-pagination-ellipsis">…</span>
                    ) : (
                      <button
                        key={item}
                        className={`key-pagination-btn${item === currentPage ? " key-pagination-btn--active" : ""}`}
                        onClick={() => setCurrentPage(item)}
                      >
                        {item}
                      </button>
                    )
                  )
                }
                <button
                  className="key-pagination-btn"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(p => p + 1)}
                >
                  ›
                </button>
              </div>
            </div>
          )}
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

      <Dialog onOpenChange={(open) => !workspace.isImporting && setIsImportOpen(open)} open={isImportOpen}>
        <DialogContent className="sm:max-w-[540px]">
          <DialogHeader>
            <DialogTitle>Manage & Import Keys</DialogTitle>
            <DialogDescription>Paste your {workspace.provider} API keys below to add them to your pool.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="import-tags">Import tags</Label>
              <Input disabled={workspace.isImporting} id="import-tags" placeholder="search, production, backup" value={workspace.importTags} onChange={(event) => workspace.setImportTags(event.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="raw-keys">Paste keys</Label>
              <Textarea className="font-mono" disabled={workspace.isImporting} id="raw-keys" placeholder="One API key per line" rows={6} value={workspace.rawKeys} onChange={(event) => workspace.setRawKeys(event.target.value)} />
            </div>
            <p className="text-xs text-muted-foreground">Last quota sync: {formatDateTime(workspace.summary?.quotaSyncedAt ?? null)}</p>
          </div>
          <DialogFooter className="justify-between sm:justify-between">
            <Button asChild variant="secondary"><a href={`/api/admin/keys/export.csv?provider=${workspace.provider}`}><Download className="size-4" /> Export CSV</a></Button>
            <div className="flex gap-3">
              <Button disabled={workspace.isImporting} type="button" variant="ghost" onClick={() => setIsImportOpen(false)}>Cancel</Button>
              <Button disabled={workspace.isImporting} type="button" onClick={async () => {
                const success = await workspace.importKeys();
                if (success) setIsImportOpen(false);
              }}>
                {workspace.isImporting ? <InlineSpinner label="Importing" /> : <><Upload className="size-4" /> Import Keys</>}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
