import type { Dispatch, SetStateAction } from "react";
import { Save, Settings } from "lucide-react";
import {
  type KeyPoolProvider,
  type McpAccessInfo,
  type SystemSettings,
} from "@shared/contracts";
import { LoadingOverlay } from "./Feedback";
import type { ToastTone } from "./Feedback";
import { McpAccessFields } from "./McpAccessFields";

type StrategyPanelProps = Readonly<{
  loading: boolean;
  mcpAccess: McpAccessInfo;
  onSaveMcpAccess: (token: string) => Promise<boolean>;
  system: SystemSettings;
  onToast: (type: ToastTone, message: string) => void;
  setSystem: Dispatch<SetStateAction<SystemSettings>>;
  onSave: () => void;
}>;

function FetchModeField(props: StrategyPanelProps) {
  return (
    <label className="field">
      <span>Fetch / Map Mode</span>
      <select
        disabled={props.loading}
        value={props.system.fetchMode}
        onChange={(event) =>
          props.setSystem((current) => ({
            ...current,
            fetchMode: event.target.value as SystemSettings["fetchMode"],
          }))
        }
      >
        <option value="auto_ordered">auto_ordered</option>
        <option value="strict_tavily">strict_tavily</option>
        <option value="strict_firecrawl">strict_firecrawl</option>
      </select>
    </label>
  );
}

function ProviderPriorityFields(props: StrategyPanelProps) {
  return (
    <div className="split-fields">
      <label className="field">
        <span>First Provider</span>
        <select
          disabled={props.loading}
          value={props.system.providerPriority[0]}
          onChange={(event) => {
            const first = event.target.value as KeyPoolProvider;
            const second: KeyPoolProvider = first === "tavily" ? "firecrawl" : "tavily";
            props.setSystem((current) => ({
              ...current,
              providerPriority: [first, second],
            }));
          }}
        >
          <option value="tavily">tavily</option>
          <option value="firecrawl">firecrawl</option>
        </select>
      </label>
      <label className="field">
        <span>Second Provider</span>
        <input disabled={props.loading} value={props.system.providerPriority[1]} readOnly />
      </label>
    </div>
  );
}

function StrategyMetaFields(props: StrategyPanelProps) {
  return (
    <div className="split-fields">
      <label className="field">
        <span>Log Retention Days</span>
        <input
          disabled={props.loading}
          type="number"
          value={props.system.logRetentionDays}
          onChange={(event) =>
            props.setSystem((current) => ({
              ...current,
              logRetentionDays: Number(event.target.value || 7),
            }))
          }
        />
      </label>
      <label className="field">
        <span>Allowed Origins</span>
        <input
          disabled={props.loading}
          value={props.system.allowedOrigins.join(",")}
          onChange={(event) =>
            props.setSystem((current) => ({
              ...current,
              allowedOrigins: event.target.value
                .split(",")
                .map((value) => value.trim())
                .filter(Boolean),
            }))
          }
        />
      </label>
    </div>
  );
}

export function StrategyPanel(props: StrategyPanelProps) {
  return (
    <article className="surface-card">
      {props.loading ? <LoadingOverlay label="Refreshing strategy" /> : null}
      <div className="section-heading">
        <div>
          <div className="eyebrow">Routing</div>
          <h3>Global Strategy</h3>
        </div>
        <Settings size={16} className="section-icon" />
      </div>
      <FetchModeField {...props} />
      <ProviderPriorityFields {...props} />
      <StrategyMetaFields {...props} />
      <div className="action-row">
        <button className="primary-button" disabled={props.loading} type="button" onClick={props.onSave}>
          <Save size={14} />
          Save Strategy
        </button>
      </div>
      <McpAccessFields
        loading={props.loading}
        mcpAccess={props.mcpAccess}
        onSaveMcpAccess={props.onSaveMcpAccess}
        onToast={props.onToast}
      />
    </article>
  );
}
