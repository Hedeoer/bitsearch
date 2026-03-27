import type { Dispatch, SetStateAction } from "react";
import type { KeyPoolProvider, KeyPoolSummary } from "@shared/contracts";
import { formatDateTime, formatNumber } from "../format";
import { InlineSpinner, LoadingOverlay } from "./Feedback";
import { renderFirecrawlQuota } from "./KeyInventoryCard";

type KeyPoolImportPanelProps = {
  selectedProvider: KeyPoolProvider;
  setSelectedProvider: Dispatch<SetStateAction<KeyPoolProvider>>;
  rawKeys: string;
  setRawKeys: Dispatch<SetStateAction<string>>;
  tags: string;
  setTags: Dispatch<SetStateAction<string>>;
  summary: KeyPoolSummary | null;
  busy: boolean;
  loading: boolean;
  onImport: () => void;
};

function renderQuotaHint(summary: KeyPoolSummary | null): string {
  if (!summary) {
    return "加载中";
  }
  if (summary.provider === "tavily" && summary.tavily) {
    return `${formatNumber(summary.tavily.totalKeyUsage)} / ${formatNumber(summary.tavily.totalKeyLimit)} credits`;
  }
  if (summary.provider === "firecrawl" && summary.firecrawl?.team) {
    return renderFirecrawlQuota(summary.firecrawl.team, null);
  }
  return "尚未同步额度";
}

export function KeyPoolImportPanel(props: KeyPoolImportPanelProps) {
  return (
    <article className="surface-card" id="keys">
      {props.loading ? <LoadingOverlay label="Refreshing key import summary" /> : null}
      <div className="section-heading">
        <div>
          <div className="eyebrow">Key Pools</div>
          <h3>Import Workspace</h3>
        </div>
        <span className="chip neutral-chip">
          {props.selectedProvider} · {props.summary?.totalKeys ?? 0} keys
        </span>
      </div>
      <div className="key-side-metrics">
        <div className="metric-card">
          <span>健康密钥</span>
          <strong>{formatNumber(props.summary?.healthyKeys ?? 0)}</strong>
          <p className="supporting compact">已通过最近一次测试或额度同步的 key 数量</p>
        </div>
        <div className="metric-card">
          <span>额度概览</span>
          <strong>{renderQuotaHint(props.summary)}</strong>
          <p className="supporting compact">按当前 Provider 的汇总口径展示最近同步结果</p>
        </div>
      </div>
      <label className="field">
        <span>Provider</span>
        <select
          value={props.selectedProvider}
          onChange={(event) =>
            props.setSelectedProvider(event.target.value as KeyPoolProvider)
          }
        >
          <option value="tavily">tavily</option>
          <option value="firecrawl">firecrawl</option>
        </select>
      </label>
      <label className="field">
        <span>Import Tags</span>
        <input
          value={props.tags}
          onChange={(event) => props.setTags(event.target.value)}
          placeholder="search, production, backup"
        />
      </label>
      <label className="field">
        <span>Paste Keys</span>
        <textarea
          rows={10}
          value={props.rawKeys}
          onChange={(event) => props.setRawKeys(event.target.value)}
          placeholder="One API key per line"
        />
      </label>
      <div className="action-row">
        <button
          className="primary-button"
          disabled={props.busy}
          onClick={props.onImport}
        >
          {props.busy ? <InlineSpinner label="Importing" /> : "Import Text"}
        </button>
        <a
          className="secondary-button link-button"
          href={`/api/admin/keys/export.csv?provider=${props.selectedProvider}`}
        >
          Export CSV
        </a>
      </div>
      <p className="supporting compact">
        最近额度同步: {formatDateTime(props.summary?.quotaSyncedAt ?? null)}
      </p>
    </article>
  );
}
