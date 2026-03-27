import type { Dispatch, SetStateAction } from "react";
import type {
  DashboardSummary,
  ProviderConfigRecord,
  SystemSettings,
} from "@shared/contracts";
import type { ProviderDrafts } from "../types";
import { LoadingOverlay } from "./Feedback";

type OverviewProps = {
  dashboard: DashboardSummary | null;
  loading: boolean;
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

const METRICS = [
  { key: "totalRequests", label: "Total Requests" },
  { key: "successCount", label: "Successful Calls" },
  { key: "failedCount", label: "Failed Calls" },
] as const;

function renderMetricValue(value: number | undefined, loading: boolean) {
  if (loading && typeof value !== "number") {
    return <span className="skeleton-text" />;
  }
  return value ?? 0;
}

function ProviderSkeletonCard({ index }: { index: number }) {
  return (
    <article key={index} className="surface-card provider-card interactive-card">
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

export function OverviewPanel(props: OverviewProps) {
  return (
    <article className="surface-card" id="overview">
      {props.loading ? <LoadingOverlay label="Refreshing overview" /> : null}
      <div className="section-heading">
        <div>
          <div className="eyebrow">Overview</div>
          <h3>Service Pulse</h3>
        </div>
      </div>
      <div className="metric-grid">
        {METRICS.map((item) => (
          <div key={item.key} className="metric-card">
            <span>{item.label}</span>
            <strong>{renderMetricValue(props.dashboard?.[item.key], props.loading)}</strong>
          </div>
        ))}
      </div>
      <div className="chip-row">
        {(props.dashboard?.providerErrors ?? []).map((item) => (
          <span key={item.provider} className="chip warning-chip">
            {item.provider}: {item.count} errors
          </span>
        ))}
      </div>
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
        <input
          disabled={props.loading}
          value={props.system.defaultGrokModel}
          onChange={(event) =>
            props.setSystem((current) => ({
              ...current,
              defaultGrokModel: event.target.value,
            }))
          }
        />
      </label>
      <div className="split-fields">
        <label className="field">
          <span>First Provider</span>
          <select
            disabled={props.loading}
            value={props.system.providerPriority[0]}
            onChange={(event) => {
              const first = event.target.value as "tavily" | "firecrawl";
              const second = first === "tavily" ? "firecrawl" : "tavily";
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
                  .map((item) => item.trim())
                  .filter(Boolean),
              }))
            }
          />
        </label>
      </div>
      <button className="primary-button" disabled={props.loading} onClick={props.onSave}>
        Save Strategy
      </button>
    </article>
  );
}

export function ProviderGrid(props: ProviderGridProps) {
  if (props.loading && props.providers.length === 0) {
    return (
      <section className="provider-grid" id="providers">
        {[0, 1, 2].map((index) => (
          <ProviderSkeletonCard key={index} index={index} />
        ))}
      </section>
    );
  }
  return (
    <section className="provider-grid" id="providers">
      {props.providers.map((provider) => {
        const draft = props.drafts[provider.provider];
        if (!draft) {
          return null;
        }
        return (
          <article key={provider.provider} className="surface-card provider-card interactive-card">
            {props.loading ? <LoadingOverlay label={`Refreshing ${provider.provider}`} /> : null}
            <div className="section-heading compact">
              <div>
                <div className="eyebrow">Provider</div>
                <h3>{provider.provider}</h3>
              </div>
              <span className={`chip ${draft.enabled ? "positive-chip" : "neutral-chip"}`}>
                {draft.enabled ? "enabled" : "disabled"}
              </span>
            </div>
            <p className="supporting">
              {provider.provider === "grok"
                ? provider.hasApiKey
                  ? "Grok API key stored and ready."
                  : "Grok API key missing."
                : `Key pool count: ${provider.keyCount}`}
            </p>
            {provider.provider !== "grok" && provider.enabled && provider.keyCount === 0 ? (
              <p className="warning-banner">Enabled but no provider keys are loaded.</p>
            ) : null}
            <label className="checkbox-row">
              <input
                disabled={props.loading}
                type="checkbox"
                checked={draft.enabled}
                onChange={(event) =>
                  props.setDrafts((current) => ({
                    ...current,
                    [provider.provider]: {
                      ...current[provider.provider],
                      enabled: event.target.checked,
                    },
                  }))
                }
              />
              <span>Enabled</span>
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
            <button
              className="secondary-button"
              disabled={props.loading}
              onClick={() => props.onSave(provider.provider)}
            >
              Save Provider
            </button>
          </article>
        );
      })}
    </section>
  );
}
