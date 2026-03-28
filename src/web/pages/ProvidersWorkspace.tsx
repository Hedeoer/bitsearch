import type { Dispatch, SetStateAction } from "react";
import type { ProviderConfigRecord } from "@shared/contracts";
import type { ProviderDrafts } from "../types";
import { formatNumber } from "../format";
import { ProviderGrid } from "../components/OverviewPanels";
import { WorkspaceIntro } from "../components/WorkspaceIntro";

type ProvidersWorkspaceProps = Readonly<{
  drafts: ProviderDrafts;
  loading: boolean;
  onSave: (provider: string) => void;
  providers: ProviderConfigRecord[];
  setDrafts: Dispatch<SetStateAction<ProviderDrafts>>;
}>;

function countStoredSecrets(providers: ProviderConfigRecord[]) {
  return providers.filter((provider) => provider.hasApiKey).length;
}

export function ProvidersWorkspace(props: ProvidersWorkspaceProps) {
  const totalKeys = props.providers.reduce((sum, provider) => sum + provider.keyCount, 0);
  const enabledCount = props.providers.filter((provider) => provider.enabled).length;
  const metrics = [
    { label: "Providers", value: String(props.providers.length) },
    { label: "Enabled", value: String(enabledCount), tone: "live" as const },
    { label: "Tracked Keys", value: formatNumber(totalKeys) },
    { label: "Stored Secrets", value: String(countStoredSecrets(props.providers)) },
  ];

  return (
    <div className="workspace-stack">
      <WorkspaceIntro
        eyebrow="Providers"
        title="Tune search integrations as a coordinated execution layer."
        description="Each provider surface exposes state, connectivity, timeout, and secret rotation without leaving the main console."
        metrics={metrics}
      />
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
