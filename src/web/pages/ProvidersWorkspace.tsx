import { useState } from "react";
import type {
  ProviderConfigRecord,
  RemoteProvider,
  SearchEngineApiFormat,
  SearchEngineRequestTestResponse,
  SystemSettings,
  ToolSurfaceSnapshot,
} from "@shared/contracts";
import { SEARCH_ENGINE_PROVIDER } from "@shared/contracts";
import { ProviderMasterList } from "../components/providers/ProviderMasterList";
import { ProviderDetailPanel } from "../components/providers/ProviderDetailPanel";
import { ProbeModelsDialog } from "../components/providers/ProbeModelsDialog";
import { SearchEngineRequestTestDialog } from "../components/providers/SearchEngineRequestTestDialog";
import { ToolSurfaceCard } from "../components/providers/ToolSurfaceCard";
import {
  buildSearchEngineConnectionPayload,
  probeSearchEngineModels,
  testSearchEngineRequest,
  type ProviderSaveErrors,
} from "../provider-actions";
import type { ProviderDraft, ProviderDrafts } from "../types";

type ProvidersWorkspaceProps = Readonly<{
  dirtyProviders: RemoteProvider[];
  drafts: ProviderDrafts;
  loading: boolean;
  onDraftChange: (provider: RemoteProvider, patch: Partial<ProviderDraft>) => void;
  onSaveAll: () => void;
  providers: ProviderConfigRecord[];
  saveErrors: ProviderSaveErrors;
  saving: boolean;
  system: SystemSettings;
  toolSurface: ToolSurfaceSnapshot;
}>;

function createRequestTestFailure(
  apiFormat: SearchEngineApiFormat,
  model: string,
  message: string,
  statusCode: number | null,
): SearchEngineRequestTestResponse {
  return {
    provider: SEARCH_ENGINE_PROVIDER,
    apiFormat,
    status: "failed",
    model,
    durationMs: 0,
    responsePreview: null,
    statusCode,
    error: message,
    modelProbe: {
      status: "failed",
      probeMode: "models_endpoint",
      modelsCount: null,
      modelListed: null,
      message: null,
    },
  };
}

export function ProvidersWorkspace(props: ProvidersWorkspaceProps) {
  const [selectedProvider, setSelectedProvider] = useState<RemoteProvider | null>(
    SEARCH_ENGINE_PROVIDER
  );
  const [visibleApiKeys, setVisibleApiKeys] = useState<Record<string, boolean>>({});
  const [isRevealingApiKey, setIsRevealingApiKey] = useState(false);
  const [apiKeyRevealError, setApiKeyRevealError] = useState("");
  const [probeOpen, setProbeOpen] = useState(false);
  const [probeModels, setProbeModels] = useState<string[]>([]);
  const [probeError, setProbeError] = useState("");
  const [isProbing, setIsProbing] = useState(false);
  const [requestTestOpen, setRequestTestOpen] = useState(false);
  const [requestTestResult, setRequestTestResult] = useState<SearchEngineRequestTestResponse | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  const dirtyProviderSet = new Set(props.dirtyProviders);
  const selectedProviderRecord = props.providers.find(
    (p) => p.provider === selectedProvider
  ) ?? null;
  const selectedDraft = selectedProvider ? props.drafts[selectedProvider] : null;
  const isDirty = selectedProvider ? dirtyProviderSet.has(selectedProvider) : false;
  const searchEngineDraft = props.drafts[SEARCH_ENGINE_PROVIDER] ?? null;

  const toggleApiKey = () => {
    if (!selectedProvider) return;
    setVisibleApiKeys((prev) => ({
      ...prev,
      [selectedProvider]: !prev[selectedProvider],
    }));
  };

  const apiKeyInputType: "password" | "text" = selectedProvider
    ? visibleApiKeys[selectedProvider]
      ? "text"
      : selectedDraft?.revealedApiKey
        ? "password"
        : "text"
    : "text";

  async function openProbeDialog() {
    if (!searchEngineDraft) {
      return;
    }

    const connectionPayload = buildSearchEngineConnectionPayload(searchEngineDraft);
    setProbeOpen(true);
    setProbeModels([]);
    setProbeError("");
    setIsProbing(true);

    try {
      const result = await probeSearchEngineModels(
        connectionPayload.baseUrl,
        connectionPayload.timeoutMs,
        connectionPayload.apiFormat,
        connectionPayload.apiKey,
        connectionPayload.useSavedApiKey,
      );
      if (!result.ok) {
        setProbeError(result.message);
        return;
      }
      setProbeModels(result.data.models);
    } catch (error) {
      setProbeError(error instanceof Error ? error.message : "Model probe failed.");
    } finally {
      setIsProbing(false);
    }
  }

  async function openRequestTestDialog() {
    if (!searchEngineDraft) {
      return;
    }

    const connectionPayload = buildSearchEngineConnectionPayload(searchEngineDraft);
    setRequestTestOpen(true);
    setRequestTestResult(null);
    setIsTesting(true);

    try {
      const result = await testSearchEngineRequest(
        connectionPayload.baseUrl,
        connectionPayload.timeoutMs,
        connectionPayload.apiFormat,
        connectionPayload.apiKey,
        connectionPayload.useSavedApiKey,
        connectionPayload.model,
      );
      if (!result.ok) {
        setRequestTestResult(
          createRequestTestFailure(
            connectionPayload.apiFormat,
            connectionPayload.model,
            result.message,
            result.status,
          ),
        );
        return;
      }
      setRequestTestResult(result.data);
    } catch (error) {
      setRequestTestResult(
        createRequestTestFailure(
          connectionPayload.apiFormat,
          connectionPayload.model,
          error instanceof Error ? error.message : "Live request test failed.",
          null,
        ),
      );
    } finally {
      setIsTesting(false);
    }
  }

  return (
    <div className="workspace-stack">
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        {/* Master List */}
        <div className="h-[calc(100vh-200px)] overflow-hidden rounded-[20px] border border-white/8 bg-white/4 p-4">
          <ProviderMasterList
            providers={props.providers}
            selectedProvider={selectedProvider}
            dirtyProviders={dirtyProviderSet}
            drafts={props.drafts}
            saveErrors={props.saveErrors}
            saving={props.saving}
            onSelect={setSelectedProvider}
          />
        </div>

        {/* Detail Panel */}
        <div className="space-y-4">
          <div className="rounded-[20px] border border-white/8 bg-white/4 p-6">
            {selectedDraft && (
              <ProviderDetailPanel
                selectedProviderRecord={selectedProviderRecord}
                draft={selectedDraft}
                saveErrors={props.saveErrors}
                system={props.system}
                loading={props.loading}
                saving={props.saving}
                isDirty={isDirty}
                onDraftChange={(provider, patch) => {
                  setApiKeyRevealError("");
                  props.onDraftChange(provider, patch);
                }}
                apiKeyBusy={isRevealingApiKey}
                apiKeyInputType={apiKeyInputType}
                showApiKey={selectedProvider ? Boolean(visibleApiKeys[selectedProvider]) : false}
                toggleApiKey={toggleApiKey}
                isProbing={isProbing}
                isTesting={isTesting}
                onOpenProbe={() => void openProbeDialog()}
                onRunLiveTest={() => void openRequestTestDialog()}
                apiKeyRevealError={apiKeyRevealError}
              />
            )}
          </div>

          {/* Tool Surface */}
          <ToolSurfaceCard toolSurface={props.toolSurface} loading={props.loading} />
        </div>
      </div>

      <ProbeModelsDialog
        error={probeError}
        loading={isProbing}
        models={probeModels}
        open={probeOpen}
        onClose={() => setProbeOpen(false)}
        onRetry={() => void openProbeDialog()}
        onSelect={(model) => {
          props.onDraftChange(SEARCH_ENGINE_PROVIDER, { searchModel: model });
          setProbeOpen(false);
        }}
      />
      <SearchEngineRequestTestDialog
        loading={isTesting}
        open={requestTestOpen}
        result={requestTestResult}
        onClose={() => setRequestTestOpen(false)}
        onRetry={() => void openRequestTestDialog()}
      />

      {/* Dirty Provider Save Bar */}
      {props.dirtyProviders.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-[20px] border border-white/16 bg-[color:var(--surface-raised)] px-6 py-4 shadow-2xl">
          <div className="flex items-center gap-4">
            <span className="text-sm">
              {props.dirtyProviders.length} unsaved provider{props.dirtyProviders.length > 1 ? "s" : ""}
            </span>
            <button
              type="button"
              onClick={props.onSaveAll}
              disabled={props.saving}
              className="rounded-[12px] bg-cyan-400 px-4 py-2 text-sm font-medium text-black hover:bg-cyan-300 disabled:opacity-50"
            >
              {props.saving ? "Saving..." : "Save All"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
