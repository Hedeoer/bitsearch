import { useState } from "react";
import type {
  ProviderConfigRecord,
  RemoteProvider,
  SystemSettings,
  ToolSurfaceSnapshot,
} from "@shared/contracts";
import { SEARCH_ENGINE_PROVIDER } from "@shared/contracts";
import { ProviderMasterList } from "../components/providers/ProviderMasterList";
import { ProviderDetailPanel } from "../components/providers/ProviderDetailPanel";
import { ToolSurfaceCard } from "../components/providers/ToolSurfaceCard";
import type { ProviderSaveErrors } from "../provider-actions";
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

export function ProvidersWorkspace(props: ProvidersWorkspaceProps) {
  const [selectedProvider, setSelectedProvider] = useState<RemoteProvider | null>(
    SEARCH_ENGINE_PROVIDER
  );
  const [visibleApiKeys, setVisibleApiKeys] = useState<Record<string, boolean>>({});
  const [isRevealingApiKey, setIsRevealingApiKey] = useState(false);
  const [apiKeyRevealError, setApiKeyRevealError] = useState("");
  const [isProbing, setIsProbing] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  const dirtyProviderSet = new Set(props.dirtyProviders);
  const selectedProviderRecord = props.providers.find(
    (p) => p.provider === selectedProvider
  ) ?? null;
  const selectedDraft = selectedProvider ? props.drafts[selectedProvider] : null;
  const isDirty = selectedProvider ? dirtyProviderSet.has(selectedProvider) : false;

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
                onOpenProbe={() => setIsProbing(true)}
                onRunLiveTest={() => setIsTesting(true)}
                apiKeyRevealError={apiKeyRevealError}
              />
            )}
          </div>

          {/* Tool Surface */}
          <ToolSurfaceCard toolSurface={props.toolSurface} loading={props.loading} />
        </div>
      </div>

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
