import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { KeyRound, Server } from "lucide-react";
import type { RemoteProvider, ProviderConfigRecord, SystemSettings } from "@shared/contracts";
import { SEARCH_ENGINE_PROVIDER } from "@shared/contracts";
import type { ProviderDraft, ProviderDrafts } from "../../types";
import type { ProviderSaveErrors } from "../../provider-actions";
import { SearchEngineProviderPanel } from "./SearchEngineProviderPanel";
import { RemoteProviderPanel } from "./RemoteProviderPanel";
import { ProviderSwitch } from "./provider-panel-shared";
import { LoadingOverlay } from "../Feedback";

type ProviderDetailPanelProps = Readonly<{
  providers: ProviderConfigRecord[];
  selectedProvider: RemoteProvider;
  onSelectProvider: (provider: RemoteProvider) => void;
  selectedProviderRecord: ProviderConfigRecord | null;
  draft: ProviderDraft;
  drafts: ProviderDrafts;
  dirtyProviders: Set<RemoteProvider>;
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

function getProviderStatusDot(
  _provider: RemoteProvider,
  draft: ProviderDraft | undefined,
  hasError: boolean,
  isDirty: boolean,
) {
  if (hasError) return "bg-destructive";
  if (isDirty) return "bg-amber-500 animate-pulse";
  if (draft?.enabled) return "bg-emerald-500";
  return "bg-muted-foreground/50";
}

export function ProviderDetailPanel(props: ProviderDetailPanelProps) {
  const selectedProvider = props.selectedProvider;
  const isSearchEngine = selectedProvider === SEARCH_ENGINE_PROVIDER;
  const busy = props.loading || (props.saving && props.isDirty);
  const error = props.saveErrors[selectedProvider] ?? props.apiKeyRevealError;

  // sort search_engine first
  const searchEngine = props.providers.find((p) => p.provider === SEARCH_ENGINE_PROVIDER);
  const remoteProviders = props.providers.filter((p) => p.provider !== SEARCH_ENGINE_PROVIDER);
  const sortedProviders = searchEngine ? [searchEngine, ...remoteProviders] : props.providers;

  return (
    <Card className="relative min-w-0 overflow-hidden shadow-xs">
      {props.saving ? <LoadingOverlay label={`Saving ${selectedProvider}`} /> : null}
      <CardHeader className="border-b border-border/50 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Server className="size-4 text-primary" />
              <CardTitle className="text-base font-semibold">Provider Configuration</CardTitle>
            </div>
            <CardDescription className="mt-1.5 text-xs leading-relaxed">
              Configure search endpoint protocols, API credentials, and remote provider integrations.
            </CardDescription>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {isSearchEngine ? (
                <Badge variant={props.selectedProviderRecord?.hasApiKey ? "success" : "neutral"}>
                  <KeyRound className="size-3.5" />
                  {props.selectedProviderRecord?.hasApiKey ? "API key saved" : "No API key"}
                </Badge>
              ) : (
                <Badge variant="neutral">
                  <KeyRound className="size-3.5" />
                  <span className="font-mono tabular-nums">{props.selectedProviderRecord?.keyCount ?? 0}</span> keys
                </Badge>
              )}
              {props.isDirty ? <Badge variant="warning">unsaved</Badge> : null}
            </div>
            <ProviderSwitch
              checked={props.draft.enabled}
              disabled={busy}
              onToggle={() => props.onDraftChange(selectedProvider, { enabled: !props.draft.enabled })}
            />
          </div>
        </div>

        {/* Provider Segmented Tabs */}
        <div className="mt-4 flex flex-wrap gap-2 rounded-xl border border-border/60 bg-muted/40 p-1.5">
          {sortedProviders.map((providerRecord) => {
            const providerName = providerRecord.provider;
            const isSelected = providerName === selectedProvider;
            const isCore = providerName === SEARCH_ENGINE_PROVIDER;
            const draft = props.drafts[providerName];
            const hasError = !!props.saveErrors[providerName];
            const isDirty = props.dirtyProviders.has(providerName);
            const dotColor = getProviderStatusDot(providerName, draft, hasError, isDirty);

            return (
              <button
                key={providerName}
                type="button"
                onClick={() => props.onSelectProvider(providerName)}
                className={`
                  flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-medium transition-all outline-none cursor-pointer
                  ${isSelected
                    ? "border border-border/80 bg-background text-foreground shadow-xs"
                    : "border border-transparent text-muted-foreground hover:bg-background/40 hover:text-foreground"
                  }
                `}
              >
                <span className={`size-2 rounded-full ${dotColor}`} />
                <span className="font-mono font-semibold">{providerName}</span>
                {isCore ? (
                  <Badge className="h-4 px-1 text-[10px] font-normal" variant="default">
                    Core
                  </Badge>
                ) : (
                  <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                    {providerRecord.keyCount} keys
                  </span>
                )}
                {isDirty && (
                  <Badge className="h-4 px-1 text-[10px] font-normal" variant="warning">
                    Unsaved
                  </Badge>
                )}
              </button>
            );
          })}
        </div>
      </CardHeader>

      <CardContent className="space-y-5 pt-5">
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
            provider={props.selectedProviderRecord!}
            showApiKey={props.showApiKey}
            toggleApiKey={props.toggleApiKey}
            onDraftChange={(patch) => props.onDraftChange(selectedProvider, patch)}
            onOpenProbe={props.onOpenProbe}
            onRunLiveTest={props.onRunLiveTest}
          />
        ) : (
          <RemoteProviderPanel
            busy={busy}
            dirty={props.isDirty}
            draft={props.draft}
            error={error}
            provider={props.selectedProviderRecord!}
            onDraftChange={(patch) => props.onDraftChange(selectedProvider, patch)}
          />
        )}
      </CardContent>
    </Card>
  );
}
