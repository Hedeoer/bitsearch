import { useEffect, useMemo, useState } from "react";
import type { RequestActivityRecord } from "@shared/contracts";
import { asText, formatDuration, statusTone } from "../format";
import { RequestDetails } from "./RequestDetails";

type ActivityHubProps = {
  activity: RequestActivityRecord[];
};

export function ActivityHub(props: ActivityHubProps) {
  const [query, setQuery] = useState("");
  const [toolFilter, setToolFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);

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

  useEffect(() => {
    if (filtered.length === 0) {
      setSelectedRequestId(null);
      return;
    }
    const hasSelected = filtered.some((item) => item.request.id === selectedRequestId);
    if (!hasSelected) {
      setSelectedRequestId(filtered[0].request.id);
    }
  }, [filtered, selectedRequestId]);

  const selected =
    filtered.find((item) => item.request.id === selectedRequestId) ?? null;

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
            <button
              key={item.request.id}
              type="button"
              className={`activity-item ${
                item.request.id === selectedRequestId ? "activity-item-selected" : ""
              }`}
              onClick={() => setSelectedRequestId(item.request.id)}
            >
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
            </button>
          ))}
        </div>
      </article>
      <RequestDetails activity={selected} />
    </section>
  );
}
