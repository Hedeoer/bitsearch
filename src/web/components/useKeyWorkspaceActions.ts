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
      const res = await apiRequest<{ secret: string }>("POST", "/admin/keys/reveal", { id });
      if (!res.ok) throw new Error(res.message);
      config.setRevealedValues((current) => ({ ...current, [id]: res.data.secret }));
      return res.data.secret;
    } finally {
      updatePendingIds(setRevealingIds, [id], false);
    }
  }

  async function importKeys(): Promise<boolean> {
    if (!config.rawKeys.trim()) {
      config.onToast("warning", "Paste at least one key before importing");
      return false;
    }
    setIsImporting(true);
    try {
      const res = await apiRequest<ActionResponse>("POST", "/admin/keys/import-text", {
        provider: config.provider,
        rawKeys: config.rawKeys,
        tags: config.importTags,
      });
      if (!res.ok) throw new Error(res.message);
      config.setRawKeys("");
      config.onToast("success", summarizeAction("Import complete", res.data));
      await config.refreshWorkspace();
      return true;
    } catch (error) {
      config.onToast("error", getErrorMessage(error, "Key import failed"));
      return false;
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
    await runPendingAction(idsToRun, "Testing complete", setTestingIds, async () => {
      const res = await apiRequest<ActionResponse>("POST", "/admin/keys/test", {
        provider: config.provider,
        ids: idsToRun,
      });
      if (!res.ok) throw new Error(res.message);
      return res.data;
    });
  }

  async function syncQuota(ids: string[]) {
    const idsToRun = buildActionIds(ids, config.visibleKeys);
    if (idsToRun.length === 0) {
      config.onToast("warning", "There are no keys available to sync");
      return;
    }
    await runPendingAction(idsToRun, "Quota sync complete", setSyncingIds, async () => {
      const res = await apiRequest<ActionResponse>("POST", "/admin/keys/quota-sync", {
        provider: config.provider,
        ids: idsToRun,
      });
      if (!res.ok) throw new Error(res.message);
      return res.data;
    });
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
      async () => {
        const res = await apiRequest<ActionResponse>("DELETE", "/admin/keys", { ids: confirmDelete.ids });
        if (!res.ok) throw new Error(res.message);
        return res.data;
      },
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
      async () => {
        const res = await apiRequest<ActionResponse>("PATCH", "/admin/keys/bulk", { ids: idsToRun, enabled });
        if (!res.ok) throw new Error(res.message);
        return res.data;
      },
    );
  }

  async function saveNote(id: string, note: string) {
    await runPendingAction([id], "Note saved", setSavingNoteIds, async () => {
      const res = await apiRequest<ActionResponse>("PATCH", "/admin/keys/meta", { id, note });
      if (!res.ok) throw new Error(res.message);
      return res.data;
    });
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
