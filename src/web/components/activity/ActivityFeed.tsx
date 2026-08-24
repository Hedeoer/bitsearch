import { Server } from "lucide-react";
import type { ActivityListItem, ActivityListPageResult } from "@shared/contracts";
import { EmptyState } from "../Feedback";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime, formatDuration, formatNumber, statusTone } from "../../format";

type ActivityFeedProps = {
  error: string | null;
  hasActiveFilters: boolean;
  loading: boolean;
  result: ActivityListPageResult | null;
  selectedId: string | null;
  onPageChange: (page: number) => void;
  onSelect: (requestId: string) => void;
};

function truncate(text: string | null | undefined, max: number): string {
  if (!text) return "";
  return text.length > max ? text.slice(0, max) + "..." : text;
}

function FeedCard(
  props: Readonly<{
    item: ActivityListItem;
    selected: boolean;
    onSelect: () => void;
  }>,
) {
  const tone = statusTone(props.item.status);
  return (
    <Card
      aria-selected={props.selected}
      className={`cursor-pointer border-border/60 transition-colors hover:border-primary/30 hover:bg-accent/20 ${props.selected ? "border-primary/45 bg-primary/8" : ""}`}
      onClick={props.onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          props.onSelect();
        }
      }}
      role="button"
      tabIndex={0}
    >
      <CardContent className="grid gap-2 p-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Badge className="gap-1 px-2 py-0.5" variant="default">
              <Server className="size-3" />
              {props.item.toolName}
            </Badge>
            <span className="truncate text-xs text-muted-foreground">({props.item.finalProvider ?? "no provider"})</span>
          </div>
          <Badge variant={tone === "success" ? "success" : tone === "danger" ? "danger" : "warning"}>
            {props.item.status}
          </Badge>
        </div>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span>{formatDuration(props.item.durationMs)}</span>
          <span aria-hidden="true">•</span>
          <span>{props.item.attempts} Attempt{props.item.attempts > 1 ? "s" : ""}</span>
          <span aria-hidden="true">•</span>
          <span>{formatDateTime(props.item.createdAt)}</span>
        </div>

        <p className="m-0 line-clamp-2 text-xs leading-relaxed">
        {props.item.status === "success" ? (
          <span className="text-muted-foreground">{truncate(props.item.resultPreview ?? "No preview captured", 80)}</span>
        ) : (
          <span className="text-destructive">{truncate(props.item.errorSummary ?? "No error details", 80)}</span>
        )}
        </p>
      </CardContent>
    </Card>
  );
}

export function ActivityFeed(props: ActivityFeedProps) {
  const items = props.result?.items ?? [];
  const total = props.result?.total ?? 0;
  const page = props.result?.page ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / Math.max(props.result?.pageSize ?? 25, 1)));

  return (
    <section className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-xs">
      <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3.5">
        <div>
          <h3 className="mt-1 text-base font-semibold tracking-tight">Request feed</h3>
        </div>
        <Badge variant="neutral">{formatNumber(total)} total</Badge>
      </div>

      <div className="grid max-h-[calc(100vh-360px)] gap-3 overflow-y-auto p-4">
        {!props.loading && props.error ? (
          <p className="m-0 rounded-xl border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">{props.error}</p>
        ) : null}
        {props.loading ? (
          <div className="space-y-3">
            {[0, 1, 2, 3].map((index) => (
              <Skeleton className="h-[104px] rounded-2xl" key={index} />
            ))}
          </div>
        ) : null}
        {!props.loading && items.length === 0 ? (
          <EmptyState
            title="No activity found"
            description={props.hasActiveFilters ? "Adjust the filters to widen the current slice." : "No activity has been recorded yet."}
          />
        ) : null}
        {items.map((item) => (
          <FeedCard
            key={item.id}
            item={item}
            selected={item.id === props.selectedId}
            onSelect={() => props.onSelect(item.id)}
          />
        ))}
      </div>

      {totalPages > 1 ? (
        <div className="flex items-center justify-between gap-3 border-t border-border/60 px-4 py-3">
          <Button
            variant="secondary"
            type="button"
            disabled={page === 0}
            onClick={() => props.onPageChange(page - 1)}
          >
            Previous
          </Button>
          <span className="text-xs text-muted-foreground">
            Page {page + 1} / {totalPages}
          </span>
          <Button
            variant="secondary"
            type="button"
            disabled={page >= totalPages - 1}
            onClick={() => props.onPageChange(page + 1)}
          >
            Next
          </Button>
        </div>
      ) : null}
    </section>
  );
}
