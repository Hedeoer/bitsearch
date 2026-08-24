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
import { Badge } from "@/components/ui/badge";
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
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableHead, TableHeader } from "@/components/ui/table";
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
  return <Progress aria-label={`Quota used ${p.toFixed(1)}%`} className="mt-2" value={p} />;
}

function SummaryCards(props: { summary: KeyPoolSummary | null; loading: boolean }) {
  const s = props.summary;
  const loading = props.loading;
  const [isAlertClosed, setIsAlertClosed] = useState(false);
  
  const issues = (s?.totalKeys ?? 0) - (s?.healthyKeys ?? 0);
  const quotaPercent = computeQuotaPercentage(s);
  const quotaVariant = quotaPercent !== null && quotaPercent >= 0.85
    ? "danger"
    : quotaPercent !== null && quotaPercent >= 0.7
      ? "warning"
      : "default";
  
  return (
    <div className="grid gap-3 md:grid-cols-3">
      <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
        <div className="flex items-start gap-3">
          <div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><Key className="size-5" /></div>
          <div className="min-w-0">
            <span className="text-xs font-medium text-muted-foreground">Total Keys</span>
            <strong className="mt-1 block text-xl font-semibold">{loading ? "..." : formatNumber(s?.totalKeys ?? 0)}</strong>
            {!loading ? <div className="mt-1 flex gap-2 text-xs"><Badge className="px-2 py-0.5" variant="success">{formatNumber(s?.healthyKeys ?? 0)} Healthy</Badge><Badge className="px-2 py-0.5" variant={issues > 0 ? "danger" : "neutral"}>{formatNumber(issues)} Issues</Badge></div> : null}
          </div>
        </div>
      </div>
      <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
        <div className="flex items-start gap-3">
          <div className="grid size-10 place-items-center rounded-xl bg-warning/10 text-warning"><Activity className="size-5" /></div>
          <div className="min-w-0">
            <span className="text-xs font-medium text-muted-foreground">Req / Fail</span>
            <strong className="mt-1 block text-xl font-semibold">{loading ? "..." : `${formatNumber(s?.totalRequests ?? 0)} / ${formatNumber(s?.totalFailures ?? 0)}`}</strong>
            {!loading && s?.totalRequests ? <p className="mt-1 text-xs text-muted-foreground">Success rate <span className="font-semibold text-primary">{((1 - (s.totalFailures / s.totalRequests)) * 100).toFixed(1)}%</span></p> : null}
          </div>
        </div>
      </div>
      <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
        <div className="flex items-start gap-3">
          <div className="grid size-10 place-items-center rounded-xl bg-accent text-accent-foreground"><Database className="size-5" /></div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2"><span className="text-xs font-medium text-muted-foreground">Quota</span>{quotaPercent !== null && !loading ? <Badge className="px-2 py-0.5" variant={quotaVariant}>{(quotaPercent * 100).toFixed(1)}% used</Badge> : null}</div>
            <strong className="mt-1 block truncate text-sm font-semibold">{loading ? "..." : renderSummaryQuota(s)}</strong>
            {!loading ? <QuotaBar percentage={quotaPercent} /> : null}
          </div>
        </div>
      </div>

      {s?.quotaNote && !isAlertClosed ? (
        <div className="relative col-span-full flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2.5 text-sm text-muted-foreground">
          <AlertTriangle className="size-4 shrink-0 text-primary" />
          <p className="m-0 pr-8">{s.quotaNote}</p>
          <Button aria-label="Close quota notice" className="absolute right-2 top-1/2 size-7 -translate-y-1/2" size="icon" type="button" variant="ghost" onClick={() => setIsAlertClosed(true)}><X className="size-3.5" /></Button>
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
      <section className="grid gap-5">
        <article className="relative grid gap-4 rounded-xl border border-border/70 bg-card p-4 shadow-xs sm:p-5" id="keys">
          {workspace.loading ? <LoadingOverlay label="Refreshing workspace" /> : null}

          {/* 1. Combined Header & Overview */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <h2 className="text-lg font-semibold tracking-tight">{workspace.provider} Workspace</h2>
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-muted/20 px-2.5 py-1.5">
                <span className="text-xs font-medium text-muted-foreground">Provider:</span>
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
            <div className="flex items-center gap-3">
              <Button className="min-h-9 px-3" type="button" onClick={() => setIsImportOpen(true)}>
                <Upload className="size-3.5" />
                Manage & Import
              </Button>
            </div>
          </div>
          
          <SummaryCards loading={workspace.loading} summary={workspace.summary} />



          <div className="h-1" />

          {/* 3. Key Inventory */}
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold tracking-tight">Key Inventory</h2>
            </div>
            <div className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary">
              <Database className="size-4" />
            </div>
          </div>

          {workspace.selectedIds.length === 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button aria-label="Select all visible keys" className="size-8" size="icon" type="button" variant="ghost" onClick={workspace.selectAllVisible}>
                <CheckSquare className="size-4" />
              </Button>
              
              <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={workspace.query}
                  onChange={(event) => workspace.setQuery(event.target.value)}
                  placeholder="Search key / fingerprint / note"
                  className="pl-9"
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
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/10 px-3 py-2">
              <div className="flex items-center gap-2">
                <Button aria-label="Cancel selection" className="size-7" size="icon" type="button" variant="ghost" onClick={workspace.clearSelection}>
                  <XSquare className="size-4" />
                </Button>
                <span className="text-sm font-semibold text-primary">{workspace.selectedIds.length} Keys Selected</span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <Button className="min-h-8 px-3 text-xs" disabled={workspace.isBatchTesting} type="button" variant="default" onClick={() => void workspace.testSelectedKeys()}>
                  {workspace.isBatchTesting ? <InlineSpinner label="" /> : <><FlaskConical className="size-3.5" /> Test</>}
                </Button>
                <Button className="min-h-8 px-3 text-xs" disabled={workspace.isBatchSyncing} type="button" variant="secondary" onClick={() => void workspace.syncSelectedKeys()}>
                  {workspace.isBatchSyncing ? <InlineSpinner label="" /> : <><RefreshCw className="size-3.5" /> Sync</>}
                </Button>
                <span aria-hidden="true" className="h-6 w-px bg-border/70" />
                <Button className="min-h-8 px-3 text-xs" disabled={workspace.isBulkUpdating} type="button" variant="secondary" onClick={() => void workspace.enableSelectedKeys()}>
                  <Power className="size-3.5" /> Enable
                </Button>
                <Button className="min-h-8 px-3 text-xs" disabled={workspace.isBulkUpdating} type="button" variant="secondary" onClick={() => void workspace.disableSelectedKeys()}>
                  <Power className="size-3.5" /> Disable
                </Button>
                <span aria-hidden="true" className="h-6 w-px bg-border/70" />
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
          <div className="overflow-hidden rounded-xl border border-border/70">
            <Table className="table-fixed">
              <TableHeader>
                <tr className="bg-muted/20">
                  <TableHead className="w-[30%]">Key</TableHead>
                  <TableHead>Usage & quota</TableHead>
                  <TableHead className="w-[168px] text-right">Actions</TableHead>
                </tr>
              </TableHeader>
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
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-3">
              <span className="text-xs text-muted-foreground">
                {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, workspace.keys.length)} of {workspace.keys.length}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  aria-label="Previous page"
                  className="size-8"
                  size="icon"
                  type="button"
                  variant="outline"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => p - 1)}
                >
                  ‹
                </Button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                  .reduce<(number | string)[]>((acc, p, idx, arr) => {
                    if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push(`ellipsis-${p}`);
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((item) =>
                    typeof item === "string" ? (
                      <span key={item} className="px-1 text-sm text-muted-foreground">…</span>
                    ) : (
                      <Button
                        key={item}
                        aria-label={`Page ${item}`}
                        className="size-8"
                        size="icon"
                        type="button"
                        variant={item === currentPage ? "secondary" : "outline"}
                        onClick={() => setCurrentPage(item)}
                      >
                        {item}
                      </Button>
                    )
                  )
                }
                <Button
                  aria-label="Next page"
                  className="size-8"
                  size="icon"
                  type="button"
                  variant="outline"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(p => p + 1)}
                >
                  ›
                </Button>
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
