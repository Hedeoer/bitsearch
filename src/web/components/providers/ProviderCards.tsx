import { useState } from "react";
import {
  SEARCH_ENGINE_PROVIDER,
  type ProviderConfigRecord,
  type RemoteProvider,
  type SearchEngineRequestTestResponse,
  type SystemSettings,
} from "@shared/contracts";
import { getProviderDraft } from "../../provider-drafts";
import {
  buildSearchEngineConnectionPayload,
  revealSearchEngineApiKey,
  probeSearchEngineModels,
  testSearchEngineRequest,
  type ProviderSaveErrors,
} from "../../provider-actions";
import type { ProviderDraft, ProviderDrafts } from "../../types";
import { ProbeModelsDialog } from "./ProbeModelsDialog";
import { SearchEngineRequestTestDialog } from "./SearchEngineRequestTestDialog";
import { RemoteProviderPanel } from "./RemoteProviderPanel";
import { SearchEngineProviderPanel } from "./SearchEngineProviderPanel";
import { ProviderSkeletonPanel } from "./ProviderSkeletonPanel";
import { Button } from "@/components/ui/button";
import { Save } from "lucide-react";

type ProviderCardsProps = Readonly<{
  dirtyProviders: RemoteProvider[];
  drafts: ProviderDrafts;
  loading: boolean;
  onDraftChange: (provider: RemoteProvider, patch: Partial<ProviderDraft>) => void;
  onSaveAll: () => void;
  providers: ProviderConfigRecord[];
  saveErrors: ProviderSaveErrors;
  saving: boolean;
  system: SystemSettings;
}>;

export function ProviderCards(props: ProviderCardsProps) {
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
  const searchEngine = props.providers.find((item) => item.provider === SEARCH_ENGINE_PROVIDER);
  const remoteProviders = props.providers.filter((item) => item.provider !== SEARCH_ENGINE_PROVIDER);

  if (props.loading && props.providers.length === 0) {
    return (
      <div className="grid gap-4 xl:grid-cols-3">
        <ProviderSkeletonPanel />
        <ProviderSkeletonPanel />
        <ProviderSkeletonPanel />
      </div>
    );
  }

  if (!searchEngine) {
    return null;
  }

  const searchDraft = getProviderDraft(searchEngine, props.drafts, props.system);

  function createRequestTestFailure(
    model: string,
    message: string,
    statusCode: number | null,
  ): SearchEngineRequestTestResponse {
    return {
      provider: SEARCH_ENGINE_PROVIDER,
      status: "failed",
      model,
      durationMs: 0,
      responsePreview: null,
      statusCode,
      error: message,
      modelProbe: {
        status: "failed",
        modelsCount: null,
        modelListed: null,
        message: null,
      },
    };
  }

  async function toggleSearchEngineApiKey() {
    if (!searchEngine) {
      return;
    }
    if (visibleApiKeys[SEARCH_ENGINE_PROVIDER]) {
      setVisibleApiKeys((current) => ({
        ...current,
        [SEARCH_ENGINE_PROVIDER]: false,
      }));
      return;
    }

    if (!searchDraft.revealedApiKey && searchEngine.hasApiKey) {
      setIsRevealingApiKey(true);
      setApiKeyRevealError("");
      const result = await revealSearchEngineApiKey();
      setIsRevealingApiKey(false);
      if (!result.ok) {
        setApiKeyRevealError(result.message);
        return;
      }
      props.onDraftChange(SEARCH_ENGINE_PROVIDER, {
        apiKey: result.data.apiKey,
        revealedApiKey: result.data.apiKey,
      });
    }

    setVisibleApiKeys((current) => ({
      ...current,
      [SEARCH_ENGINE_PROVIDER]: true,
    }));
  }

  async function openProbeDialog() {
    const connectionPayload = buildSearchEngineConnectionPayload(searchDraft);
    setProbeOpen(true);
    setProbeModels([]);
    setProbeError("");
    setIsProbing(true);
    try {
      const result = await probeSearchEngineModels(
        connectionPayload.baseUrl,
        connectionPayload.timeoutMs,
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
    const connectionPayload = buildSearchEngineConnectionPayload(searchDraft);
    setRequestTestOpen(true);
    setRequestTestResult(null);
    setIsTesting(true);
    try {
      const result = await testSearchEngineRequest(
        connectionPayload.baseUrl,
        connectionPayload.timeoutMs,
        connectionPayload.apiKey,
        connectionPayload.useSavedApiKey,
        connectionPayload.model,
      );
      if (!result.ok) {
        setRequestTestResult(
          createRequestTestFailure(connectionPayload.model, result.message, result.status),
        );
        return;
      }
      setRequestTestResult(result.data);
    } catch (error) {
      setRequestTestResult(
        createRequestTestFailure(
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
    <>
      <div className="grid gap-4 xl:grid-cols-3">
        <SearchEngineProviderPanel
          busy={props.loading || (props.saving && dirtyProviderSet.has(searchEngine.provider))}
          dirty={dirtyProviderSet.has(searchEngine.provider)}
          draft={searchDraft}
          error={props.saveErrors[searchEngine.provider] ?? apiKeyRevealError}
          apiKeyBusy={isRevealingApiKey}
          apiKeyInputType={
            visibleApiKeys[searchEngine.provider]
              ? "text"
              : searchDraft.revealedApiKey
                ? "password"
                : "text"
          }
          isProbing={isProbing}
          isTesting={isTesting}
          provider={searchEngine}
          showApiKey={Boolean(visibleApiKeys[searchEngine.provider])}
          toggleApiKey={() => void toggleSearchEngineApiKey()}
          onDraftChange={(patch) => {
            setApiKeyRevealError("");
            props.onDraftChange(searchEngine.provider, patch);
          }}
          onOpenProbe={() => void openProbeDialog()}
          onRunLiveTest={() => void openRequestTestDialog()}
        />
        {remoteProviders.map((provider) => (
          <RemoteProviderPanel
            key={provider.provider}
            busy={props.loading || (props.saving && dirtyProviderSet.has(provider.provider))}
            dirty={dirtyProviderSet.has(provider.provider)}
            draft={getProviderDraft(provider, props.drafts, props.system)}
            error={props.saveErrors[provider.provider]}
            provider={provider}
            onDraftChange={(patch) => props.onDraftChange(provider.provider, patch)}
          />
        ))}
      </div>
      {props.dirtyProviders.length > 0 ? (
        <div className="sticky bottom-4 z-10 flex justify-end">
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[color:var(--ui-card-strong)] px-4 py-3 shadow-[var(--ui-shadow)] backdrop-blur-md">
            <span className="text-sm text-[color:var(--warning)]">
              {props.dirtyProviders.length} unsaved change{props.dirtyProviders.length > 1 ? "s" : ""}
            </span>
            <Button
              disabled={props.loading || props.saving}
              type="button"
              onClick={props.onSaveAll}
            >
              <Save size={14} />
              {props.saving ? "Saving changes..." : "Save changes"}
            </Button>
          </div>
        </div>
      ) : null}
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
    </>
  );
}
