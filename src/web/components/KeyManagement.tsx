import type { Dispatch, SetStateAction } from "react";
import type { ProviderKeyRecord } from "@shared/contracts";

type KeyPoolProps = {
  selectedProvider: "tavily" | "firecrawl";
  setSelectedProvider: Dispatch<SetStateAction<"tavily" | "firecrawl">>;
  rawKeys: string;
  setRawKeys: Dispatch<SetStateAction<string>>;
  tags: string;
  setTags: Dispatch<SetStateAction<string>>;
  selectedCount: number;
  onImport: () => void;
  onBulkToggle: (enabled: boolean) => void;
};

type KeyTableProps = {
  selectedProvider: "tavily" | "firecrawl";
  keys: ProviderKeyRecord[];
  onDeleteKey: (id: string) => void;
};

export function KeyPoolPanel(props: KeyPoolProps) {
  return (
    <article className="surface-card" id="keys">
      <div className="section-heading">
        <div>
          <div className="eyebrow">Key Pools</div>
          <h3>Import Workspace</h3>
        </div>
        <span className="chip neutral-chip">
          {props.selectedProvider} · {props.selectedCount} keys
        </span>
      </div>
      <label className="field">
        <span>Provider</span>
        <select
          value={props.selectedProvider}
          onChange={(event) =>
            props.setSelectedProvider(event.target.value as "tavily" | "firecrawl")
          }
        >
          <option value="tavily">tavily</option>
          <option value="firecrawl">firecrawl</option>
        </select>
      </label>
      <label className="field">
        <span>Tags</span>
        <input
          value={props.tags}
          onChange={(event) => props.setTags(event.target.value)}
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
        <button className="primary-button" onClick={props.onImport}>
          Import Text
        </button>
        <button className="secondary-button" onClick={() => props.onBulkToggle(true)}>
          Enable All
        </button>
        <button className="secondary-button" onClick={() => props.onBulkToggle(false)}>
          Disable All
        </button>
      </div>
      <a
        className="text-link"
        href={`/api/admin/keys/export.csv?provider=${props.selectedProvider}`}
      >
        Export CSV
      </a>
    </article>
  );
}

export function KeyTablePanel(props: KeyTableProps) {
  return (
    <article className="surface-card">
      <div className="section-heading">
        <div>
          <div className="eyebrow">Inventory</div>
          <h3>{props.selectedProvider} Keys</h3>
        </div>
      </div>
      {props.keys.length === 0 ? (
        <p className="warning-banner">No keys saved for this provider.</p>
      ) : null}
      <div className="data-table">
        <div className="data-row data-head five-col">
          <span>Fingerprint</span>
          <span>Status</span>
          <span>Tags</span>
          <span>Last Error</span>
          <span>Action</span>
        </div>
        {props.keys.map((item) => (
          <div key={item.id} className="data-row five-col">
            <span className="mono">{item.fingerprint}</span>
            <span className={`status-pill ${item.enabled ? "positive" : "danger"}`}>
              {item.enabled ? "enabled" : "disabled"}
            </span>
            <span>{item.tags.join(", ") || "-"}</span>
            <span>{item.lastError || "-"}</span>
            <span>
              <button
                className="text-button"
                onClick={() => props.onDeleteKey(item.id)}
              >
                Delete
              </button>
            </span>
          </div>
        ))}
      </div>
    </article>
  );
}
