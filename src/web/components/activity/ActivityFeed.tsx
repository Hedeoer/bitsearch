import { AlertTriangle, ArrowDownUp, Globe, Server, Timer } from "lucide-react";
import type { ActivityListItem, ActivityListPageResult } from "@shared/contracts";
import { EmptyState, LoadingOverlay } from "../Feedback";
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

function getPreview(item: ActivityListItem): string {
  return item.errorSummary ?? item.resultPreview ?? "No preview captured";
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
      <div className="activity-feed-card-top">
        <div className="activity-feed-card-title">
          <span className="chip primary-chip">
            <Server size={12} />
            {props.item.toolName}
          </span>
          {props.item.isSlow ? <span className="status-pill warning">Slow</span> : null}
          {props.item.isFallback ? <span className="status-pill neutral">Fallback</span> : null}
        </div>
        <span className={`status-pill ${tone}`}>{props.item.status}</span>
      </div>

      <div className="activity-feed-card-meta">
        <span>
          <Timer size={11} />
          {formatDuration(props.item.durationMs)}
        </span>
        <span>
          <ArrowDownUp size={11} />
          {formatNumber(props.item.attempts)} attempts
        </span>
        <span>{formatDateTime(props.item.createdAt)}</span>
      </div>

      <div className="activity-feed-card-provider-row">
        <span className="activity-feed-card-provider">
          {props.item.finalProvider ?? "no final provider"}
        </span>
        {props.item.primaryErrorType ? (
          <span className="activity-feed-card-error-type">
            <AlertTriangle size={11} />
            {props.item.primaryErrorType}
          </span>
        ) : null}
      </div>

      {props.item.targetUrl ? (
        <p className="activity-feed-card-url">
          <Globe size={12} />
          {props.item.targetUrl}
        </p>
      ) : null}

      <p className="activity-feed-card-preview">{getPreview(props.item)}</p>
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
        {props.loading ? <LoadingOverlay label="Loading activity feed" /> : null}
        {!props.loading && props.error ? (
          <p className="warning-banner">{props.error}</p>
        ) : null}
        {!props.loading && !props.error && items.length === 0 ? (
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
          <button
            className="secondary-button"
            type="button"
            disabled={page === 0}
            onClick={() => props.onPageChange(page - 1)}
          >
            Previous
          </button>
          <span className="supporting compact">
            Page {page + 1} / {totalPages}
          </span>
          <button
            className="secondary-button"
            type="button"
            disabled={page >= totalPages - 1}
            onClick={() => props.onPageChange(page + 1)}
          >
            Next
          </button>
        </div>
      ) : null}
    </section>
  );
}
