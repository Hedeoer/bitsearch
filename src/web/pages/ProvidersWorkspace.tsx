import type {
  ProviderConfigRecord,
  RemoteProvider,
  SystemSettings,
} from "@shared/contracts";
import { ProviderCards } from "../components/providers/ProviderCards";
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
}>;

export function ProvidersWorkspace(props: ProvidersWorkspaceProps) {
  return (
    <div className="workspace-stack">
      <ProviderCards
        dirtyProviders={props.dirtyProviders}
        loading={props.loading}
        drafts={props.drafts}
        onDraftChange={props.onDraftChange}
        onSaveAll={props.onSaveAll}
        providers={props.providers}
        saveErrors={props.saveErrors}
        saving={props.saving}
        system={props.system}
      />
    </div>
  );
}
