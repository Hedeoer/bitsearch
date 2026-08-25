import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Eye, EyeOff, Play, RefreshCw } from "lucide-react";
import type { ProviderDraft } from "../../types";
import { InlineSpinner } from "../Feedback";
import {
  FormField,
  type PanelProps,
  parseTimeoutMs,
} from "./provider-panel-shared";

const DEFAULT_TIMEOUT_MS = 30_000;

function getSearchModelDescription(apiFormat: ProviderDraft["apiFormat"]): string {
  if (apiFormat === "anthropic_messages") {
    return "Probe checks the Anthropic models endpoint. Live test sends a real Anthropic Messages request with the staged Base URL, API key, timeout, and model without saving.";
  }
  if (apiFormat === "google_gemini") {
    return "Probe checks the Gemini models endpoint. Live test sends a real Google Gemini request with the staged Base URL, API key, timeout, and model without saving.";
  }
  if (apiFormat === "openai_responses") {
    return "Probe checks `/models`. Live test sends a real OpenAI Responses request with the staged Base URL, API key, timeout, and model without saving.";
  }
  return "Probe checks `/models`. Live test sends a real chat completion with the current staged Base URL, API key, timeout, and model without saving.";
}

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
          description="Upstream base URL for OpenAI-compatible, Anthropic, or Gemini endpoint."
        >
          <div className="relative flex items-center">
            <Input
              className="pr-10 font-mono text-sm"
              disabled={props.busy}
              type={revealBaseUrl ? "text" : "password"}
              value={props.draft.baseUrl}
              placeholder="https://api.openai.com/v1"
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

      <FormField
        label="API Format"
        description="Choose the upstream protocol schema for this search_engine endpoint."
      >
        <Select
          disabled={props.busy}
          value={props.draft.apiFormat}
          onValueChange={(value) =>
            props.onDraftChange({ apiFormat: value as ProviderDraft["apiFormat"] })
          }
        >
          <SelectTrigger className="w-full font-mono text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="openai_chat_completions">OpenAI Chat Completions</SelectItem>
            <SelectItem value="openai_responses">OpenAI Responses</SelectItem>
            <SelectItem value="anthropic_messages">Anthropic Messages</SelectItem>
            <SelectItem value="google_gemini">Google Gemini API</SelectItem>
          </SelectContent>
        </Select>
      </FormField>

      <FormField
        label="API Key"
        description={
          props.provider.hasApiKey
            ? "Stored credentials remain active until you replace them."
            : "No stored credential yet."
        }
      >
        <div className="flex items-center gap-2">
          <Input
            className="font-mono text-sm"
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
      </FormField>

      <div className="rounded-lg border border-border/70 bg-muted/20 p-4">
        <FormField
          label="Search Model & Diagnostics"
          description={getSearchModelDescription(props.draft.apiFormat)}
        >
          <div className="grid gap-2.5 sm:grid-cols-[1fr_auto_auto]">
            <Input
              className="font-mono text-sm"
              disabled={props.busy}
              placeholder="Type or probe a default model name"
              type="text"
              value={props.draft.searchModel}
              onChange={(event) => props.onDraftChange({ searchModel: event.target.value })}
            />
            <Button
              className="sm:min-w-[130px]"
              disabled={props.busy || props.isProbing}
              type="button"
              variant="outline"
              onClick={props.onOpenProbe}
            >
              {props.isProbing ? <InlineSpinner label="Probing" /> : <RefreshCw size={14} />}
              {props.isProbing ? null : "Probe models"}
            </Button>
            <Button
              className="sm:min-w-[130px]"
              disabled={props.busy || props.isTesting}
              type="button"
              variant="secondary"
              onClick={props.onRunLiveTest}
            >
              {props.isTesting ? <InlineSpinner label="Testing" /> : <Play size={14} />}
              {props.isTesting ? null : "Run live test"}
            </Button>
          </div>
        </FormField>
      </div>
    </div>
  );
}
