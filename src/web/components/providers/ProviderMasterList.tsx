import type { RemoteProvider, ProviderConfigRecord } from "@shared/contracts";
import type { ProviderDrafts } from "../../types";
import type { ProviderSaveErrors } from "../../provider-actions";
import { ProviderMasterCard } from "./ProviderMasterCard";

type ProviderMasterListProps = Readonly<{
  providers: ProviderConfigRecord[];
  selectedProvider: RemoteProvider | null;
  dirtyProviders: Set<RemoteProvider>;
  drafts: ProviderDrafts;
  saveErrors: ProviderSaveErrors;
  saving: boolean;
  onSelect: (provider: RemoteProvider) => void;
}>;

export function ProviderMasterList(props: ProviderMasterListProps) {
  // search_engine always first
  const searchEngine = props.providers.find((p) => p.provider === "search_engine");
  const remoteProviders = props.providers.filter((p) => p.provider !== "search_engine");

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto pr-2">
      <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--text-dim)]">
        Providers
      </div>

      {searchEngine && (
        <ProviderMasterCard
          provider={searchEngine.provider}
          providerRecord={searchEngine}
          draft={props.drafts[searchEngine.provider]}
          isSelected={props.selectedProvider === searchEngine.provider}
          isDirty={props.dirtyProviders.has(searchEngine.provider)}
          hasError={!!props.saveErrors[searchEngine.provider]}
          isSaving={props.saving && props.dirtyProviders.has(searchEngine.provider)}
          onClick={() => props.onSelect(searchEngine.provider)}
        />
      )}

      {remoteProviders.map((providerRecord) => (
        <ProviderMasterCard
          key={providerRecord.provider}
          provider={providerRecord.provider}
          providerRecord={providerRecord}
          draft={props.drafts[providerRecord.provider]}
          isSelected={props.selectedProvider === providerRecord.provider}
          isDirty={props.dirtyProviders.has(providerRecord.provider)}
          hasError={!!props.saveErrors[providerRecord.provider]}
          isSaving={props.saving && props.dirtyProviders.has(providerRecord.provider)}
          onClick={() => props.onSelect(providerRecord.provider)}
        />
      ))}
    </div>
  );
}
