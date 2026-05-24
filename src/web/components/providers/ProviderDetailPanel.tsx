import type { RemoteProvider, ProviderConfigRecord, SystemSettings } from "@shared/contracts";
import { SEARCH_ENGINE_PROVIDER } from "@shared/contracts";
import type { ProviderDraft } from "../../types";
import type { ProviderSaveErrors } from "../../provider-actions";
import { SearchEngineProviderPanel } from "./SearchEngineProviderPanel";
import { RemoteProviderPanel } from "./RemoteProviderPanel";

type ProviderDetailPanelProps = Readonly<{
  selectedProviderRecord: ProviderConfigRecord | null;
  draft: ProviderDraft;
  saveErrors: ProviderSaveErrors;
  system: SystemSettings;
  loading: boolean;
  saving: boolean;
  isDirty: boolean;
  onDraftChange: (provider: RemoteProvider, patch: Partial<ProviderDraft>) => void;
  apiKeyBusy: boolean;
  apiKeyInputType: "password" | "text";
  showApiKey: boolean;
  toggleApiKey: () => void;
  isProbing: boolean;
  isTesting: boolean;
  onOpenProbe: () => void;
  onRunLiveTest: () => void;
  apiKeyRevealError: string;
}>;

export function ProviderDetailPanel(props: ProviderDetailPanelProps) {
  if (!props.selectedProviderRecord) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-[color:var(--text-soft)]">
          Select a provider to view configuration
        </p>
      </div>
    );
  }

  const { provider } = props.selectedProviderRecord;
  const isSearchEngine = provider === SEARCH_ENGINE_PROVIDER;
  const busy = props.loading || (props.saving && props.isDirty);
  const error = props.saveErrors[provider] ?? props.apiKeyRevealError;

  return (
    <div className="h-full overflow-y-auto">
      {isSearchEngine ? (
        <SearchEngineProviderPanel
          busy={busy}
          dirty={props.isDirty}
          draft={props.draft}
          error={error}
          apiKeyBusy={props.apiKeyBusy}
          apiKeyInputType={props.apiKeyInputType}
          isProbing={props.isProbing}
          isTesting={props.isTesting}
          provider={props.selectedProviderRecord}
          showApiKey={props.showApiKey}
          toggleApiKey={props.toggleApiKey}
          onDraftChange={(patch) => props.onDraftChange(provider, patch)}
          onOpenProbe={props.onOpenProbe}
          onRunLiveTest={props.onRunLiveTest}
        />
      ) : (
        <RemoteProviderPanel
          busy={busy}
          dirty={props.isDirty}
          draft={props.draft}
          error={error}
          provider={props.selectedProviderRecord}
          onDraftChange={(patch) => props.onDraftChange(provider, patch)}
        />
      )}
    </div>
  );
}
