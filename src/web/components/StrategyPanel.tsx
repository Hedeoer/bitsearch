import { useEffect } from "react";
import type { Dispatch, SetStateAction } from "react";
import { Bot, Layers3, Save, Settings2, Waypoints } from "lucide-react";
import type {
  AdminAccessInfo,
  KeyPoolProvider,
  McpAccessInfo,
  SystemSettings,
  ToolSurfaceSnapshot,
} from "@shared/contracts";
import { LoadingOverlay } from "./Feedback";
import type { ToastTone } from "./Feedback";
import { AdminAccessFields } from "./AdminAccessFields";
import { McpAccessFields } from "./McpAccessFields";

type StrategyPanelProps = Readonly<{
  loading: boolean;
  adminAccess: AdminAccessInfo;
  onSaveAdminAccess: (authKey: string) => Promise<boolean>;
  mcpAccess: McpAccessInfo;
  onSaveMcpAccess: (token: string) => Promise<boolean>;
  system: SystemSettings;
  toolSurface: ToolSurfaceSnapshot;
  onToast: (type: ToastTone, message: string) => void;
  setSystem: Dispatch<SetStateAction<SystemSettings>>;
  onSave: () => void;
}>;

function getSecondaryProvider(primary: KeyPoolProvider): KeyPoolProvider {
  return primary === "tavily" ? "firecrawl" : "tavily";
}

function StatusChip(props: Readonly<{ ok: boolean; text: string }>) {
  return (
    <span className={`chip ${props.ok ? "success-chip" : "warning-chip"}`}>
      {props.text}
    </span>
  );
}

function RoutingCard(props: StrategyPanelProps) {
  const availableGenericProviders = props.toolSurface.providerCapabilities
    .filter((item) => item.genericAvailable)
    .map((item) => item.provider);
  const availableProvidersKey = availableGenericProviders.join(",");
  const selectedPrimary = props.system.genericProviderOrder[0] ?? "tavily";
  const canUseFailover = availableGenericProviders.length > 1;

  useEffect(() => {
    if (availableGenericProviders.length !== 1) {
      return;
    }
    const onlyProvider = availableGenericProviders[0];
    if (
      props.system.genericRoutingMode === "single_provider" &&
      props.system.genericProviderOrder[0] === onlyProvider
    ) {
      return;
    }
    props.setSystem((current) => ({
      ...current,
      genericRoutingMode: "single_provider",
      genericProviderOrder: [onlyProvider],
    }));
  }, [
    availableProvidersKey,
    props.setSystem,
    props.system.genericProviderOrder,
    props.system.genericRoutingMode,
  ]);

  return (
    <article className="surface-card page-panel">
      {props.loading ? <LoadingOverlay label="Refreshing routing" /> : null}
      <div className="section-heading">
        <div>
          <div className="eyebrow">Layer 1</div>
          <h3>Generic Retrieval Routing</h3>
          <p className="supporting">
            This routing affects only `web_fetch`, `web_map`, and `web_search`
            extra sources.
          </p>
        </div>
        <Settings2 size={16} className="section-icon" />
      </div>

      <label className="field">
        <span>Routing Mode</span>
        <select
          disabled={props.loading}
          value={props.system.genericRoutingMode}
          onChange={(event) => {
            const nextMode = event.target.value as SystemSettings["genericRoutingMode"];
            props.setSystem((current) => ({
              ...current,
              genericRoutingMode: nextMode,
              genericProviderOrder:
                nextMode === "single_provider"
                  ? [current.genericProviderOrder[0] ?? "tavily"]
                  : [
                      current.genericProviderOrder[0] ?? "tavily",
                      getSecondaryProvider(current.genericProviderOrder[0] ?? "tavily"),
                    ],
            }));
          }}
        >
          <option value="single_provider">single_provider</option>
          <option value="ordered_failover" disabled={!canUseFailover}>
            ordered_failover
          </option>
        </select>
      </label>

      <div className="split-fields">
        <label className="field">
          <span>Primary Provider</span>
          <select
            disabled={props.loading}
            value={selectedPrimary}
            onChange={(event) => {
              const primary = event.target.value as KeyPoolProvider;
              props.setSystem((current) => ({
                ...current,
                genericProviderOrder:
                  current.genericRoutingMode === "single_provider"
                    ? [primary]
                    : [primary, getSecondaryProvider(primary)],
              }));
            }}
          >
            <option value="tavily">tavily</option>
            <option value="firecrawl">firecrawl</option>
          </select>
        </label>
        <label className="field">
          <span>Fallback Provider</span>
          <input
            disabled
            value={
              props.system.genericRoutingMode === "ordered_failover"
                ? props.system.genericProviderOrder[1] ?? getSecondaryProvider(selectedPrimary)
                : "not used"
            }
            readOnly
          />
        </label>
      </div>

      <div className="section-grid">
        <div className="support-card">
          <strong>Affected Tools</strong>
          <p className="supporting compact mono">
            {props.toolSurface.genericRouting.affectedTools.join(", ")}
          </p>
        </div>
        <div className="support-card">
          <strong>Unaffected Tools</strong>
          <p className="supporting compact mono">
            {props.toolSurface.genericRouting.unaffectedTools.join(", ")}
          </p>
        </div>
      </div>

      {!canUseFailover ? (
        <p className="supporting compact">
          Only one generic provider is currently available, so the UI narrows
          routing to `single_provider`.
        </p>
      ) : null}

      <div className="action-row">
        <button className="primary-button" disabled={props.loading} type="button" onClick={props.onSave}>
          <Save size={14} />
          Save Routing
        </button>
      </div>
    </article>
  );
}

function CapabilityCard(props: Readonly<{ toolSurface: ToolSurfaceSnapshot }>) {
  return (
    <article className="surface-card page-panel">
      <div className="section-heading">
        <div>
          <div className="eyebrow">Layer 2</div>
          <h3>Provider Capability Status</h3>
          <p className="supporting">
            Provider-native tools are exposed only when the named provider is
            enabled and has at least one enabled key.
          </p>
        </div>
        <Layers3 size={16} className="section-icon" />
      </div>
      <div className="capability-grid">
        {props.toolSurface.providerCapabilities.map((item) => (
          <div key={item.provider} className="support-card capability-card">
            <div className="workspace-feed-top">
              <strong>{item.provider}</strong>
              <StatusChip
                ok={item.genericAvailable}
                text={item.genericAvailable ? "available" : "limited"}
              />
            </div>
            <p className="supporting compact">
              enabled={String(item.enabled)} · enabled keys={item.enabledKeyCount}
            </p>
            <p className="supporting compact mono">
              exposed: {item.exposedTools.join(", ") || "none"}
            </p>
            <p className="supporting compact mono">
              hidden:{" "}
              {item.hiddenTools.map((tool) => `${tool.tool} (${tool.reason})`).join(", ") || "none"}
            </p>
          </div>
        ))}
      </div>
    </article>
  );
}

function ToolSurfaceCard(props: Readonly<{ toolSurface: ToolSurfaceSnapshot }>) {
  return (
    <article className="surface-card page-panel">
      <div className="section-heading">
        <div>
          <div className="eyebrow">Session Surface</div>
          <h3>Current Tool Surface</h3>
          <p className="supporting">
            Tool availability changes may require client refresh support, while
            behavior changes for existing tools apply immediately to subsequent
            calls.
          </p>
        </div>
        <Waypoints size={16} className="section-icon" />
      </div>
      <div className="section-grid">
        <div className="support-card">
          <strong>Generic Tools</strong>
          <p className="supporting compact mono">
            {props.toolSurface.genericTools.join(", ")}
          </p>
        </div>
        <div className="support-card">
          <strong>Provider Tools</strong>
          <p className="supporting compact mono">
            {props.toolSurface.providerTools.join(", ") || "none"}
          </p>
        </div>
      </div>
      <div className="support-card">
        <strong>Hidden Tools</strong>
        <p className="supporting compact mono">
          {props.toolSurface.hiddenTools.map((tool) => `${tool.tool} (${tool.reason})`).join(", ") || "none"}
        </p>
      </div>
      <p className="supporting compact">
        tool surface refresh may require client refresh=
        {String(props.toolSurface.requiresReconnect)} · behavior changes apply
        immediately={String(props.toolSurface.behaviorChangesApplyImmediately)} ·
        last refreshed={props.toolSurface.lastRefreshedAt || "n/a"}
      </p>
    </article>
  );
}

function GuidanceCard(props: Readonly<{ toolSurface: ToolSurfaceSnapshot }>) {
  return (
    <article className="surface-card page-panel">
      <div className="section-heading">
        <div>
          <div className="eyebrow">Client Guidance</div>
          <h3>System-Aware Prompting</h3>
          <p className="supporting">
            The system now explains current routing and exposed tools directly,
            so clients do not need a long static prompt to infer provider rules.
          </p>
        </div>
        <Bot size={16} className="section-icon" />
      </div>
      <div className="support-card">
        <strong>System Behavior</strong>
        <ul className="support-list">
          {props.toolSurface.clientGuidance.systemBehavior.map((line) => (
            <li key={line} className="supporting compact">
              {line}
            </li>
          ))}
        </ul>
      </div>
      <label className="field">
        <span>Recommended Prompt</span>
        <textarea readOnly value={props.toolSurface.clientGuidance.recommendedPrompt} />
      </label>
    </article>
  );
}

function AccessCard(props: StrategyPanelProps) {
  return (
    <article className="surface-card page-panel">
      <div className="section-heading">
        <div>
          <div className="eyebrow">Access</div>
          <h3>Console And MCP Access</h3>
        </div>
        <Settings2 size={16} className="section-icon" />
      </div>
      <AdminAccessFields
        adminAccess={props.adminAccess}
        loading={props.loading}
        onSaveAdminAccess={props.onSaveAdminAccess}
        onToast={props.onToast}
      />
      <McpAccessFields
        loading={props.loading}
        mcpAccess={props.mcpAccess}
        onSaveMcpAccess={props.onSaveMcpAccess}
        onToast={props.onToast}
      />
    </article>
  );
}

export function StrategyPanel(props: StrategyPanelProps) {
  return (
    <div className="page-panel">
      <RoutingCard {...props} />
      <CapabilityCard toolSurface={props.toolSurface} />
      <ToolSurfaceCard toolSurface={props.toolSurface} />
      <GuidanceCard toolSurface={props.toolSurface} />
      <AccessCard {...props} />
    </div>
  );
}
