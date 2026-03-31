import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ProviderDraft } from "../../types";
import { LoadingOverlay } from "../Feedback";
import {
  FieldShell,
  PanelBadges,
  type PanelProps,
  parseTimeoutMs,
  ProviderSwitch,
} from "./provider-panel-shared";

const DEFAULT_TIMEOUT_MS = 30_000;

type RemoteProviderPanelProps = PanelProps &
  Readonly<{
    draft: ProviderDraft;
    onDraftChange: (patch: Partial<ProviderDraft>) => void;
  }>;

export function RemoteProviderPanel(props: RemoteProviderPanelProps) {
  return (
    <Card className="relative min-w-0">
      {props.busy ? <LoadingOverlay label={`Saving ${props.provider.provider}`} /> : null}
      <CardHeader className="pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="eyebrow">Provider Runtime</div>
            <CardTitle className="mt-2">{props.provider.provider}</CardTitle>
            <CardDescription className="mt-2">
              Keys stay in Key Pools. This card only controls provider availability and network
              behavior.
            </CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <PanelBadges
              dirty={props.dirty}
              keyCount={props.provider.keyCount}
            />
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
        <FieldShell title="Base URL" description="Root endpoint for this provider. Leave blank to use the default.">
          <input
            className="font-['IBM_Plex_Mono']"
            disabled={props.busy}
            type="text"
            value={props.draft.baseUrl}
            onChange={(event) => props.onDraftChange({ baseUrl: event.target.value })}
          />
        </FieldShell>
        <FieldShell title="Timeout" description="Applied to provider requests made with managed keys.">
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
        <div className="rounded-[22px] border border-white/8 bg-[color:var(--ui-card-soft)] p-4">
          <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--text-dim)]">
            Key Management
          </div>
          <p className="mt-3 text-sm leading-6 text-[color:var(--text-soft)]">
            Credential inventory, enable/disable, health, and rotation all live in Key Pools for
            {` ${props.provider.provider}`}.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
