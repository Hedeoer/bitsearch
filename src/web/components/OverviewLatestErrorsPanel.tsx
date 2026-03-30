import { useEffect, useState } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight, ShieldCheck } from "lucide-react";
import type { DashboardSummary } from "@shared/contracts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDateTime } from "../format";

type OverviewLatestErrorsPanelProps = Readonly<{
  failedCount24h: number;
  errors: DashboardSummary["latestErrors"];
}>;

const ERROR_PAGE_SIZE = 3;

function ErrorEmptyState() {
  return (
    <div className="grid min-h-[220px] place-items-center rounded-[22px] border border-emerald-400/14 bg-emerald-400/6 p-6 text-center">
      <div className="grid gap-3">
        <ShieldCheck className="mx-auto size-8 text-[color:var(--success)]" />
        <div className="text-sm text-[color:var(--text-soft)]">
          No recent failures were recorded in the rolling 24 hour window.
        </div>
      </div>
    </div>
  );
}

function ErrorFeedItem(props: Readonly<{
  error: DashboardSummary["latestErrors"][number];
}>) {
  const providerLabel = props.error.finalProvider ?? "no provider";
  const targetLabel = props.error.targetUrl ?? "no target";
  const summary = props.error.errorSummary ?? props.error.resultPreview ?? "No summary";

  return (
    <div className="rounded-[20px] border border-rose-300/12 bg-[rgba(255,142,125,0.06)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-[color:var(--text)]">
            {props.error.toolName}
          </div>
          <div className="mt-1 break-words text-xs leading-5 text-[color:var(--text-dim)]">
            {providerLabel} · {targetLabel}
          </div>
        </div>
        <Badge variant="danger">{formatDateTime(props.error.createdAt)}</Badge>
      </div>
      <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-[color:var(--text-soft)]">
        {summary}
      </p>
    </div>
  );
}

function PaginationSummary(props: Readonly<{
  currentPage: number;
  totalItems: number;
  totalPages: number;
}>) {
  const start = props.currentPage * ERROR_PAGE_SIZE + 1;
  const end = Math.min(props.totalItems, start + ERROR_PAGE_SIZE - 1);
  return (
    <span className="text-xs text-[color:var(--text-dim)]">
      {start}-{end} / {props.totalItems}
    </span>
  );
}

export function OverviewLatestErrorsPanel(props: OverviewLatestErrorsPanelProps) {
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(props.errors.length / ERROR_PAGE_SIZE));
  const pagedErrors = props.errors.slice(
    page * ERROR_PAGE_SIZE,
    (page + 1) * ERROR_PAGE_SIZE,
  );

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages - 1));
  }, [totalPages]);

  return (
    <Card className="min-w-0">
      <CardHeader className="pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="eyebrow">Exceptions</div>
            <CardTitle className="mt-2">Latest errors</CardTitle>
            <CardDescription className="mt-2">
              Recent failures stay compact and scannable instead of stretching into a long console dump.
            </CardDescription>
          </div>
          <Badge variant={props.errors.length > 0 ? "danger" : "success"}>
            <AlertTriangle className="size-3.5" />
            {props.failedCount24h} failures / 24h
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {props.errors.length === 0 ? (
          <ErrorEmptyState />
        ) : (
          <div className="grid gap-4">
            <div className="grid gap-3">
              {pagedErrors.map((item) => (
                <ErrorFeedItem key={item.id} error={item} />
              ))}
            </div>
            {totalPages > 1 ? (
              <div className="flex items-center justify-between gap-3">
                <PaginationSummary
                  currentPage={page}
                  totalItems={props.errors.length}
                  totalPages={totalPages}
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page === 0}
                    type="button"
                    onClick={() => setPage((current) => Math.max(0, current - 1))}
                  >
                    <ChevronLeft size={14} />
                    Prev
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page >= totalPages - 1}
                    type="button"
                    onClick={() =>
                      setPage((current) => Math.min(totalPages - 1, current + 1))
                    }
                  >
                    Next
                    <ChevronRight size={14} />
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
