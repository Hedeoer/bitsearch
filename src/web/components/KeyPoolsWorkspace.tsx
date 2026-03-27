import { useDeferredValue, useEffect, useState } from "react";
import type {
  KeyListStatus,
  KeyPoolProvider,
  KeyPoolSummary,
  ProviderKeyRecord,
} from "@shared/contracts";
import { apiRequest } from "../api";
import { KeyPoolImportPanel } from "./KeyPoolImportPanel";
import { KeyInventoryPanel } from "./KeyInventoryPanel";

const DEFAULT_PROVIDER: KeyPoolProvider = "tavily";
const DEFAULT_STATUS: KeyListStatus = "all";

type ActionResponse = {
  ok?: boolean;
  updated?: number;
  failed?: number;
  changed?: number;
  inserted?: number;
  skipped?: number;
};

type KeyPoolsWorkspaceProps = {
  refreshNonce: number;
  onMessage: (message: string) => void;
};

function buildActionIds(selectedIds: string[], visibleKeys: ProviderKeyRecord[]): string[] {
  if (selectedIds.length > 0) {
    return selectedIds;
  }
  return visibleKeys.map((item) => item.id);
}

function summarizeAction(label: string, response: ActionResponse): string {
  if (typeof response.inserted === "number") {
    return `${label}：新增 ${response.inserted}，跳过 ${response.skipped ?? 0}`;
  }
  if (typeof response.changed === "number") {
    return `${label}：${response.changed} 个`;
  }
  if (response.ok) {
    return label;
  }
  return `${label}：成功 ${response.updated ?? 0}，失败 ${response.failed ?? 0}`;
}

export function KeyPoolsWorkspace(props: KeyPoolsWorkspaceProps) {
  const [provider, setProvider] = useState<KeyPoolProvider>(DEFAULT_PROVIDER);
  const [rawKeys, setRawKeys] = useState("");
  const [importTags, setImportTags] = useState("");
  const [status, setStatus] = useState<KeyListStatus>(DEFAULT_STATUS);
  const [tag, setTag] = useState("");
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [keys, setKeys] = useState<ProviderKeyRecord[]>([]);
  const [summary, setSummary] = useState<KeyPoolSummary | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [revealedValues, setRevealedValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSelectedIds([]);
    setRevealedValues({});
  }, [provider, status, tag, deferredQuery]);

  useEffect(() => {
    void refreshWorkspace();
  }, [provider, status, tag, deferredQuery, props.refreshNonce]);

  async function refreshWorkspace() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        provider,
        status,
        query: deferredQuery,
        tag,
      });
      const [keyData, summaryData] = await Promise.all([
        apiRequest<ProviderKeyRecord[]>(`/api/admin/keys?${params.toString()}`),
        apiRequest<KeyPoolSummary>(`/api/admin/keys/summary?provider=${provider}`),
      ]);
      setKeys(keyData);
      setSummary(summaryData);
    } finally {
      setLoading(false);
    }
  }

  function toggleSelected(id: string) {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  }

  function selectAllVisible() {
    setSelectedIds(keys.map((item) => item.id));
  }

  function clearSelection() {
    setSelectedIds([]);
  }

  async function runAction(
    label: string,
    executor: () => Promise<ActionResponse>,
  ) {
    setBusy(true);
    try {
      const result = await executor();
      props.onMessage(summarizeAction(label, result));
      await refreshWorkspace();
      setSelectedIds([]);
    } finally {
      setBusy(false);
    }
  }

  async function importKeys() {
    if (!rawKeys.trim()) {
      props.onMessage("请先粘贴 key。");
      return;
    }
    await runAction("导入完成", () =>
      apiRequest<ActionResponse>("/api/admin/keys/import-text", {
        method: "POST",
        body: JSON.stringify({
          provider,
          rawKeys,
          tags: importTags,
        }),
      }),
    );
    setRawKeys("");
  }

  async function testKeys(ids: string[]) {
    const actionIds = buildActionIds(ids, keys);
    if (actionIds.length === 0) {
      props.onMessage("当前没有可测试的 key。");
      return;
    }
    await runAction("测试完成", () =>
      apiRequest<ActionResponse>("/api/admin/keys/test", {
        method: "POST",
        body: JSON.stringify({ provider, ids: actionIds }),
      }),
    );
  }

  async function syncQuota(ids: string[]) {
    const actionIds = buildActionIds(ids, keys);
    if (actionIds.length === 0) {
      props.onMessage("当前没有可同步额度的 key。");
      return;
    }
    await runAction("额度同步完成", () =>
      apiRequest<ActionResponse>("/api/admin/keys/quota-sync", {
        method: "POST",
        body: JSON.stringify({ provider, ids: actionIds }),
      }),
    );
  }

  async function deleteKeys(ids: string[]) {
    const actionIds = buildActionIds(ids, keys);
    if (actionIds.length === 0) {
      props.onMessage("当前没有可删除的 key。");
      return;
    }
    await runAction("删除完成", () =>
      apiRequest<ActionResponse>("/api/admin/keys", {
        method: "DELETE",
        body: JSON.stringify({ ids: actionIds }),
      }),
    );
  }

  async function toggleEnabled(ids: string[], enabled: boolean) {
    const actionIds = buildActionIds(ids, keys);
    if (actionIds.length === 0) {
      props.onMessage("当前没有可操作的 key。");
      return;
    }
    await runAction(enabled ? "启用完成" : "停用完成", () =>
      apiRequest<ActionResponse>("/api/admin/keys/bulk", {
        method: "PATCH",
        body: JSON.stringify({ ids: actionIds, enabled }),
      }),
    );
  }

  async function saveNote(id: string, note: string) {
    await runAction("备注已保存。", () =>
      apiRequest<ActionResponse>("/api/admin/keys/meta", {
        method: "PATCH",
        body: JSON.stringify({ id, note }),
      }),
    );
  }

  async function toggleReveal(id: string) {
    if (revealedValues[id]) {
      setRevealedValues((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
      return;
    }
    const data = await apiRequest<{ secret: string }>("/api/admin/keys/reveal", {
      method: "POST",
      body: JSON.stringify({ id }),
    });
    setRevealedValues((current) => ({ ...current, [id]: data.secret }));
  }

  async function copyKey(id: string) {
    const secret = revealedValues[id]
      ? revealedValues[id]
      : (await apiRequest<{ secret: string }>("/api/admin/keys/reveal", {
          method: "POST",
          body: JSON.stringify({ id }),
        })).secret;
    await navigator.clipboard.writeText(secret);
    props.onMessage("已复制 key。");
  }

  return (
    <section className="workspace-grid">
      <KeyPoolImportPanel
        busy={busy}
        onImport={() => void importKeys()}
        rawKeys={rawKeys}
        selectedProvider={provider}
        setRawKeys={setRawKeys}
        setSelectedProvider={setProvider}
        setTags={setImportTags}
        summary={summary}
        tags={importTags}
      />
      <KeyInventoryPanel
        busy={busy}
        keys={keys}
        loading={loading}
        onBulkToggle={(enabled) => void toggleEnabled(selectedIds, enabled)}
        onClearSelection={clearSelection}
        onCopy={(id) => void copyKey(id)}
        onDelete={(ids) => void deleteKeys(ids)}
        onQueryChange={setQuery}
        onSaveNote={(id, note) => void saveNote(id, note)}
        onSelectAll={selectAllVisible}
        onStatusChange={setStatus}
        onSyncQuota={(ids) => void syncQuota(ids)}
        onTagChange={setTag}
        onTest={(ids) => void testKeys(ids)}
        onToggleEnabled={(id, enabled) => void toggleEnabled([id], enabled)}
        onToggleReveal={(id) => void toggleReveal(id)}
        onToggleSelected={toggleSelected}
        provider={provider}
        query={query}
        revealedValues={revealedValues}
        selectedIds={selectedIds}
        status={status}
        summary={summary}
        tag={tag}
      />
    </section>
  );
}
