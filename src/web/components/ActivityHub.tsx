import { useMemo, useState } from "react";
import type { RequestActivityRecord } from "@shared/contracts";
import { asText, formatDuration, statusTone } from "../format";

type ActivityHubProps = {
  activity: RequestActivityRecord[];
};

function prettyJson(value: Record<string, unknown> | null): string {
  if (!value) {
    return "-";
  }
  return JSON.stringify(value, null, 2);
}

export function ActivityHub(props: ActivityHubProps) {
  const [query, setQuery] = useState("");
  const [toolFilter, setToolFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = useMemo(() => {
    return props.activity.filter((item) => {
      const { request } = item;
      const haystack = [
        request.toolName,
        request.targetUrl ?? "",
        request.finalProvider ?? "",
        request.errorSummary ?? "",
      ]
        .join(" ")
        .toLowerCase();
      if (query && !haystack.includes(query.toLowerCase())) {
        return false;
      }
      if (toolFilter !== "all" && request.toolName !== toolFilter) {
        return false;
      }
      if (statusFilter !== "all" && request.status !== statusFilter) {
        return false;
      }
      return true;
    });
  }, [props.activity, query, statusFilter, toolFilter]);

  const selected = filtered[0] ?? null;

  return (
    <section className="activity-hub" id="activity">
      <article className="surface-card">
        <div className="section-heading">
          <div>
            <div className="eyebrow">Activity</div>
            <h3>Request Feed</h3>
          </div>
          <span className="chip neutral-chip">{filtered.length} visible</span>
        </div>
        <div className="activity-filters">
          <input
            placeholder="Search tool / url / provider / error"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <select value={toolFilter} onChange={(event) => setToolFilter(event.target.value)}>
            <option value="all">all tools</option>
            <option value="web_search">web_search</option>
            <option value="web_fetch">web_fetch</option>
            <option value="web_map">web_map</option>
          </select>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="all">all status</option>
            <option value="success">success</option>
            <option value="failed">failed</option>
          </select>
        </div>
        <div className="activity-list">
          {filtered.map((item) => (
            <div className="activity-item" key={item.request.id}>
              <div className="activity-item-top">
                <strong>{item.request.toolName}</strong>
                <span className={`status-pill ${statusTone(item.request.status)}`}>
                  {item.request.status}
                </span>
              </div>
              <div className="activity-item-meta">
                <span className="mono">{item.request.targetUrl ?? "no target url"}</span>
                <span>{item.request.finalProvider ?? "-"}</span>
                <span>{formatDuration(item.request.durationMs)}</span>
              </div>
              <p className="supporting compact">
                {item.request.errorSummary ?? item.request.resultPreview ?? "No summary"}
              </p>
            </div>
          ))}
        </div>
      </article>

      <article className="surface-card detail-panel">
        <div className="section-heading">
          <div>
            <div className="eyebrow">Details</div>
            <h3>Selected Request</h3>
          </div>
          {selected ? (
            <span className={`status-pill ${statusTone(selected.request.status)}`}>
              {selected.request.status}
            </span>
          ) : null}
        </div>
        {selected ? (
          <>
            <div className="detail-grid">
              <div className="detail-card">
                <span>Tool</span>
                <strong>{selected.request.toolName}</strong>
              </div>
              <div className="detail-card">
                <span>Provider</span>
                <strong>{selected.request.finalProvider ?? "-"}</strong>
              </div>
              <div className="detail-card">
                <span>Attempts</span>
                <strong>{selected.request.attempts}</strong>
              </div>
              <div className="detail-card">
                <span>Duration</span>
                <strong>{formatDuration(selected.request.durationMs)}</strong>
              </div>
            </div>
            <div className="detail-block">
              <div className="eyebrow">Provider Order</div>
              <div className="mono">{selected.request.providerOrder.join(" → ") || "-"}</div>
            </div>
            <div className="detail-block">
              <div className="eyebrow">Input</div>
              <pre>{prettyJson(selected.request.inputJson)}</pre>
            </div>
            <div className="detail-block">
              <div className="eyebrow">Result Preview</div>
              <pre>{selected.request.resultPreview ?? "-"}</pre>
            </div>
            <div className="detail-block">
              <div className="eyebrow">Metadata</div>
              <pre>{prettyJson(selected.request.metadata)}</pre>
            </div>
            <div className="detail-block">
              <div className="eyebrow">Attempt Chain</div>
              <div className="attempt-stack">
                {selected.attempts.map((attempt) => (
                  <div className="attempt-card" key={attempt.id}>
                    <div className="attempt-top">
                      <strong>
                        {attempt.attemptNo}. {attempt.provider}
                      </strong>
                      <span className={`status-pill ${statusTone(attempt.status)}`}>
                        {attempt.status}
                      </span>
                    </div>
                    <div className="attempt-meta">
                      <span className="mono">{attempt.keyFingerprint ?? "-"}</span>
                      <span>{attempt.providerBaseUrl ?? "-"}</span>
                      <span>{formatDuration(attempt.durationMs)}</span>
                    </div>
                    <div className="supporting compact">
                      {attempt.errorType ? `${attempt.errorType}: ` : ""}
                      {attempt.errorSummary ?? "-"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <p className="warning-banner">No activity matches the current filters.</p>
        )}
      </article>
    </section>
  );
}
