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
import { TableRow, TableCell } from "@/components/ui/table";
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
    <TableRow
      aria-selected={props.selected}
      className={props.selected ? "bg-primary/8" : undefined}
      data-state={props.selected ? "selected" : undefined}
      onClick={() => props.onToggleSelected(props.item.id)}
    >
      <TableCell className="min-w-[220px] max-w-[320px] align-top">
        {(() => {
          if (!props.item.enabled) return <Badge variant="danger"><XCircle size={12} /> Disabled</Badge>;
          if (props.item.healthStatus === "unhealthy") return <Badge variant="danger"><AlertCircle size={12} /> Error</Badge>;
          return <Badge variant="success"><CheckCircle size={12} /> Active</Badge>;
        })()}
        <p className="mt-2 truncate font-mono text-xs text-muted-foreground" title={`Fingerprint: ${props.item.fingerprint}`}>
          {props.revealedValue ?? props.item.maskedValue}
        </p>
      </TableCell>
      <TableCell className="align-top">
        {isNoteOpen ? (
          <Input
            autoFocus
            className="h-8 font-mono text-xs"
            value={noteDraft}
            onChange={(event) => setNoteDraft(event.target.value)}
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
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span title="Requests" className="inline-flex items-center gap-1"><Activity size={12} /><strong>{formatNumber(props.item.requestCount)}</strong></span>
            <span title="Failures" className={props.item.failureCount > 0 ? "text-destructive inline-flex items-center gap-1" : "inline-flex items-center gap-1"}>
              <AlertCircle size={12} /><strong>{formatNumber(props.item.failureCount)}</strong>
            </span>
            <span title="Last used" className="inline-flex items-center gap-1"><Clock size={12} />{formatDateTime(props.item.lastUsedAt)}</span>
            <span title="Quota" className="inline-flex items-center gap-1"><Database size={12} />{quotaText}</span>
            {props.item.note ? <span className="inline-flex items-center gap-1 text-primary"><Edit2 size={10} />{props.item.note}</span> : null}
          </div>
        )}
        {(props.item.lastError || props.item.lastCheckError) && !isNoteOpen ? (
          <p className="mt-2 text-xs text-destructive">{props.item.lastCheckError ?? props.item.lastError}</p>
        ) : null}
      </TableCell>
      <TableCell className="w-[168px] align-top">
        <div className="flex items-center justify-end gap-1" onClick={(event) => event.stopPropagation()}>
          <Button aria-label="Edit note" className="size-7" size="icon" type="button" variant="ghost" onClick={() => setIsNoteOpen(!isNoteOpen)}>
            <Edit2 className="size-3.5" />
          </Button>
          <Button aria-label={props.revealedValue ? "Hide key" : "Reveal key"} className="size-7" disabled={props.isRevealing} size="icon" type="button" variant="ghost" onClick={() => props.onToggleReveal(props.item.id)}>
            {props.isRevealing ? <InlineSpinner label="" /> : props.revealedValue ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
          </Button>
          <Button aria-label="Copy key" className="size-7" disabled={props.isCopying || props.isRevealing} size="icon" type="button" variant="ghost" onClick={() => props.onCopy(props.item.id)}>
            {props.isCopying ? <InlineSpinner label="" /> : <Copy className="size-3.5" />}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button aria-label="Key actions" className="size-7" size="icon" type="button" variant="ghost">
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
      </TableCell>
    </TableRow>
  );
}
