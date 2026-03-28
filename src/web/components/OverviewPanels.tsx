import type { Dispatch, SetStateAction } from "react";
import {
  Activity,
  CheckCircle,
  XCircle,
  Server,
  Zap,
  Save,
  ToggleLeft,
  ToggleRight,
  AlertTriangle,
  Settings,
  KeyRound,
} from "lucide-react";
import type {
  DashboardSummary,
  KeyPoolProvider,
  ProviderConfigRecord,
  SystemSettings,
} from "@shared/contracts";
import type { ProviderDrafts } from "../types";
import { LoadingOverlay } from "./Feedback";

type OverviewProps = {
  dashboard: DashboardSummary | null;
  loading: boolean;
  providers: ProviderConfigRecord[];
};

type StrategyProps = {
  loading: boolean;
  system: SystemSettings;
  setSystem: Dispatch<SetStateAction<SystemSettings>>;
  onSave: () => void;
};

type ProviderGridProps = {
  loading: boolean;
  providers: ProviderConfigRecord[];
  drafts: ProviderDrafts;
  setDrafts: Dispatch<SetStateAction<ProviderDrafts>>;
  onSave: (provider: string) => void;
};



function renderMetricValue(value: number | undefined, loading: boolean) {
  if (loading && typeof value !== "number") {
    return <span className="skeleton-text" />;
  }
  return value ?? 0;
}

export function OverviewPanel(props: OverviewProps) {
  const activeProviders = props.providers.filter((p) => p.enabled).length;
  const totalKeys = props.providers.reduce((sum, p) => sum + p.keyCount, 0);

  return (
    <article className="surface-card">
      {props.loading ? <LoadingOverlay label="Refreshing overview" /> : null}
      <div className="section-heading">
        <div>
          <div className="eyebrow">Dashboard</div>
          <h3>Service Pulse</h3>
        </div>
      </div>
      <div className="metric-grid">
        <div className="metric-card metric-card--primary">
          <div className="metric-icon">
            <Activity size={16} />
          </div>
          <strong className="metric-value">
            {renderMetricValue(props.dashboard?.totalRequests, props.loading)}
          </strong>
          <span className="metric-label">Total Requests</span>
        </div>
        <div className="metric-card metric-card--success">
          <div className="metric-icon">
            <CheckCircle size={16} />
          </div>
          <strong className="metric-value">
            {renderMetricValue(props.dashboard?.successCount, props.loading)}
          </strong>
          <span className="metric-label">Successful</span>
        </div>
        <div className="metric-card metric-card--danger">
          <div className="metric-icon">
            <XCircle size={16} />
          </div>
          <strong className="metric-value">
            {renderMetricValue(props.dashboard?.failedCount, props.loading)}
          </strong>
          <span className="metric-label">Failed</span>
        </div>
        <div className="metric-card metric-card--primary">
          <div className="metric-icon">
            <Server size={16} />
          </div>
          <strong className="metric-value">
            {renderMetricValue(activeProviders, props.loading)}
          </strong>
          <span className="metric-label">Active Providers</span>
        </div>
        <div className="metric-card metric-card--primary">
          <div className="metric-icon">
            <KeyRound size={16} />
          </div>
          <strong className="metric-value">
            {renderMetricValue(totalKeys, props.loading)}
          </strong>
          <span className="metric-label">Total Keys</span>
        </div>
      </div>
      {(props.dashboard?.providerErrors ?? []).length > 0 && (
        <div className="chip-row" style={{ marginTop: "0.75rem" }}>
          {(props.dashboard?.providerErrors ?? []).map((item) => (
            <span key={item.provider} className="chip warning-chip">
              <AlertTriangle size={11} />
              {item.provider}: {item.count} errors
            </span>
          ))}
        </div>
      )}
    </article>
  );
}

export function StrategyPanel(props: StrategyProps) {
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
      <label className="field">
        <span>Default Grok Model</span>
        <select
          disabled={props.loading}
          value={props.system.defaultGrokModel}
          onChange={(event) =>
            props.setSystem((current) => ({
              ...current,
              defaultGrokModel: event.target.value,
            }))
          }
        >
          <option value="grok-4-fast">grok-4-fast</option>
          <option value="grok-4">grok-4</option>
          <option value="grok-3">grok-3</option>
          <option value="grok-3-fast">grok-3-fast</option>
          <option value="grok-3-mini">grok-3-mini</option>
          <option value="grok-3-mini-fast">grok-3-mini-fast</option>
        </select>
      </label>
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
                  .map((s) => s.trim())
                  .filter(Boolean),
              }))
            }
          />
        </label>
      </div>
      <div className="action-row">
        <button className="primary-button" disabled={props.loading} onClick={props.onSave}>
          <Save size={14} />
          Save Strategy
        </button>
      </div>
    </article>
  );
}

function ProviderSkeletonCard({ index }: { index: number }) {
  return (
    <article key={index} className="surface-card provider-card">
      <LoadingOverlay label="Loading provider" />
      <div className="section-heading compact">
        <div>
          <div className="eyebrow">Provider</div>
          <h3>Loading...</h3>
        </div>
      </div>
    </article>
  );
}

export function ProviderGrid(props: ProviderGridProps) {
  if (props.loading && props.providers.length === 0) {
    return (
      <section className="provider-grid">
        <div className="section-heading">
          <div>
            <div className="eyebrow">Integrations</div>
            <h3>Search Providers</h3>
          </div>
        </div>
        <div className="provider-cards">
          <ProviderSkeletonCard index={0} />
          <ProviderSkeletonCard index={1} />
          <ProviderSkeletonCard index={2} />
        </div>
      </section>
    );
  }

  return (
    <section className="provider-grid">
      <div className="section-heading">
        <div>
          <div className="eyebrow">Integrations</div>
          <h3>Search Providers</h3>
        </div>
        <Server size={16} className="section-icon" />
      </div>
      <div className="provider-cards">
        {props.providers.map((provider) => {
          const draft = props.drafts[provider.provider] ?? {
            enabled: provider.enabled,
            baseUrl: provider.baseUrl,
            timeoutMs: provider.timeoutMs,
            apiKey: "",
          };
          return (
            <article key={provider.provider} className="surface-card provider-card">
              {props.loading ? <LoadingOverlay label="Refreshing" /> : null}
              <div className="section-heading compact">
                <div>
                  <div className="eyebrow">Provider</div>
                  <h3>{provider.provider}</h3>
                </div>
                <div className="provider-meta">
                  <span
                    className={`chip ${
                      provider.enabled ? "success-chip" : "neutral-chip"
                    }`}
                  >
                    {provider.enabled ? (
                      <ToggleRight size={12} />
                    ) : (
                      <ToggleLeft size={12} />
                    )}
                    {provider.enabled ? "Active" : "Disabled"}
                  </span>
                  <span className="chip neutral-chip">
                    <Zap size={11} />
                    {provider.keyCount} keys
                  </span>
                </div>
              </div>
              <label className="field">
                <span>Enabled</span>
                <select
                  disabled={props.loading}
                  value={String(draft.enabled)}
                  onChange={(event) =>
                    props.setDrafts((current) => ({
                      ...current,
                      [provider.provider]: {
                        ...current[provider.provider],
                        enabled: event.target.value === "true",
                      },
                    }))
                  }
                >
                  <option value="true">Enabled</option>
                  <option value="false">Disabled</option>
                </select>
              </label>
              <label className="field">
                <span>Base URL</span>
                <input
                  disabled={props.loading}
                  value={draft.baseUrl}
                  onChange={(event) =>
                    props.setDrafts((current) => ({
                      ...current,
                      [provider.provider]: {
                        ...current[provider.provider],
                        baseUrl: event.target.value,
                      },
                    }))
                  }
                />
              </label>
              <label className="field">
                <span>Timeout (ms)</span>
                <input
                  disabled={props.loading}
                  type="number"
                  value={draft.timeoutMs}
                  onChange={(event) =>
                    props.setDrafts((current) => ({
                      ...current,
                      [provider.provider]: {
                        ...current[provider.provider],
                        timeoutMs: Number(event.target.value || 30000),
                      },
                    }))
                  }
                />
              </label>
              {provider.provider === "grok" ? (
                <label className="field">
                  <span>API Key</span>
                  <input
                    disabled={props.loading}
                    type="password"
                    placeholder={provider.hasApiKey ? "Stored. Fill only to replace." : "Enter API key"}
                    value={draft.apiKey}
                    onChange={(event) =>
                      props.setDrafts((current) => ({
                        ...current,
                        [provider.provider]: {
                          ...current[provider.provider],
                          apiKey: event.target.value,
                        },
                      }))
                    }
                  />
                </label>
              ) : null}
              <div className="action-row">
                <button
                  className="secondary-button"
                  disabled={props.loading}
                  onClick={() => props.onSave(provider.provider)}
                >
                  <Save size={13} />
                  Save Provider
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
