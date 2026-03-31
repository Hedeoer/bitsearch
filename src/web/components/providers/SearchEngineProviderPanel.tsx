import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, KeyRound, RefreshCw } from "lucide-react";
import type { ProviderDraft } from "../../types";
import { InlineSpinner, LoadingOverlay } from "../Feedback";
import {
  FieldShell,
  type PanelProps,
  parseTimeoutMs,
  ProviderSwitch,
} from "./provider-panel-shared";

const DEFAULT_TIMEOUT_MS = 30_000;

type SearchEngineProviderPanelProps = PanelProps &
  Readonly<{
    apiKeyBusy: boolean;
    apiKeyInputType: "password" | "text";
    draft: ProviderDraft;
    isProbing: boolean;
    isTesting: boolean;
    onDraftChange: (patch: Partial<ProviderDraft>) => void;
    onOpenProbe: () => void;
    onRunLiveTest: () => void;
    showApiKey: boolean;
    toggleApiKey: () => void;
  }>;

export function SearchEngineProviderPanel(props: SearchEngineProviderPanelProps) {
  return (
    <Card className="relative min-w-0 overflow-hidden">
      {props.busy ? <LoadingOverlay label="Saving Search Engine" /> : null}
      <CardHeader className="pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="eyebrow">Search Layer</div>
            <CardTitle className="mt-2">search_engine</CardTitle>
            <CardDescription className="mt-2 max-w-2xl">
              Configure the generic search endpoint, local credential, and default model used by
              the shared search layer.
            </CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant={props.provider.hasApiKey ? "success" : "neutral"}>
                <KeyRound className="size-3.5" />
                {props.provider.hasApiKey ? "API key saved" : "No API key"}
              </Badge>
              {props.dirty ? <Badge variant="warning">unsaved</Badge> : null}
            </div>
            <ProviderSwitch
              checked={props.draft.enabled}
              disabled={props.busy}
              onToggle={() => props.onDraftChange({ enabled: !props.draft.enabled })}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        {props.error ? (
          <div className="rounded-[20px] border border-rose-300/18 bg-rose-300/10 px-4 py-3 text-sm text-[color:var(--danger)]">
            {props.error}
          </div>
        ) : null}
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
          <FieldShell title="Base URL">
            <input
              className="font-['IBM_Plex_Mono']"
              disabled={props.busy}
              type="text"
              value={props.draft.baseUrl}
              onChange={(event) => props.onDraftChange({ baseUrl: event.target.value })}
            />
          </FieldShell>
          <FieldShell title="Timeout">
            <div className="relative">
              <input
                className="pr-11 font-['IBM_Plex_Mono']"
                disabled={props.busy}
                inputMode="numeric"
                type="number"
                value={props.draft.timeoutMs}
                onChange={(event) =>
                  props.onDraftChange({
                    timeoutMs: parseTimeoutMs(event.target.value, DEFAULT_TIMEOUT_MS),
                  })
                }
              />
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-[color:var(--text-dim)]">
                ms
              </span>
            </div>
          </FieldShell>
        </div>
        <FieldShell
          title="API Key"
          description={
            props.provider.hasApiKey
              ? "Stored credentials remain active until you replace them."
              : "No stored credential yet."
          }
        >
          <div className="flex items-center gap-3">
            <input
              className="font-['IBM_Plex_Mono']"
              disabled={props.busy}
              type={props.apiKeyInputType}
              placeholder={
                props.provider.hasApiKey
                  ? "Stored. Paste a new API key to replace it"
                  : "Paste your API key here"
              }
              value={props.draft.apiKey}
              onChange={(event) => props.onDraftChange({ apiKey: event.target.value })}
            />
            <Button
              size="icon"
              variant="outline"
              disabled={props.apiKeyBusy}
              type="button"
              aria-label={props.showApiKey ? "Hide API key" : "Show API key"}
              onClick={props.toggleApiKey}
            >
              {props.showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </Button>
          </div>
        </FieldShell>
        <FieldShell
          title="Search Model"
          description="Probe checks `/models`. Live test sends a real chat completion with the current staged Base URL, API key, timeout, and model without saving."
        >
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
            <input
              className="font-['IBM_Plex_Mono']"
              disabled={props.busy}
              placeholder="Type or probe a default model name"
              type="text"
              value={props.draft.searchModel}
              onChange={(event) => props.onDraftChange({ searchModel: event.target.value })}
            />
            <Button
              className="lg:min-w-[144px]"
              disabled={props.busy || props.isProbing}
              type="button"
              variant="secondary"
              onClick={props.onOpenProbe}
            >
              {props.isProbing ? <InlineSpinner label="Probing" /> : <RefreshCw size={14} />}
              {props.isProbing ? null : "Probe models"}
            </Button>
            <Button
              className="lg:min-w-[144px]"
              disabled={props.busy || props.isTesting}
              type="button"
              onClick={props.onRunLiveTest}
            >
              {props.isTesting ? <InlineSpinner label="Testing" /> : "Run live test"}
            </Button>
          </div>
        </FieldShell>
      </CardContent>
    </Card>
  );
}
