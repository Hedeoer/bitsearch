import { useEffect, useState } from "react";
import {
  Activity,
  AlertCircle,
  CheckCircle,
  Clock,
  Copy,
  Database,
  Edit2,
  Eye,
  EyeOff,
  FlaskConical,
  MoreHorizontal,
  Power,
  RefreshCw,
  Trash2,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
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

export function KeyInventoryCard(props: KeyCardProps) {
  const [noteDraft, setNoteDraft] = useState(props.item.note);
  const [isNoteOpen, setIsNoteOpen] = useState(false);

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
      aria-checked={props.selected}
      className={`flex cursor-pointer flex-col gap-2 rounded-xl border p-3 shadow-xs transition-colors duration-150 outline-none hover:border-primary/25 focus-visible:ring-2 focus-visible:ring-ring/50 ${
        props.selected ? "border-primary/25 bg-primary/10" : "border-border/70 bg-card"
      }`}
      onClick={() => props.onToggleSelected(props.item.id)}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          props.onToggleSelected(props.item.id);
        }
      }}
      role="checkbox"
      tabIndex={0}
    >
      {/* Row 1: status badge, masked key, quick actions */}
      <div className="flex items-center gap-2">
        {(() => {
          if (!props.item.enabled) return <Badge variant="danger"><XCircle size={12} /> Disabled</Badge>;
          if (props.item.healthStatus === "unhealthy") return <Badge variant="danger"><AlertCircle size={12} /> Error</Badge>;
          return <Badge variant="success"><CheckCircle size={12} /> Active</Badge>;
        })()}
        <span
          className={`min-w-0 flex-1 font-mono text-xs text-muted-foreground ${props.revealedValue ? "break-all" : "truncate"}`}
          title={`Fingerprint: ${props.item.fingerprint}`}
        >
          {props.revealedValue ?? props.item.maskedValue}
        </span>
        <div className="flex shrink-0 items-center gap-0.5" onClick={(event) => event.stopPropagation()}>
          <Button aria-label="Edit note" className="size-7" size="icon" type="button" variant="ghost" onClick={() => setIsNoteOpen(!isNoteOpen)}>
            <Edit2 className="size-3.5" />
          </Button>
          <Button aria-label={props.revealedValue ? "Hide key" : "Reveal key"} className="size-7" disabled={props.isRevealing} size="icon" type="button" variant="ghost" onClick={() => props.onToggleReveal(props.item.id)}>
            {props.isRevealing ? <InlineSpinner label="" /> : props.revealedValue ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
          </Button>
          <Button aria-label="Copy key" className="size-7" disabled={props.isCopying || props.isRevealing} size="icon" type="button" variant="ghost" onClick={() => props.onCopy(props.item.id)}>
            {props.isCopying ? <InlineSpinner label="" /> : <Copy className="size-3.5" />}
          </Button>
        </div>
      </div>

      {/* Row 2: inline metrics (or note editor) + overflow actions */}
      {isNoteOpen ? (
        <Input
          autoFocus
          className="h-8 font-mono text-xs"
          value={noteDraft}
          onChange={(event) => setNoteDraft(event.target.value)}
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !props.isSavingNote) {
              props.onSaveNote(props.item.id, noteDraft);
              setIsNoteOpen(false);
            } else if (event.key === "Escape") {
              setNoteDraft(props.item.note);
              setIsNoteOpen(false);
            }
          }}
          placeholder="Add note... (Press Enter to save)"
        />
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            <span title="Requests" className="inline-flex items-center gap-1"><Activity size={12} /><strong className="font-mono tabular-nums">{formatNumber(props.item.requestCount)}</strong></span>
            <span title="Failures" className={props.item.failureCount > 0 ? "text-destructive inline-flex items-center gap-1" : "inline-flex items-center gap-1"}>
              <AlertCircle size={12} /><strong className="font-mono tabular-nums">{formatNumber(props.item.failureCount)}</strong>
            </span>
            <span title="Last used" className="inline-flex items-center gap-1"><Clock size={12} />{formatDateTime(props.item.lastUsedAt)}</span>
            <span title="Quota" className="inline-flex items-center gap-1 font-mono tabular-nums"><Database size={12} />{quotaText}</span>
            {props.item.note ? <span className="inline-flex items-center gap-1 text-primary"><Edit2 size={10} />{props.item.note}</span> : null}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button aria-label="Key actions" className="size-7" size="icon" type="button" variant="ghost" onClick={(event) => event.stopPropagation()}>
                <MoreHorizontal className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem disabled={props.isTesting} onSelect={() => props.onTest([props.item.id])}>
                <FlaskConical className="size-3.5" /> Test
              </DropdownMenuItem>
              <DropdownMenuItem disabled={props.isSyncing} onSelect={() => props.onSyncQuota([props.item.id])}>
                <RefreshCw className="size-3.5" /> Sync
              </DropdownMenuItem>
              <DropdownMenuItem disabled={props.isTogglingEnabled} onSelect={() => props.onToggleEnabled(props.item.id, !props.item.enabled)}>
                <Power className="size-3.5" /> {props.item.enabled ? "Disable" : "Enable"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled={props.isDeleting} variant="destructive" onSelect={() => props.onDelete([props.item.id])}>
                <Trash2 className="size-3.5" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {/* Row 3: last error context, only when present */}
      {(props.item.lastError || props.item.lastCheckError) && !isNoteOpen ? (
        <p className="text-xs text-destructive">{props.item.lastCheckError ?? props.item.lastError}</p>
      ) : null}
    </article>
  );
}
