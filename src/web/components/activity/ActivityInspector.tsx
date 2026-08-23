import { useMemo, useState } from "react";
import { AlertTriangle, GitBranch, KeyRound, Server, Timer, Wrench } from "lucide-react";
import { PayloadToolbar } from "./PayloadToolbar";
import type { ActivityDetailRecord } from "@shared/contracts";
import { EmptyState, LoadingOverlay } from "../Feedback";
import { Badge } from "@/components/ui/badge";
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
    <article className="activity-summary-detail-card">
      <span>
        <props.icon size={12} />
        {props.label}
      </span>
      <strong>{props.value}</strong>
    </article>
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
      <div className="activity-inspector-shell">
        <section className="surface-card activity-pane activity-pane-sticky activity-pane-empty">
          <EmptyState title="Select a request" description="Choose a request from the feed to inspect attempts, payloads, and diagnostics." />
        </section>
      </div>
    );
  }

  return (
    <div className="activity-inspector-shell">
      <section className="surface-card activity-pane activity-pane-sticky">
        <div className="section-heading compact">
          <div>
            <div className="eyebrow">Inspector</div>
            <h3>Selected request</h3>
          </div>
          {request ? <Badge variant={statusTone(request.status) === "success" ? "success" : statusTone(request.status) === "danger" ? "danger" : "warning"}>{request.status}</Badge> : null}
        </div>

        {props.loading ? <Skeleton className="h-[220px] rounded-2xl" /> : null}
        {!props.loading && props.error ? <p className="warning-banner">{props.error}</p> : null}
        {!props.loading && request && diagnostics ? (
          <div className="activity-inspector-stack">
            <div className="activity-summary-detail-grid">
              <SummaryCard icon={Wrench} label="Tool" value={request.toolName} />
              <SummaryCard icon={Server} label="Provider" value={request.finalProvider ?? "-"} />
              <SummaryCard icon={GitBranch} label="Attempts" value={String(request.attempts)} />
              <SummaryCard icon={Timer} label="Latency" value={formatDuration(request.durationMs)} />
            </div>

            <article className="activity-diagnostics-card">
              <div className="section-heading compact">
                <div>
                  <div className="eyebrow">Diagnostics</div>
                  <h3>Execution summary</h3>
                </div>
              </div>
              <div className="activity-diagnostic-chip-row">
                {diagnostics.isSlow ? <Badge variant="warning">Slow request</Badge> : null}
                {diagnostics.isFallback ? <Badge variant="neutral">Fallback / retry</Badge> : null}
                {diagnostics.primaryErrorType ? <Badge variant="danger">{diagnostics.primaryErrorType}</Badge> : null}
              </div>
              <p className="supporting">
                {diagnostics.failureStageHint ?? "No diagnostic hint was required for this request."}
              </p>
              <pre className="activity-code-block">{diagnostics.retryChainLabel}</pre>
            </article>

            {request.errorSummary ? (
              <article className="activity-error-panel">
                <div className="section-heading compact">
                  <div>
                    <div className="eyebrow">Error Summary</div>
                    <h3>Top-level request error</h3>
                  </div>
                  <Badge variant="danger">
                    <AlertTriangle size={11} />
                    request
                  </Badge>
                </div>
                <pre className="activity-code-block">{request.errorSummary}</pre>
              </article>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="surface-card activity-pane activity-pane-sticky">
        <div className="section-heading compact">
          <div>
            <div className="eyebrow">Timeline</div>
            <h3>Attempts & payloads</h3>
          </div>
        </div>

        {props.loading ? <Skeleton className="h-[260px] rounded-2xl" /> : null}
        {!props.loading && !props.error && props.detail ? (
          <div className="activity-inspector-stack">
            <article className="activity-attempt-panel">
              <div className="activity-attempt-timeline">
                {props.detail.attempts.length === 0 ? (
                  <div className="activity-payload-empty">
                    <GitBranch className="text-dim" size={32} style={{ marginBottom: "1rem", opacity: 0.5 }} />
                    <h4>Direct / Inline Lifecycle</h4>
                    <p className="supporting compact">
                      This request was handled directly by the service process without generating external retry or multi-attempt step chains.
                    </p>
                  </div>
                ) : (
                  props.detail.attempts.map((attempt) => (
                    <article key={attempt.id} className="activity-attempt-item">
                      <div className="activity-attempt-marker" />
                      <div className="activity-attempt-body">
                        <div className="activity-attempt-top">
                          <strong>{attempt.attemptNo}. {attempt.provider}</strong>
                          <Badge variant={statusTone(attempt.status) === "success" ? "success" : statusTone(attempt.status) === "danger" ? "danger" : "warning"}>{attempt.status}</Badge>
                        </div>
                        <div className="activity-attempt-meta">
                          <span><Timer size={11} />{formatDuration(attempt.durationMs)}</span>
                          <span><KeyRound size={11} />{attempt.keyFingerprint ?? "-"}</span>
                          <span>{formatDateTime(attempt.createdAt)}</span>
                        </div>
                        <p className="supporting compact">
                          {attempt.errorType ? `${attempt.errorType}: ` : ""}
                          {attempt.errorSummary ?? "Completed without an error summary."}
                        </p>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </article>

            <article className="activity-payload-panel">
              <PayloadToolbar
                activeTab={activeTab}
                payloadContent={payloadMap?.[activeTab] !== "-" ? payloadMap?.[activeTab] : null}
                wordWrap={wordWrap}
                onToggleWrap={() => setWordWrap(!wordWrap)}
              />
              <Tabs onValueChange={(value) => setActiveTab(value as InspectorTab)} value={activeTab}>
                <TabsList aria-label="Payload inspector tabs" className="w-full justify-start">
                  <TabsTrigger value="input">Input</TabsTrigger><TabsTrigger value="output">Output</TabsTrigger><TabsTrigger value="metadata">Metadata</TabsTrigger><TabsTrigger value="messages">Messages</TabsTrigger>
                </TabsList>
                {(["input", "output", "metadata", "messages"] as const).map((tabName) => (
                  <TabsContent key={tabName} forceMount value={tabName}>
                    {activeTab === tabName && payloadMap?.[tabName] === "-" ? (
                      <div className="activity-payload-empty"><p>No content captured for {tabName}</p></div>
                    ) : activeTab === tabName ? (
                      <pre className="activity-code-block" style={{ whiteSpace: wordWrap ? "pre-wrap" : "pre" }}>{payloadMap?.[tabName]}</pre>
                    ) : null}
                  </TabsContent>
                ))}
              </Tabs>
            </article>
          </div>
        ) : null}
      </section>
    </div>
  );
}
