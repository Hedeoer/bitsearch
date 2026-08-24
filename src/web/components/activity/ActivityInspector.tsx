import { useMemo, useState } from "react";
import { AlertTriangle, GitBranch, KeyRound, Server, Timer, Wrench } from "lucide-react";
import { PayloadToolbar } from "./PayloadToolbar";
import type { ActivityDetailRecord } from "@shared/contracts";
import { EmptyState } from "../Feedback";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDateTime, formatDuration, statusTone } from "../../format";

type ActivityInspectorProps = {
  detail: ActivityDetailRecord | null;
  error: string | null;
  loading: boolean;
};

type InspectorTab = "input" | "output" | "metadata" | "messages";

function prettyPrint(value: unknown): string {
  if (value === null || value === undefined) {
    return "-";
  }
  if (typeof value === "string") {
    return value;
  }
  return JSON.stringify(value, null, 2);
}

function SummaryCard(
  props: Readonly<{
    icon: typeof Wrench;
    label: string;
    value: string;
  }>,
) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
      <span>
        <props.icon size={12} />
        {props.label}
      </span>
      <strong>{props.value}</strong>
    </div>
  );
}

export function ActivityInspector(props: ActivityInspectorProps) {
  const [activeTab, setActiveTab] = useState<InspectorTab>("input");
  const [wordWrap, setWordWrap] = useState(false);
  const request = props.detail?.request ?? null;
  const diagnostics = props.detail?.diagnostics ?? null;

  const payloadMap = useMemo(() => {
    if (!request) {
      return null;
    }
    return {
      input: prettyPrint(request.inputJson),
      output: prettyPrint(request.resultPreview),
      metadata: prettyPrint(request.metadata),
      messages: prettyPrint(props.detail?.messages),
    } as const;
  }, [props.detail, request]);

  if (!props.loading && !props.error && !props.detail) {
    return (
      <div className="min-w-0 xl:max-h-[calc(100vh-180px)] xl:overflow-y-auto">
        <section className="rounded-xl border border-border/70 bg-card shadow-xs">
          <EmptyState title="Select a request" description="Choose a request from the feed to inspect attempts, payloads, and diagnostics." />
        </section>
      </div>
    );
  }

  return (
    <div className="grid min-w-0 gap-4 xl:max-h-[calc(100vh-180px)] xl:overflow-y-auto">
      <section className="rounded-xl border border-border/70 bg-card shadow-xs">
        <div className="flex items-center justify-between gap-3 px-4 py-3.5">
          <div>
            <h3 className="mt-1 text-base font-semibold tracking-tight">Selected request</h3>
          </div>
          {request ? <Badge variant={statusTone(request.status) === "success" ? "success" : statusTone(request.status) === "danger" ? "danger" : "warning"}>{request.status}</Badge> : null}
        </div>

        {props.loading ? <Skeleton className="h-[220px] rounded-2xl" /> : null}
        {!props.loading && props.error ? <p className="m-4 rounded-xl border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">{props.error}</p> : null}
        {!props.loading && request && diagnostics ? (
          <div className="grid gap-4 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <SummaryCard icon={Wrench} label="Tool" value={request.toolName} />
              <SummaryCard icon={Server} label="Provider" value={request.finalProvider ?? "-"} />
              <SummaryCard icon={GitBranch} label="Attempts" value={String(request.attempts)} />
              <SummaryCard icon={Timer} label="Latency" value={formatDuration(request.durationMs)} />
            </div>

            <Card>
              <CardContent className="grid gap-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">Diagnostics</p>
                  <h3 className="mt-1 text-base font-semibold tracking-tight">Execution summary</h3>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {diagnostics.isSlow ? <Badge variant="warning">Slow request</Badge> : null}
                {diagnostics.isFallback ? <Badge variant="neutral">Fallback / retry</Badge> : null}
                {diagnostics.primaryErrorType ? <Badge variant="danger">{diagnostics.primaryErrorType}</Badge> : null}
              </div>
              <p className="m-0 text-sm text-muted-foreground">
                {diagnostics.failureStageHint ?? "No diagnostic hint was required for this request."}
              </p>
              <pre className="m-0 max-h-52 overflow-auto rounded-xl border border-border/60 bg-background/80 p-3 font-mono text-xs leading-relaxed text-muted-foreground">{diagnostics.retryChainLabel}</pre>
              </CardContent>
            </Card>

            {request.errorSummary ? (
              <Card className="border-destructive/25">
                <CardContent className="grid gap-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-destructive">Error Summary</p>
                    <h3 className="mt-1 text-base font-semibold tracking-tight">Top-level request error</h3>
                  </div>
                  <Badge variant="danger">
                    <AlertTriangle size={11} />
                    request
                  </Badge>
                </div>
                <pre className="m-0 max-h-52 overflow-auto rounded-xl border border-destructive/20 bg-destructive/10 p-3 font-mono text-xs leading-relaxed text-destructive">{request.errorSummary}</pre>
                </CardContent>
              </Card>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="rounded-xl border border-border/70 bg-card shadow-xs">
        <div className="px-4 py-3.5">
          <div>
            <h3 className="mt-1 text-base font-semibold tracking-tight">Attempts & payloads</h3>
          </div>
        </div>

        {props.loading ? <Skeleton className="h-[260px] rounded-2xl" /> : null}
        {!props.loading && !props.error && props.detail ? (
          <div className="grid gap-4 p-4">
            <Card>
              <CardContent className="grid gap-3 p-4">
                {props.detail.attempts.length === 0 ? (
                  <div className="grid place-items-center px-6 py-10 text-center text-muted-foreground">
                    <GitBranch className="mb-4 size-8 opacity-50" />
                    <h4 className="m-0 mt-4 text-lg font-semibold text-foreground">Direct / Inline Lifecycle</h4>
                    <p className="m-0 text-xs">
                      This request was handled directly by the service process without generating external retry or multi-attempt step chains.
                    </p>
                  </div>
                ) : (
                  props.detail.attempts.map((attempt) => (
                    <article key={attempt.id} className="grid grid-cols-[auto_minmax(0,1fr)] gap-3">
                      <div aria-hidden="true" className="w-2 rounded-full bg-gradient-to-b from-primary/70 to-primary/10" />
                      <div className="rounded-2xl border border-border/60 bg-background/60 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <strong>{attempt.attemptNo}. {attempt.provider}</strong>
                          <Badge variant={statusTone(attempt.status) === "success" ? "success" : statusTone(attempt.status) === "danger" ? "danger" : "warning"}>{attempt.status}</Badge>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1"><Timer className="size-3" />{formatDuration(attempt.durationMs)}</span>
                          <span className="inline-flex items-center gap-1"><KeyRound className="size-3" />{attempt.keyFingerprint ?? "-"}</span>
                          <span>{formatDateTime(attempt.createdAt)}</span>
                        </div>
                        <p className="m-0 mt-2 text-xs">
                          {attempt.errorType ? `${attempt.errorType}: ` : ""}
                          {attempt.errorSummary ?? "Completed without an error summary."}
                        </p>
                      </div>
                    </article>
                  ))
                )}
            </CardContent>
          </Card>

            <Card>
              <PayloadToolbar
                activeTab={activeTab}
                payloadContent={payloadMap?.[activeTab] !== "-" ? payloadMap?.[activeTab] : null}
                wordWrap={wordWrap}
                onToggleWrap={() => setWordWrap(!wordWrap)}
              />
              <Tabs className="px-3.5 pb-3.5" onValueChange={(value) => setActiveTab(value as InspectorTab)} value={activeTab}>
                <TabsList aria-label="Payload inspector tabs" className="w-full justify-start">
                  <TabsTrigger value="input">Input</TabsTrigger><TabsTrigger value="output">Output</TabsTrigger><TabsTrigger value="metadata">Metadata</TabsTrigger><TabsTrigger value="messages">Messages</TabsTrigger>
                </TabsList>
                {(["input", "output", "metadata", "messages"] as const).map((tabName) => (
                  <TabsContent key={tabName} forceMount value={tabName}>
                    {activeTab === tabName && payloadMap?.[tabName] === "-" ? (
                      <div className="grid min-h-56 place-items-center px-6 py-8 text-center text-sm text-muted-foreground"><p className="m-0">No content captured for {tabName}</p></div>
                    ) : activeTab === tabName ? (
                      <pre className={`m-0 max-h-96 overflow-auto rounded-xl border border-border/60 bg-background/80 p-3 font-mono text-xs leading-relaxed text-muted-foreground ${wordWrap ? "whitespace-pre-wrap break-words" : "whitespace-pre"}`}>{payloadMap?.[tabName]}</pre>
                    ) : null}
                  </TabsContent>
                ))}
              </Tabs>
            </Card>
          </div>
        ) : null}
      </section>
    </div>
  );
}
