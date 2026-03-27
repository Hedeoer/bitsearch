import { useDeferredValue, useEffect, useMemo, useState } from "react";
import type { KeyPoolSummary, ProviderKeyRecord } from "@shared/contracts";
import { apiRequest } from "../api";
import { getErrorMessage } from "../format";
import type { KeySortMode } from "../types";
import type { ToastTone } from "./Feedback";
import { DEFAULT_PROVIDER, DEFAULT_SORT, DEFAULT_STATUS, sortKeys } from "./key-workspace-utils";
import { useKeyWorkspaceActions } from "./useKeyWorkspaceActions";

type ToastHandler = (type: ToastTone, message: string) => void;

export function useKeyWorkspace(refreshNonce: number, onToast: ToastHandler) {
  const [provider, setProvider] = useState(DEFAULT_PROVIDER);
  const [rawKeys, setRawKeys] = useState("");
  const [importTags, setImportTags] = useState("");
  const [status, setStatus] = useState(DEFAULT_STATUS);
  const [tag, setTag] = useState("");
  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState<KeySortMode>(DEFAULT_SORT);
  const deferredQuery = useDeferredValue(query);
  const [keys, setKeys] = useState<ProviderKeyRecord[]>([]);
  const [summary, setSummary] = useState<KeyPoolSummary | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [revealedValues, setRevealedValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const visibleKeys = useMemo(() => sortKeys(keys, sortMode), [keys, sortMode]);

  useEffect(() => {
    setSelectedIds([]);
    setRevealedValues({});
  }, [provider, status, tag, deferredQuery]);

  useEffect(() => {
    setSelectedIds((current) => current.filter((id) => keys.some((item) => item.id === id)));
  }, [keys]);

  useEffect(() => {
    void refreshWorkspace();
  }, [provider, status, tag, deferredQuery, refreshNonce]);

  async function refreshWorkspace() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ provider, status, query: deferredQuery, tag });
      const [keyData, summaryData] = await Promise.all([
        apiRequest<ProviderKeyRecord[]>(`/api/admin/keys?${params.toString()}`),
        apiRequest<KeyPoolSummary>(`/api/admin/keys/summary?provider=${provider}`),
      ]);
      setKeys(keyData);
      setSummary(summaryData);
    } catch (error) {
      onToast("error", getErrorMessage(error, "Failed to refresh the key workspace"));
    } finally {
      setLoading(false);
    }
  }

  function toggleSelected(id: string) {
    setSelectedIds((current) => (
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    ));
  }

  const actions = useKeyWorkspaceActions({
    importTags,
    onToast,
    provider,
    rawKeys,
    refreshWorkspace,
    revealedValues,
    selectedIds,
    setRawKeys,
    setRevealedValues,
    setSelectedIds,
    visibleKeys,
  });

  return {
    ...actions,
    clearSelection: () => setSelectedIds([]),
    importTags,
    keys: visibleKeys,
    loading,
    provider,
    query,
    rawKeys,
    resetFilters: () => {
      setStatus(DEFAULT_STATUS);
      setTag("");
      setQuery("");
    },
    revealedValues,
    scrollToImportPanel: () =>
      document.getElementById("keys")?.scrollIntoView({ behavior: "smooth", block: "start" }),
    selectAllVisible: () => setSelectedIds(visibleKeys.map((item) => item.id)),
    selectedIds,
    setImportTags,
    setProvider,
    setQuery,
    setRawKeys,
    setSortMode,
    setStatus,
    setTag,
    sortMode,
    status,
    summary,
    tag,
    toggleSelected,
  };
}
