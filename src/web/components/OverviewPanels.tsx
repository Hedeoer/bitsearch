import type { Dispatch, SetStateAction } from "react";
import {
  Server,
  Zap,
  Save,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import type {
  ProviderConfigRecord,
} from "@shared/contracts";
import type { ProviderDrafts } from "../types";
import { LoadingOverlay } from "./Feedback";

type ProviderGridProps = {
  loading: boolean;
  providers: ProviderConfigRecord[];
  drafts: ProviderDrafts;
  setDrafts: Dispatch<SetStateAction<ProviderDrafts>>;
  onSave: (provider: string) => void;
};

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
