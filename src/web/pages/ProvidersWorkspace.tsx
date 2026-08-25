import { useState } from "react";
import { Button } from "@/components/ui/button";
import type {
  ProviderConfigRecord,
  RemoteProvider,
  SearchEngineApiFormat,
  SearchEngineRequestTestResponse,
  SystemSettings,
  ToolSurfaceSnapshot,
} from "@shared/contracts";
import { SEARCH_ENGINE_PROVIDER } from "@shared/contracts";
import { ProviderDetailPanel } from "../components/providers/ProviderDetailPanel";
import { ProbeModelsDialog } from "../components/providers/ProbeModelsDialog";
import { SearchEngineRequestTestDialog } from "../components/providers/SearchEngineRequestTestDialog";
import { ToolSurfaceCard } from "../components/providers/ToolSurfaceCard";
import type { ToastTone } from "../components/Feedback";
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
  onToast: (type: ToastTone, message: string) => void;
  onToolSurfaceChange: (snapshot: ToolSurfaceSnapshot) => void;
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
  const [selectedProvider, setSelectedProvider] = useState<RemoteProvider>(SEARCH_ENGINE_PROVIDER);
  const [visibleApiKeys, setVisibleApiKeys] = useState<Record<string, boolean>>({});
  const [isRevealingApiKey] = useState(false);
  const [apiKeyRevealError, setApiKeyRevealError] = useState("");
  const [probeOpen, setProbeOpen] = useState(false);
  const [probeModels, setProbeModels] = useState<string[]>([]);
  const [probeError, setProbeError] = useState("");
  const [isProbing, setIsProbing] = useState(false);
  const [requestTestOpen, setRequestTestOpen] = useState(false);
  const [requestTestResult, setRequestTestResult] = useState<SearchEngineRequestTestResponse | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  const dirtyProviderSet = new Set(props.dirtyProviders);
  const selectedProviderRecord =
    props.providers.find((p) => p.provider === selectedProvider) ?? null;
  const selectedDraft = props.drafts[selectedProvider] ?? null;
  const isDirty = dirtyProviderSet.has(selectedProvider);
  const searchEngineDraft = props.drafts[SEARCH_ENGINE_PROVIDER] ?? null;

  const toggleApiKey = () => {
    setVisibleApiKeys((prev) => ({
      ...prev,
      [selectedProvider]: !prev[selectedProvider],
    }));
  };

  const apiKeyInputType: "password" | "text" = visibleApiKeys[selectedProvider]
    ? "text"
    : selectedDraft?.revealedApiKey
      ? "password"
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
    <div className="space-y-6">
      {/* Provider Configuration Card with Embedded Tabs */}
      {selectedDraft && (
        <ProviderDetailPanel
          providers={props.providers}
          selectedProvider={selectedProvider}
          onSelectProvider={setSelectedProvider}
          selectedProviderRecord={selectedProviderRecord}
          draft={selectedDraft}
          drafts={props.drafts}
          dirtyProviders={dirtyProviderSet}
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
          showApiKey={Boolean(visibleApiKeys[selectedProvider])}
          toggleApiKey={toggleApiKey}
          isProbing={isProbing}
          isTesting={isTesting}
          onOpenProbe={() => void openProbeDialog()}
          onRunLiveTest={() => void openRequestTestDialog()}
          apiKeyRevealError={apiKeyRevealError}
        />
      )}

      {/* Tool Surface Exposure Card */}
      <ToolSurfaceCard
        loading={props.loading}
        toolSurface={props.toolSurface}
        onToast={props.onToast}
        onToolSurfaceChange={props.onToolSurfaceChange}
      />

      {/* Diagnostics Dialogs */}
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
        <div className="fixed bottom-6 left-1/2 z-30 -translate-x-1/2 rounded-xl border border-border/70 bg-card px-6 py-4 shadow-glow">
          <div className="flex items-center gap-4">
            <span className="text-sm">
              {props.dirtyProviders.length} unsaved provider{props.dirtyProviders.length > 1 ? "s" : ""}
            </span>
            <Button
              type="button"
              onClick={props.onSaveAll}
              disabled={props.saving}
            >
              {props.saving ? "Saving..." : "Save All"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
