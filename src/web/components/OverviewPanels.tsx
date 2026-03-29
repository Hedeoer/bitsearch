import {
  useEffect,
  useId,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  SEARCH_ENGINE_PROVIDER,
  type ProviderConfigRecord,
  type SearchEngineModelsResponse,
} from "@shared/contracts";
import {
  ChevronDown,
  Eye,
  EyeOff,
  Server,
  Zap,
  Save,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import type { ApiResult } from "../api";
import type { ProviderDrafts } from "../types";
import { InlineSpinner, LoadingOverlay } from "./Feedback";

type ProviderGridProps = {
  loading: boolean;
  providers: ProviderConfigRecord[];
  drafts: ProviderDrafts;
  setDrafts: Dispatch<SetStateAction<ProviderDrafts>>;
  onSave: (provider: string) => void;
  onProbeSearchModels: () => Promise<ApiResult<SearchEngineModelsResponse>>;
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

function buildDetectedModelOptions(currentModel: string, models: string[]): string[] {
  return [...new Set([currentModel, ...models].map((item) => item.trim()).filter(Boolean))];
}

function SearchEngineModelField(
  props: Readonly<{
    loading: boolean;
    searchModel: string;
    setSearchModel: (value: string) => void;
    onProbeSearchModels: () => Promise<ApiResult<SearchEngineModelsResponse>>;
  }>,
) {
  const fieldRef = useRef<HTMLLabelElement | null>(null);
  const listId = useId();
  const [detectedModels, setDetectedModels] = useState<string[]>([]);
  const [probeError, setProbeError] = useState("");
  const [probeMessage, setProbeMessage] = useState("");
  const [isProbing, setIsProbing] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const options = buildDetectedModelOptions(props.searchModel, detectedModels);
  const isExactDetectedModel = detectedModels.includes(props.searchModel.trim());
  const visibleOptions =
    props.searchModel.trim().length > 0 && !isExactDetectedModel
      ? options.filter((model) =>
          model.toLowerCase().includes(props.searchModel.trim().toLowerCase()),
        )
      : options;
  const currentModelMissing =
    detectedModels.length > 0 &&
    props.searchModel.trim().length > 0 &&
    !detectedModels.includes(props.searchModel);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!fieldRef.current?.contains(event.target as Node)) {
        setIsPickerOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  async function probeModels() {
    setIsProbing(true);
    setProbeError("");
    setProbeMessage("");
    try {
      const result = await props.onProbeSearchModels();
      if (!result.ok) {
        setDetectedModels([]);
        setProbeError(result.message);
        return;
      }
      setDetectedModels(result.data.models);
      setIsPickerOpen(result.data.models.length > 0);
      setProbeMessage(
        result.data.models.length > 0
          ? `Detected ${result.data.models.length} models from /models.`
          : "Probe completed, but /models returned no entries.",
      );
    } catch (error) {
      setDetectedModels([]);
      setProbeError(error instanceof Error ? error.message : "Model probe failed.");
    } finally {
      setIsProbing(false);
    }
  }

  return (
    <label ref={fieldRef} className="field">
      <span>Search Model</span>
      <div className="field-with-action">
        <div className="search-model-picker">
          <div className="search-model-picker-control">
            <input
              aria-controls={listId}
              aria-expanded={isPickerOpen}
              aria-haspopup="listbox"
              disabled={props.loading}
              placeholder="Probe models first or enter a model name manually"
              value={props.searchModel}
              onChange={(event) => {
                props.setSearchModel(event.target.value);
                if (options.length > 0) {
                  setIsPickerOpen(true);
                }
              }}
              onFocus={() => {
                if (options.length > 0) {
                  setIsPickerOpen(true);
                }
              }}
            />
            <button
              className="icon-button search-model-picker-toggle"
              disabled={props.loading || options.length === 0}
              type="button"
              aria-label={isPickerOpen ? "Collapse model list" : "Expand model list"}
              onClick={() => setIsPickerOpen((current) => !current)}
            >
              <ChevronDown
                size={16}
                className={isPickerOpen ? "search-model-picker-chevron-open" : ""}
              />
            </button>
          </div>
          {isPickerOpen && options.length > 0 ? (
            <div id={listId} className="search-model-picker-menu" role="listbox">
              {visibleOptions.length > 0 ? (
                visibleOptions.map((model) => (
                  <button
                    key={model}
                    className={`search-model-picker-option${
                      model === props.searchModel ? " search-model-picker-option-active" : ""
                    }`}
                    type="button"
                    role="option"
                    aria-selected={model === props.searchModel}
                    onClick={() => {
                      props.setSearchModel(model);
                      setIsPickerOpen(false);
                    }}
                  >
                    {model}
                  </button>
                ))
              ) : (
                <div className="search-model-picker-empty">
                  No detected models match the current input.
                </div>
              )}
            </div>
          ) : null}
        </div>
        <button
          className="secondary-button"
          disabled={props.loading || isProbing}
          type="button"
          onClick={() => void probeModels()}
        >
          {isProbing ? <InlineSpinner label="Probing" /> : "Probe Models"}
        </button>
      </div>
      <p className="field-note">
        {options.length > 0
          ? "Current value is the active default search model. The picker shows probed models with in-place filtering."
          : "Probe models to populate the dropdown, or enter a model name manually before probing."}{" "}
        Probe uses the saved search_engine base URL and API key.
      </p>
      {probeMessage ? <p className="supporting compact">{probeMessage}</p> : null}
      {currentModelMissing ? (
        <p className="supporting compact">
          Current value is not present in the detected model list.
        </p>
      ) : null}
      {probeError ? <p className="supporting compact error-summary">{probeError}</p> : null}
    </label>
  );
}

export function ProviderGrid(props: ProviderGridProps) {
  const [visibleBaseUrls, setVisibleBaseUrls] = useState<Record<string, boolean>>({});

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
            searchModel: "",
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
                <div className="field-with-action">
                  <input
                    disabled={props.loading}
                    type={provider.provider === SEARCH_ENGINE_PROVIDER && !visibleBaseUrls[provider.provider] ? "password" : "text"}
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
                  {provider.provider === SEARCH_ENGINE_PROVIDER ? (
                    <button
                      className="icon-button"
                      type="button"
                      aria-label={visibleBaseUrls[provider.provider] ? "Hide Base URL" : "Show Base URL"}
                      onClick={() =>
                        setVisibleBaseUrls((current) => ({
                          ...current,
                          [provider.provider]: !current[provider.provider],
                        }))
                      }
                    >
                      {visibleBaseUrls[provider.provider] ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  ) : null}
                </div>
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
              {provider.provider === SEARCH_ENGINE_PROVIDER ? (
                <>
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
                  <SearchEngineModelField
                    loading={props.loading}
                    searchModel={draft.searchModel}
                    setSearchModel={(value) =>
                      props.setDrafts((current) => ({
                        ...current,
                        [provider.provider]: {
                          ...current[provider.provider],
                          searchModel: value,
                        },
                      }))
                    }
                    onProbeSearchModels={props.onProbeSearchModels}
                  />
                </>
              ) : null}
              <div className="action-row">
                <button
                  className="secondary-button"
                  disabled={props.loading}
                  onClick={() => props.onSave(provider.provider)}
                >
                  <Save size={13} />
                  {provider.provider === SEARCH_ENGINE_PROVIDER ? "Save Search Engine" : "Save Provider"}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
