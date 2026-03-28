import type { Dispatch, SetStateAction } from "react";
import type { ProviderConfigRecord } from "@shared/contracts";
import type { ProviderDrafts } from "../types";
import { ProviderGrid } from "../components/OverviewPanels";

type ProvidersWorkspaceProps = Readonly<{
  drafts: ProviderDrafts;
  loading: boolean;
  onSave: (provider: string) => void;
  providers: ProviderConfigRecord[];
  setDrafts: Dispatch<SetStateAction<ProviderDrafts>>;
}>;

export function ProvidersWorkspace(props: ProvidersWorkspaceProps) {
  return (
    <div className="workspace-stack">
      <ProviderGrid
        loading={props.loading}
        providers={props.providers}
        drafts={props.drafts}
        setDrafts={props.setDrafts}
        onSave={props.onSave}
      />
    </div>
  );
}
