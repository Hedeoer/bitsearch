import { useState, type Dispatch, type SetStateAction } from "react";
import type {
  ProviderConfigRecord,
  RemoteProvider,
  SystemSettings,
  ToolSurfaceSnapshot,
} from "@shared/contracts";
import type { ToastTone } from "./components/Feedback";
import {
  createProviderDraft,
  createProviderDrafts,
  listDirtyProviders,
} from "./provider-drafts";
import { saveDirtyProviders, type ProviderSaveErrors } from "./provider-actions";
import type { ProviderDraft, ProviderDrafts } from "./types";

type ProviderWorkspaceStateParams = Readonly<{
  onToast: (type: ToastTone, message: string) => void;
  providers: ProviderConfigRecord[];
  setProviders: Dispatch<SetStateAction<ProviderConfigRecord[]>>;
  setSystem: Dispatch<SetStateAction<SystemSettings>>;
  setToolSurface: Dispatch<SetStateAction<ToolSurfaceSnapshot>>;
  system: SystemSettings;
}>;

type ProviderWorkspaceState = Readonly<{
  dirtyProviders: RemoteProvider[];
  discardChanges: () => void;
  drafts: ProviderDrafts;
  isSaving: boolean;
  reset: () => void;
  saveAllChanges: () => Promise<void>;
  saveErrors: ProviderSaveErrors;
  syncSnapshot: (providers: ProviderConfigRecord[], system: SystemSettings) => void;
  updateDraft: (provider: RemoteProvider, patch: Partial<ProviderDraft>) => void;
}>;

export function useProviderWorkspaceState(
  params: ProviderWorkspaceStateParams,
): ProviderWorkspaceState {
  const [drafts, setDrafts] = useState<ProviderDrafts>({});
  const [saveErrors, setSaveErrors] = useState<ProviderSaveErrors>({});
  const [isSaving, setIsSaving] = useState(false);
  const dirtyProviders = listDirtyProviders(params.providers, drafts, params.system);

  function syncSnapshot(providers: ProviderConfigRecord[], system: SystemSettings) {
    setDrafts(createProviderDrafts(providers, system));
    setSaveErrors({});
  }

  function reset() {
    setDrafts({});
    setSaveErrors({});
  }

  function updateDraft(provider: RemoteProvider, patch: Partial<ProviderDraft>) {
    const sourceProvider = params.providers.find((item) => item.provider === provider);
    if (!sourceProvider) {
      return;
    }
    setDrafts((current) => {
      const baseDraft = current[provider] ?? createProviderDraft(sourceProvider, params.system);
      return {
        ...current,
        [provider]: {
          ...baseDraft,
          ...patch,
        },
      };
    });
    setSaveErrors((current) => {
      if (!(provider in current)) {
        return current;
      }
      const nextErrors = { ...current };
      delete nextErrors[provider];
      return nextErrors;
    });
  }

  function discardChanges() {
    syncSnapshot(params.providers, params.system);
  }

  async function saveAllChanges() {
    if (dirtyProviders.length === 0 || isSaving) {
      return;
    }

    setIsSaving(true);
    setSaveErrors({});
    try {
      const result = await saveDirtyProviders({
        dirtyProviders,
        drafts,
        providers: params.providers,
        system: params.system,
      });
      params.setProviders(result.providers);
      setDrafts(result.drafts);
      params.setSystem(result.system);
      setSaveErrors(result.errors);
      if (result.toolSurface) {
        params.setToolSurface(result.toolSurface);
      }

      const failureCount = Object.keys(result.errors).length;
      if (failureCount === 0) {
        params.onToast(
          "success",
          `Saved changes for ${result.savedCount} provider${result.savedCount > 1 ? "s" : ""}.`,
        );
        return;
      }
      if (result.savedCount > 0) {
        params.onToast(
          "warning",
          `Saved ${result.savedCount} provider${result.savedCount > 1 ? "s" : ""}. ${failureCount} provider${failureCount > 1 ? "s still need" : " still needs"} attention.`,
        );
        return;
      }
      params.onToast("error", "No provider changes were saved.");
    } finally {
      setIsSaving(false);
    }
  }

  return {
    dirtyProviders,
    discardChanges,
    drafts,
    isSaving,
    reset,
    saveAllChanges,
    saveErrors,
    syncSnapshot,
    updateDraft,
  };
}
