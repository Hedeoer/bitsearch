import { useState, type Dispatch, type SetStateAction } from "react";
import type { ProviderKeyRecord } from "@shared/contracts";
import { apiRequest } from "../api";
import { getErrorMessage } from "../format";
import type { ToastTone } from "./Feedback";
import {
  buildActionIds,
  type ActionResponse,
  type ConfirmDeleteState,
  type PendingStateSetter,
  summarizeAction,
  updatePendingIds,
} from "./key-workspace-utils";

type ActionConfig = {
  importTags: string;
  onToast: (type: ToastTone, message: string) => void;
  provider: string;
  rawKeys: string;
  refreshWorkspace: () => Promise<void>;
  revealedValues: Record<string, string>;
  selectedIds: string[];
  setRawKeys: (value: string) => void;
  setRevealedValues: Dispatch<SetStateAction<Record<string, string>>>;
  setSelectedIds: Dispatch<SetStateAction<string[]>>;
  visibleKeys: ProviderKeyRecord[];
};

export function useKeyWorkspaceActions(config: ActionConfig) {
  const [confirmDelete, setConfirmDelete] = useState<ConfirmDeleteState | null>(null);
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);
  const [isBatchSyncing, setIsBatchSyncing] = useState(false);
  const [isBatchTesting, setIsBatchTesting] = useState(false);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [copyingIds, setCopyingIds] = useState<Set<string>>(new Set());
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [revealingIds, setRevealingIds] = useState<Set<string>>(new Set());
  const [savingNoteIds, setSavingNoteIds] = useState<Set<string>>(new Set());
  const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set());
  const [testingIds, setTestingIds] = useState<Set<string>>(new Set());
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());

  async function runPendingAction(
    ids: string[],
    label: string,
    setter: PendingStateSetter,
    executor: () => Promise<ActionResponse>,
    clearSelectionAfter = false,
  ) {
    updatePendingIds(setter, ids, true);
    try {
      const result = await executor();
      config.onToast("success", summarizeAction(label, result));
      await config.refreshWorkspace();
      if (clearSelectionAfter) {
        config.setSelectedIds([]);
      }
    } catch (error) {
      config.onToast("error", getErrorMessage(error, `${label} failed`));
    } finally {
      updatePendingIds(setter, ids, false);
    }
  }

  async function fetchSecret(id: string) {
    updatePendingIds(setRevealingIds, [id], true);
    try {
      const data = await apiRequest<{ secret: string }>("/api/admin/keys/reveal", {
        method: "POST",
        body: JSON.stringify({ id }),
      });
      config.setRevealedValues((current) => ({ ...current, [id]: data.secret }));
      return data.secret;
    } finally {
      updatePendingIds(setRevealingIds, [id], false);
    }
  }

  async function importKeys() {
    if (!config.rawKeys.trim()) {
      config.onToast("warning", "Paste at least one key before importing");
      return;
    }
    setIsImporting(true);
    try {
      const result = await apiRequest<ActionResponse>("/api/admin/keys/import-text", {
        method: "POST",
        body: JSON.stringify({
          provider: config.provider,
          rawKeys: config.rawKeys,
          tags: config.importTags,
        }),
      });
      config.setRawKeys("");
      config.onToast("success", summarizeAction("Import complete", result));
      await config.refreshWorkspace();
    } catch (error) {
      config.onToast("error", getErrorMessage(error, "Key import failed"));
    } finally {
      setIsImporting(false);
    }
  }

  async function testKeys(ids: string[]) {
    const idsToRun = buildActionIds(ids, config.visibleKeys);
    if (idsToRun.length === 0) {
      config.onToast("warning", "There are no keys available to test");
      return;
    }
    await runPendingAction(idsToRun, "Testing complete", setTestingIds, () =>
      apiRequest<ActionResponse>("/api/admin/keys/test", {
        method: "POST",
        body: JSON.stringify({ provider: config.provider, ids: idsToRun }),
      }),
    );
  }

  async function syncQuota(ids: string[]) {
    const idsToRun = buildActionIds(ids, config.visibleKeys);
    if (idsToRun.length === 0) {
      config.onToast("warning", "There are no keys available to sync");
      return;
    }
    await runPendingAction(idsToRun, "Quota sync complete", setSyncingIds, () =>
      apiRequest<ActionResponse>("/api/admin/keys/quota-sync", {
        method: "POST",
        body: JSON.stringify({ provider: config.provider, ids: idsToRun }),
      }),
    );
  }

  function deleteKeys(ids: string[], source: "batch" | "card") {
    const idsToRun = buildActionIds(ids, config.visibleKeys);
    if (idsToRun.length === 0) {
      config.onToast("warning", "There are no keys available to delete");
      return;
    }
    const baseText = source === "card"
      ? `This will permanently delete ${idsToRun.length} key${idsToRun.length === 1 ? "" : "s"}.`
      : ids.length > 0
        ? `This will permanently delete ${idsToRun.length} selected key${idsToRun.length === 1 ? "" : "s"}.`
        : `No keys are selected. This will permanently delete all ${idsToRun.length} keys currently visible.`;
    setConfirmDelete({
      ids: idsToRun,
      source,
      title: `Delete ${idsToRun.length} key${idsToRun.length === 1 ? "" : "s"}?`,
      description: `${baseText} This action cannot be undone.`,
    });
  }

  async function confirmDeleteKeys() {
    if (!confirmDelete) {
      return;
    }
    if (confirmDelete.source === "batch") {
      setIsBatchDeleting(true);
    }
    setIsConfirmingDelete(true);
    await runPendingAction(
      confirmDelete.ids,
      "Delete complete",
      setDeletingIds,
      () => apiRequest<ActionResponse>("/api/admin/keys", {
        method: "DELETE",
        body: JSON.stringify({ ids: confirmDelete.ids }),
      }),
      true,
    );
    setIsBatchDeleting(false);
    setIsConfirmingDelete(false);
    setConfirmDelete(null);
  }

  async function toggleEnabled(ids: string[], enabled: boolean) {
    const idsToRun = buildActionIds(ids, config.visibleKeys);
    if (idsToRun.length === 0) {
      config.onToast("warning", "There are no keys available to update");
      return;
    }
    await runPendingAction(
      idsToRun,
      enabled ? "Enable complete" : "Disable complete",
      setTogglingIds,
      () => apiRequest<ActionResponse>("/api/admin/keys/bulk", {
        method: "PATCH",
        body: JSON.stringify({ ids: idsToRun, enabled }),
      }),
    );
  }

  async function saveNote(id: string, note: string) {
    await runPendingAction([id], "Note saved", setSavingNoteIds, () =>
      apiRequest<ActionResponse>("/api/admin/keys/meta", {
        method: "PATCH",
        body: JSON.stringify({ id, note }),
      }),
    );
  }

  async function toggleReveal(id: string) {
    if (config.revealedValues[id]) {
      config.setRevealedValues((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
      return;
    }
    try {
      await fetchSecret(id);
    } catch (error) {
      config.onToast("error", getErrorMessage(error, "Failed to reveal the key"));
    }
  }

  async function copyKey(id: string) {
    updatePendingIds(setCopyingIds, [id], true);
    try {
      const secret = config.revealedValues[id] ?? (await fetchSecret(id));
      await navigator.clipboard.writeText(secret);
      config.onToast("success", "Key copied to clipboard");
    } catch (error) {
      config.onToast("error", getErrorMessage(error, "Failed to copy the key"));
    } finally {
      updatePendingIds(setCopyingIds, [id], false);
    }
  }

  return {
    cancelDeleteConfirmation: () => !isConfirmingDelete && setConfirmDelete(null),
    confirmDelete,
    confirmDeleteKeys,
    copyKey,
    copyingIds,
    deleteCardKeys: (ids: string[]) => deleteKeys(ids, "card"),
    deleteSelectedKeys: () => deleteKeys(config.selectedIds, "batch"),
    deletingIds,
    disableSelectedKeys: async () => {
      setIsBulkUpdating(true);
      await toggleEnabled(config.selectedIds, false);
      setIsBulkUpdating(false);
    },
    enableSelectedKeys: async () => {
      setIsBulkUpdating(true);
      await toggleEnabled(config.selectedIds, true);
      setIsBulkUpdating(false);
    },
    importKeys,
    isBatchDeleting,
    isBatchSyncing,
    isBatchTesting,
    isBulkUpdating,
    isConfirmingDelete,
    isImporting,
    revealingIds,
    saveNote,
    savingNoteIds,
    syncCardKeys: syncQuota,
    syncingIds,
    syncSelectedKeys: async () => {
      setIsBatchSyncing(true);
      await syncQuota(config.selectedIds);
      setIsBatchSyncing(false);
    },
    testCardKeys: testKeys,
    testingIds,
    testSelectedKeys: async () => {
      setIsBatchTesting(true);
      await testKeys(config.selectedIds);
      setIsBatchTesting(false);
    },
    toggleCardEnabled: toggleEnabled,
    toggleReveal,
    togglingIds,
  };
}
