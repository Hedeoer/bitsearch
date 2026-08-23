import { useState } from "react";
import type { FocusEvent, KeyboardEvent } from "react";
import { Copy, KeyRound, Save } from "lucide-react";
import type { McpAccessInfo, McpAccessSecretResponse } from "@shared/contracts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest } from "../api";
import type { ToastTone } from "./Feedback";

type McpAccessFieldsProps = Readonly<{
  loading: boolean;
  mcpAccess: McpAccessInfo;
  onSaveMcpAccess: (token: string) => Promise<boolean>;
  onToast: (type: ToastTone, message: string) => void;
}>;

function AccessSectionHeader() {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">MCP Access</p>
        <h3 className="mt-1 text-base font-semibold tracking-tight">Stream HTTP</h3>
      </div>
      <KeyRound className="size-4 text-primary" />
    </div>
  );
}

function AccessUrlField(
  props: Readonly<{
    disabled: boolean;
    onCopy: () => void;
    streamHttpUrl: string;
    authScheme: McpAccessInfo["authScheme"];
  }>,
) {
  return (
    <div className="grid gap-2">
      <Label className="text-sm font-medium">MCP Stream HTTP URL</Label>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input className="font-mono" readOnly value={props.streamHttpUrl} />
        <Button
          size="sm"
          variant="secondary"
          disabled={props.disabled}
          type="button"
          onClick={props.onCopy}
        >
          <Copy size={14} />
          Copy URL
        </Button>
      </div>
      <p className="text-muted-foreground font-mono text-xs">
        Authorization: {props.authScheme} {"<token>"}
      </p>
    </div>
  );
}

export function McpAccessFields(props: McpAccessFieldsProps) {
  const [draftToken, setDraftToken] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  function resetEditor() {
    setDraftToken("");
    setIsEditing(false);
  }

  function beginEditing() {
    if (props.loading || isSaving || isEditing) {
      return;
    }
    setDraftToken("");
    setIsEditing(true);
  }

  async function copyStreamHttpUrl() {
    if (!props.mcpAccess.streamHttpUrl) {
      props.onToast("error", "MCP URL is not available yet");
      return;
    }
    setIsCopying(true);
    try {
      await navigator.clipboard.writeText(props.mcpAccess.streamHttpUrl);
      props.onToast("success", "MCP URL copied to clipboard");
    } catch {
      props.onToast("error", "Failed to copy MCP URL");
    } finally {
      setIsCopying(false);
    }
  }

  async function copyAccessKey() {
    if (!props.mcpAccess.hasBearerToken) {
      props.onToast("warning", "No MCP access key is configured");
      return;
    }
    setIsCopying(true);
    try {
      const res = await apiRequest<McpAccessSecretResponse>(
        "POST",
        "/admin/mcp-access/reveal",
      );
      if (!res.ok) {
        props.onToast("error", res.message);
        return;
      }
      await navigator.clipboard.writeText(res.data.secret);
      props.onToast("success", "MCP access key copied to clipboard");
    } catch {
      props.onToast("error", "Failed to copy MCP access key");
    } finally {
      setIsCopying(false);
    }
  }

  async function saveAccessKey() {
    const token = draftToken.trim();
    if (!token) {
      props.onToast("warning", "Enter a new MCP access key first");
      return;
    }
    setIsSaving(true);
    try {
      const saved = await props.onSaveMcpAccess(token);
      if (saved) {
        resetEditor();
      }
    } finally {
      setIsSaving(false);
    }
  }

  function handleTokenBlur(
    event: FocusEvent<HTMLInputElement>,
  ) {
    if (!isEditing || draftToken.trim()) {
      return;
    }
    if (
      event.relatedTarget instanceof HTMLElement &&
      event.currentTarget.parentElement?.contains(event.relatedTarget)
    ) {
      return;
    }
    resetEditor();
  }

  function handleTokenKeyDown(
    event: KeyboardEvent<HTMLInputElement>,
  ) {
    if (event.key === "Enter" && isEditing) {
      event.preventDefault();
      void saveAccessKey();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      resetEditor();
    }
  }

  const actionBusy = props.loading || isCopying || isSaving;
  const tokenValue = isEditing ? draftToken : (props.mcpAccess.tokenPreview ?? "");
  const tokenPlaceholder = isEditing
    ? "Enter a new bearer token"
    : (props.mcpAccess.hasBearerToken ? "" : "No key configured");
  const tokenActionLabel = isEditing ? "Save Key" : "Copy Key";
  const tokenActionDisabled = isEditing
    ? actionBusy || !draftToken.trim()
    : actionBusy || !props.mcpAccess.hasBearerToken;
  const tokenNote = isEditing
    ? "Saving replaces the current key immediately. Press Esc to cancel editing."
    : `Authorization: ${props.mcpAccess.authScheme} <token>. Click the field to replace the current key.`;

  return (
    <>
      <AccessSectionHeader />
      <AccessUrlField
        authScheme={props.mcpAccess.authScheme}
        disabled={props.loading || isCopying || !props.mcpAccess.streamHttpUrl}
        streamHttpUrl={props.mcpAccess.streamHttpUrl}
        onCopy={() => void copyStreamHttpUrl()}
      />
      <div className="grid gap-2">
        <Label className="text-sm font-medium">MCP Access Key</Label>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            className="font-mono"
            disabled={props.loading || isSaving}
            placeholder={tokenPlaceholder}
            readOnly={!isEditing}
            spellCheck={false}
            type={isEditing ? "password" : "text"}
            value={tokenValue}
            onBlur={handleTokenBlur}
            onChange={(event) => setDraftToken(event.target.value)}
            onFocus={beginEditing}
            onKeyDown={handleTokenKeyDown}
          />
          <Button
            size="sm"
            variant={isEditing ? "default" : "secondary"}
            disabled={tokenActionDisabled}
            type="button"
            onClick={() => {
              if (isEditing) {
                void saveAccessKey();
                return;
              }
              void copyAccessKey();
            }}
          >
            {isEditing ? <Save size={14} /> : <Copy size={14} />}
            {tokenActionLabel}
          </Button>
        </div>
        <p className="text-muted-foreground text-xs">{tokenNote}</p>
      </div>
    </>
  );
}
