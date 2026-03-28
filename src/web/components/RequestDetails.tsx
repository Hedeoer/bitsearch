import { useEffect, useState } from "react";
import type { RequestActivityRecord } from "@shared/contracts";
import { formatDuration, statusTone } from "../format";
import { Wrench, Server, RefreshCw, Timer, Globe, Key, ChevronRight, AlertTriangle, CheckCircle } from "lucide-react";

type RequestDetailsProps = {
  activity: RequestActivityRecord | null;
};

type DetailTab = "overview" | "input" | "output" | "attempts" | "messages";

const TABS: Array<{ id: DetailTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "input", label: "Input" },
  { id: "output", label: "Output" },
  { id: "attempts", label: "Attempts" },
  { id: "messages", label: "Messages" },
];

function prettyJson(value: Record<string, unknown> | null): string {
  return value ? JSON.stringify(value, null, 2) : "-";
}

function renderEmpty(label: string) {
  return <p className="detail-empty">No {label.toLowerCase()} data for this request.</p>;
}

function canUseMessages(activity: RequestActivityRecord | null): boolean {
  return activity?.request.toolName === "web_search" && Boolean(activity.request.messages);
}

function OverviewTab({ activity }: { activity: RequestActivityRecord }) {
  return (
    <>
      <div className="detail-grid">
        <div className="detail-card">
          <span style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}><Wrench size={12} /> Tool</span>
          <strong>{activity.request.toolName}</strong>
        </div>
        <div className="detail-card">
          <span style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}><Server size={12} /> Provider</span>
          <strong>{activity.request.finalProvider ?? "-"}</strong>
        </div>
        <div className="detail-card">
          <span style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}><RefreshCw size={12} /> Attempts</span>
          <strong>{activity.request.attempts}</strong>
        </div>
        <div className="detail-card">
          <span style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}><Timer size={12} /> Duration</span>
          <strong>{formatDuration(activity.request.durationMs)}</strong>
        </div>
      </div>
      <div className="detail-block">
        <div className="eyebrow">Provider Order</div>
        {activity.request.providerOrder.length > 0 ? (
          <div className="provider-routing-flow">
            {activity.request.providerOrder.map((provider, index) => (
              <span key={provider} style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
                <span className="provider-routing-node">{provider}</span>
                {index < activity.request.providerOrder.length - 1 && (
                  <ChevronRight size={14} className="provider-routing-arrow" />
                )}
              </span>
            ))}
          </div>
        ) : (
          <div className="mono" style={{ color: "var(--text-dim)" }}>-</div>
        )}
      </div>
      <div className="detail-block">
        <div className="eyebrow">Error Summary</div>
        <pre className="message-content">{activity.request.errorSummary ?? "-"}</pre>
      </div>
      <div className="detail-block">
        <div className="eyebrow">Metadata</div>
        <pre className="message-content">{prettyJson(activity.request.metadata)}</pre>
      </div>
    </>
  );
}

function AttemptsTab({ activity }: { activity: RequestActivityRecord }) {
  if (activity.attempts.length === 0) {
    return renderEmpty("Attempts");
  }
  return (
    <div className="attempt-stack">
      {activity.attempts.map((attempt) => (
        <div className="attempt-card" key={attempt.id}>
          <div className="attempt-top">
            <strong>{attempt.attemptNo}. {attempt.provider}</strong>
            <span className={`status-pill ${statusTone(attempt.status)}`}>{attempt.status}</span>
          </div>
          <div className="attempt-meta">
            <span className="mono"><Key size={10} />{attempt.keyFingerprint ?? "-"}</span>
            <span className="url-chip"><Globe size={10} />{attempt.providerBaseUrl ?? "-"}</span>
            <span><Timer size={10} />{formatDuration(attempt.durationMs)}</span>
          </div>
          <div className="supporting compact">
            {attempt.errorType ? `${attempt.errorType}: ` : ""}
            {attempt.errorSummary ?? "-"}
          </div>
        </div>
      ))}
    </div>
  );
}

function MessagesTab({ activity }: { activity: RequestActivityRecord }) {
  if (!activity.request.messages || activity.request.messages.length === 0) {
    return renderEmpty("Messages");
  }
  return (
    <div className="message-stack">
      {activity.request.messages.map((message, index) => (
        <div className="message-card" key={`${activity.request.id}-${index}`}>
          <div className="message-role">{message.role}</div>
          <pre className="message-content">{message.content}</pre>
        </div>
      ))}
    </div>
  );
}

export function RequestDetails(props: RequestDetailsProps) {
  const [activeTab, setActiveTab] = useState<DetailTab>("overview");

  useEffect(() => {
    if (activeTab === "messages" && !canUseMessages(props.activity)) {
      setActiveTab("overview");
    }
  }, [activeTab, props.activity]);

  if (!props.activity) {
    return (
      <article className="surface-card detail-panel">
        <div className="section-heading"><div><div className="eyebrow">Details</div><h3>Selected Request</h3></div></div>
        <p className="warning-banner">No activity matches the current filters.</p>
      </article>
    );
  }

  const { request } = props.activity;

  return (
    <article className="surface-card detail-panel">
      <div className="section-heading">
        <div><div className="eyebrow">Details</div><h3>Selected Request</h3></div>
        <span className={`status-pill ${statusTone(request.status)}`}>
          {request.status === "success" ? <CheckCircle size={11} /> : <AlertTriangle size={11} />}
          {request.status}
        </span>
      </div>
      <div className="detail-tabs" role="tablist" aria-label="Request detail tabs">
        {TABS.map((tab) => {
          const disabled = tab.id === "messages" && !canUseMessages(props.activity);
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`detail-tab ${activeTab === tab.id ? "detail-tab-active" : ""}`}
              disabled={disabled}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      <div className="detail-body">
        {activeTab === "overview" ? <OverviewTab activity={props.activity} /> : null}
        {activeTab === "input" ? <div className="detail-block"><pre className="message-content">{prettyJson(request.inputJson)}</pre></div> : null}
        {activeTab === "output" ? <div className="detail-block"><pre className="message-content">{request.resultPreview ?? "-"}</pre></div> : null}
        {activeTab === "attempts" ? <AttemptsTab activity={props.activity} /> : null}
        {activeTab === "messages" ? <MessagesTab activity={props.activity} /> : null}
      </div>
    </article>
  );
}
