import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowUpRight, Eye, EyeOff, KeyRound } from "lucide-react";
import { Link } from "react-router-dom";
import type { ProviderDraft } from "../../types";
import {
  FormField,
  type PanelProps,
  parseTimeoutMs,
} from "./provider-panel-shared";

const DEFAULT_TIMEOUT_MS = 30_000;

type RemoteProviderPanelProps = PanelProps &
  Readonly<{
    draft: ProviderDraft;
    onDraftChange: (patch: Partial<ProviderDraft>) => void;
  }>;

export function RemoteProviderPanel(props: RemoteProviderPanelProps) {
  const [revealBaseUrl, setRevealBaseUrl] = useState(false);

  return (
    <div className="space-y-5">
      {props.error ? (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {props.error}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-[1fr_150px]">
        <FormField
          label="Base URL"
          description={`Custom upstream endpoint for ${props.provider.provider}. Leave blank for official default.`}
        >
          <div className="relative flex items-center">
            <Input
              className="pr-10 font-mono text-sm"
              disabled={props.busy}
              type={revealBaseUrl ? "text" : "password"}
              placeholder="Default endpoint"
              value={props.draft.baseUrl}
              onChange={(event) => props.onDraftChange({ baseUrl: event.target.value })}
            />
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="absolute right-1 size-7 text-muted-foreground hover:text-foreground"
              onClick={() => setRevealBaseUrl(!revealBaseUrl)}
              title={revealBaseUrl ? "Hide Base URL" : "Show Base URL"}
              aria-label={revealBaseUrl ? "Hide Base URL" : "Show Base URL"}
            >
              {revealBaseUrl ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            </Button>
          </div>
        </FormField>
        <FormField label="Timeout" description="Per-request limit.">
          <div className="relative">
            <Input
              className="pr-10 font-mono text-sm"
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
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
              ms
            </span>
          </div>
        </FormField>
      </div>

      <div className="rounded-lg border border-border/70 bg-muted/20 p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <KeyRound className="size-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">Key Management</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Credential inventory, health monitoring, rate limits, and rotation live in Key Pools for
              <span className="font-mono font-medium text-foreground"> {props.provider.provider}</span>.
            </p>
          </div>
          <Button asChild size="sm" variant="outline" className="shrink-0">
            <Link to="/keys">
              Open Key Pools
              <ArrowUpRight className="ml-1.5 size-3.5" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
