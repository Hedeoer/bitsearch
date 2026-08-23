import { Server } from "lucide-react";
import type { ActivityListItem, ActivityListPageResult } from "@shared/contracts";
import { EmptyState, LoadingOverlay } from "../Feedback";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
    <button
      type="button"
      className={`activity-feed-card interactive-card${props.selected ? " activity-feed-card-selected" : ""}`}
      onClick={props.onSelect}
    >
      {/* 第一层 */}
      <div className="activity-feed-header">
        <div className="activity-feed-tool">
          <span className="chip primary-chip">
            <Server size={12} />
            {props.item.toolName}
          </span>
          <span className="text-soft compact">({props.item.finalProvider ?? "no provider"})</span>
        </div>
        <Badge variant={tone === "success" ? "success" : tone === "danger" ? "danger" : "warning"}>
          {props.item.status}
        </Badge>
      </div>

      {/* 第二层 */}
      <div className="activity-feed-meta">
        <span>⏱️ {props.item.durationMs}ms</span>
        <span>•</span>
        <span>{props.item.attempts} Attempt{props.item.attempts > 1 ? "s" : ""}</span>
        <span>•</span>
        <span>{formatDateTime(props.item.createdAt)}</span>
      </div>

      {/* 第三层 */}
      <div className="activity-feed-preview">
        {props.item.status === "success" ? (
          <span className="compact text-muted-foreground">{truncate(props.item.resultPreview ?? "No preview captured", 80)}</span>
        ) : (
          <span className="compact text-destructive">{truncate(props.item.errorSummary ?? "No error details", 80)}</span>
        )}
      </div>
    </button>
  );
}

export function ActivityFeed(props: ActivityFeedProps) {
  const items = props.result?.items ?? [];
  const total = props.result?.total ?? 0;
  const page = props.result?.page ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / Math.max(props.result?.pageSize ?? 25, 1)));

  return (
    <section className="surface-card activity-pane">
      <div className="section-heading compact">
        <div>
          <div className="eyebrow">Feed</div>
          <h3>Request feed</h3>
        </div>
        <span className="chip neutral-chip">{formatNumber(total)} total</span>
      </div>

      <div className="activity-feed-body">
        {!props.loading && props.error ? (
          <p className="warning-banner">{props.error}</p>
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
        <div className="activity-feed-footer">
          <Button
            variant="secondary"
            type="button"
            disabled={page === 0}
            onClick={() => props.onPageChange(page - 1)}
          >
            Previous
          </Button>
          <span className="supporting compact">
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
