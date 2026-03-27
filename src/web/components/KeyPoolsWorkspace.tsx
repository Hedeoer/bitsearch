import type { ToastTone } from "./Feedback";
import { ConfirmDialog } from "./Feedback";
import { KeyPoolImportPanel } from "./KeyPoolImportPanel";
import { KeyInventoryPanel } from "./KeyInventoryPanel";
import { useKeyWorkspace } from "./useKeyWorkspace";

type KeyPoolsWorkspaceProps = {
  refreshNonce: number;
  onToast: (type: ToastTone, message: string) => void;
};

export function KeyPoolsWorkspace(props: KeyPoolsWorkspaceProps) {
  const workspace = useKeyWorkspace(props.refreshNonce, props.onToast);

  return (
    <>
      <section className="workspace-grid">
        <KeyPoolImportPanel
          busy={workspace.isImporting}
          loading={workspace.loading}
          onImport={() => void workspace.importKeys()}
          rawKeys={workspace.rawKeys}
          selectedProvider={workspace.provider}
          setRawKeys={workspace.setRawKeys}
          setSelectedProvider={workspace.setProvider}
          setTags={workspace.setImportTags}
          summary={workspace.summary}
          tags={workspace.importTags}
        />
        <KeyInventoryPanel
          copyingIds={workspace.copyingIds}
          deletingIds={workspace.deletingIds}
          isBatchDeleting={workspace.isBatchDeleting}
          isBatchSyncing={workspace.isBatchSyncing}
          isBatchTesting={workspace.isBatchTesting}
          isBulkUpdating={workspace.isBulkUpdating}
          keys={workspace.keys}
          loading={workspace.loading}
          onClearSelection={workspace.clearSelection}
          onCopy={(id) => void workspace.copyKey(id)}
          onDelete={(ids) => workspace.deleteCardKeys(ids)}
          onDeleteSelected={workspace.deleteSelectedKeys}
          onDisableSelected={() => void workspace.disableSelectedKeys()}
          onEnableSelected={() => void workspace.enableSelectedKeys()}
          onJumpToImport={workspace.scrollToImportPanel}
          onQueryChange={workspace.setQuery}
          onResetFilters={workspace.resetFilters}
          onSaveNote={(id, note) => void workspace.saveNote(id, note)}
          onSelectAll={workspace.selectAllVisible}
          onSortChange={workspace.setSortMode}
          onStatusChange={workspace.setStatus}
          onSyncQuota={(ids) => void workspace.syncCardKeys(ids)}
          onSyncSelected={() => void workspace.syncSelectedKeys()}
          onTagChange={workspace.setTag}
          onTest={(ids) => void workspace.testCardKeys(ids)}
          onTestSelected={() => void workspace.testSelectedKeys()}
          onToggleEnabled={(id, enabled) => void workspace.toggleCardEnabled([id], enabled)}
          onToggleReveal={(id) => void workspace.toggleReveal(id)}
          onToggleSelected={workspace.toggleSelected}
          provider={workspace.provider}
          query={workspace.query}
          revealedValues={workspace.revealedValues}
          revealingIds={workspace.revealingIds}
          savingNoteIds={workspace.savingNoteIds}
          selectedIds={workspace.selectedIds}
          sortMode={workspace.sortMode}
          status={workspace.status}
          summary={workspace.summary}
          syncingIds={workspace.syncingIds}
          tag={workspace.tag}
          testingIds={workspace.testingIds}
          togglingIds={workspace.togglingIds}
        />
      </section>
      <ConfirmDialog
        cancelLabel="Cancel"
        confirmLabel="Delete keys"
        danger
        description={workspace.confirmDelete?.description ?? ""}
        onCancel={workspace.cancelDeleteConfirmation}
        onConfirm={() => void workspace.confirmDeleteKeys()}
        open={Boolean(workspace.confirmDelete)}
        pending={workspace.isConfirmingDelete}
        title={workspace.confirmDelete?.title ?? ""}
      />
    </>
  );
}
