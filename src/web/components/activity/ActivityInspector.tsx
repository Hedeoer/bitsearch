import { useMemo, useState } from "react";
import { AlertTriangle, ClipboardCopy, GitBranch, KeyRound, Server, Timer, Wrench } from "lucide-react";
import type { ActivityDetailRecord } from "@shared/contracts";
import { EmptyState, LoadingOverlay } from "../Feedback";
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
  const [copyMessage, setCopyMessage] = useState("");
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

  async function copyValue(label: string, value: string | null) {
    if (!value) {
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      setCopyMessage(`${label} copied`);
    } catch {
      setCopyMessage(`${label} copy failed`);
    }
    window.setTimeout(() => setCopyMessage(""), 1200);
  }

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
          {request ? <span className={`status-pill ${statusTone(request.status)}`}>{request.status}</span> : null}
        </div>

        {props.loading ? <LoadingOverlay label="Loading request detail" /> : null}
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
                {copyMessage ? <span className="chip primary-chip">{copyMessage}</span> : null}
              </div>
              <div className="activity-diagnostic-chip-row">
                {diagnostics.isSlow ? <span className="status-pill warning">Slow request</span> : null}
                {diagnostics.isFallback ? <span className="status-pill neutral">Fallback / retry</span> : null}
                {diagnostics.primaryErrorType ? <span className="status-pill danger">{diagnostics.primaryErrorType}</span> : null}
              </div>
              <p className="supporting">
                {diagnostics.failureStageHint ?? "No diagnostic hint was required for this request."}
              </p>
              <div className="activity-copy-row">
                <button className="text-button" type="button" onClick={() => copyValue("Request ID", request.id)}>
                  <ClipboardCopy size={13} />
                  Request ID
                </button>
                <button className="text-button" type="button" onClick={() => copyValue("URL", request.targetUrl)}>
                  <ClipboardCopy size={13} />
                  URL
                </button>
                <button className="text-button" type="button" onClick={() => copyValue("Retry chain", diagnostics.retryChainLabel)}>
                  <ClipboardCopy size={13} />
                  Retry chain
                </button>
              </div>
              <pre className="activity-code-block">{diagnostics.retryChainLabel}</pre>
            </article>

            {request.errorSummary ? (
              <article className="activity-error-panel">
                <div className="section-heading compact">
                  <div>
                    <div className="eyebrow">Error Summary</div>
                    <h3>Top-level request error</h3>
                  </div>
                  <span className="status-pill danger">
                    <AlertTriangle size={11} />
                    request
                  </span>
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

        {props.loading ? <LoadingOverlay label="Loading request detail" /> : null}
        {!props.loading && !props.error && props.detail ? (
          <div className="activity-inspector-stack">
            <article className="activity-attempt-panel">
              <div className="activity-attempt-timeline">
                {props.detail.attempts.length === 0 ? (
                  <p className="supporting">No attempt records were captured for this request.</p>
                ) : (
                  props.detail.attempts.map((attempt) => (
                    <article key={attempt.id} className="activity-attempt-item">
                      <div className="activity-attempt-marker" />
                      <div className="activity-attempt-body">
                        <div className="activity-attempt-top">
                          <strong>{attempt.attemptNo}. {attempt.provider}</strong>
                          <span className={`status-pill ${statusTone(attempt.status)}`}>{attempt.status}</span>
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
              <div className="activity-tab-row" role="tablist" aria-label="Payload inspector tabs">
                <button type="button" className={`activity-tab${activeTab === "input" ? " activity-tab-active" : ""}`} onClick={() => setActiveTab("input")}>Input</button>
                <button type="button" className={`activity-tab${activeTab === "output" ? " activity-tab-active" : ""}`} onClick={() => setActiveTab("output")}>Output</button>
                <button type="button" className={`activity-tab${activeTab === "metadata" ? " activity-tab-active" : ""}`} onClick={() => setActiveTab("metadata")}>Metadata</button>
                <button type="button" className={`activity-tab${activeTab === "messages" ? " activity-tab-active" : ""}`} onClick={() => setActiveTab("messages")}>Messages</button>
              </div>
              {payloadMap?.[activeTab] === "-" ? (
                <div className="activity-payload-empty">
                  <p>No content captured for {activeTab}</p>
                </div>
              ) : (
                <div className="activity-code-shell">
                  <button className="icon-button activity-copy-code" type="button" onClick={() => copyValue(activeTab, payloadMap?.[activeTab] ?? null)} title="Copy payload">
                    <ClipboardCopy size={13} />
                  </button>
                  <pre className="activity-code-block">{payloadMap?.[activeTab]}</pre>
                </div>
              )}
            </article>
          </div>
        ) : null}
      </section>
    </div>
  );
}
