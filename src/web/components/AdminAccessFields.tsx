import { useState } from "react";
import type { FocusEvent, KeyboardEvent } from "react";
import { Copy, KeyRound, Save } from "lucide-react";
import type { AdminAccessInfo, McpAccessSecretResponse } from "@shared/contracts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest } from "../api";
import type { ToastTone } from "./Feedback";

type AdminAccessFieldsProps = Readonly<{
  loading: boolean;
  adminAccess: AdminAccessInfo;
  onSaveAdminAccess: (authKey: string) => Promise<boolean>;
  onToast: (type: ToastTone, message: string) => void;
}>;

function AccessSectionHeader() {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Admin Access</p>
        <h3 className="mt-1 text-base font-semibold tracking-tight">Console Login</h3>
      </div>
      <KeyRound className="size-4 text-primary" />
    </div>
  );
}
export function AdminAccessFields(props: AdminAccessFieldsProps) {
  const [draftKey, setDraftKey] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  function resetEditor() {
    setDraftKey("");
    setIsEditing(false);
  }

  function beginEditing() {
    if (props.loading || isSaving || isEditing) {
      return;
    }
    setDraftKey("");
    setIsEditing(true);
  }

  async function copyAuthKey() {
    if (!props.adminAccess.hasAuthKey) {
      props.onToast("warning", "No admin authorization key is configured");
      return;
    }
    setIsCopying(true);
    try {
      const res = await apiRequest<McpAccessSecretResponse>(
        "POST",
        "/admin/admin-access/reveal",
      );
      if (!res.ok) {
        props.onToast("error", res.message);
        return;
      }
      await navigator.clipboard.writeText(res.data.secret);
      props.onToast("success", "Admin authorization key copied to clipboard");
    } catch {
      props.onToast("error", "Failed to copy admin authorization key");
    } finally {
      setIsCopying(false);
    }
  }

  async function saveAuthKey() {
    const authKey = draftKey.trim();
    if (!authKey) {
      props.onToast("warning", "Enter a new admin authorization key first");
      return;
    }
    setIsSaving(true);
    try {
      const saved = await props.onSaveAdminAccess(authKey);
      if (saved) {
        resetEditor();
      }
    } finally {
      setIsSaving(false);
    }
  }

  function handleKeyBlur(
    event: FocusEvent<HTMLInputElement>,
  ) {
    if (!isEditing || draftKey.trim()) {
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

  function handleKeyKeyDown(
    event: KeyboardEvent<HTMLInputElement>,
  ) {
    if (event.key === "Enter" && isEditing) {
      event.preventDefault();
      void saveAuthKey();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      resetEditor();
    }
  }

  const actionBusy = props.loading || isCopying || isSaving;
  const keyValue = isEditing ? draftKey : (props.adminAccess.authKeyPreview ?? "");
  const keyPlaceholder = isEditing
    ? "Enter a new admin authorization key"
    : (props.adminAccess.hasAuthKey ? "" : "No key configured");
  const keyActionLabel = isEditing ? "Save Key" : "Copy Key";
  const keyActionDisabled = isEditing
    ? actionBusy || !draftKey.trim()
    : actionBusy || !props.adminAccess.hasAuthKey;
  const keyNote = isEditing
    ? "Saving replaces the current key immediately. Press Esc to cancel editing."
    : "Use this key to sign in to the admin console. Click the field to replace the current key.";

  return (
    <>
      <AccessSectionHeader />
      <div className="grid gap-2">
        <Label className="text-sm font-medium">Admin Authorization Key</Label>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            className="font-mono"
            disabled={props.loading || isSaving}
            placeholder={keyPlaceholder}
            readOnly={!isEditing}
            spellCheck={false}
            type={isEditing ? "password" : "text"}
            value={keyValue}
            onBlur={handleKeyBlur}
            onChange={(event) => setDraftKey(event.target.value)}
            onFocus={beginEditing}
            onKeyDown={handleKeyKeyDown}
          />
          <Button
            size="sm"
            variant={isEditing ? "default" : "secondary"}
            disabled={keyActionDisabled}
            type="button"
            onClick={() => {
              if (isEditing) {
                void saveAuthKey();
                return;
              }
              void copyAuthKey();
            }}
          >
            {isEditing ? <Save size={14} /> : <Copy size={14} />}
            {keyActionLabel}
          </Button>
        </div>
        <p className="text-muted-foreground text-xs">{keyNote}</p>
      </div>
    </>
  );
}
