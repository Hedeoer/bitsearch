import { asText, formatDuration, statusTone } from "../format";
import type { AttemptLog } from "../types";

type LogPanelProps = {
  logs: Array<Record<string, unknown>>;
};

type AttemptPanelProps = {
  attempts: AttemptLog[];
};

export function LogPanel(props: LogPanelProps) {
  return (
    <article className="surface-card" id="activity">
      <div className="section-heading">
        <div>
          <div className="eyebrow">Activity</div>
          <h3>Recent Request Logs</h3>
        </div>
      </div>
      <div className="data-table">
        <div className="data-row data-head five-col">
          <span>Tool</span>
          <span>Status</span>
          <span>Provider</span>
          <span>Duration</span>
          <span>Error</span>
        </div>
        {props.logs.map((item, index) => {
          const status = asText(item, "status");
          return (
            <div className="data-row five-col" key={String(item.id ?? index)}>
              <span>{asText(item, "toolName", "tool_name")}</span>
              <span className={`status-pill ${statusTone(status)}`}>{status}</span>
              <span>{asText(item, "finalProvider", "final_provider")}</span>
              <span className="mono">
                {formatDuration(item.durationMs ?? item.duration_ms)}
              </span>
              <span>{asText(item, "errorSummary", "error_summary")}</span>
            </div>
          );
        })}
      </div>
    </article>
  );
}

export function AttemptPanel(props: AttemptPanelProps) {
  return (
    <article className="surface-card">
      <div className="section-heading">
        <div>
          <div className="eyebrow">Failover</div>
          <h3>Attempt Timeline</h3>
        </div>
      </div>
      <div className="data-table">
        <div className="data-row data-head five-col">
          <span>Provider</span>
          <span>Status</span>
          <span>Fingerprint</span>
          <span>Duration</span>
          <span>Error</span>
        </div>
        {props.attempts.map((item, index) => {
          const status = asText(item, "status");
          return (
            <div className="data-row five-col" key={String(item.id ?? index)}>
              <span>{asText(item, "provider")}</span>
              <span className={`status-pill ${statusTone(status)}`}>{status}</span>
              <span className="mono">{asText(item, "keyFingerprint", "key_fingerprint")}</span>
              <span className="mono">
                {formatDuration(item.durationMs ?? item.duration_ms)}
              </span>
              <span>{asText(item, "errorSummary", "error_summary")}</span>
            </div>
          );
        })}
      </div>
    </article>
  );
}
