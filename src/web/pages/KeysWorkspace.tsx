import type { ToastTone } from "../components/Feedback";
import { KeyPoolsWorkspace } from "../components/KeyPoolsWorkspace";
import { WorkspaceIntro } from "../components/WorkspaceIntro";

type KeysWorkspaceProps = Readonly<{
  onToast: (type: ToastTone, message: string) => void;
  refreshNonce: number;
}>;

export function KeysWorkspace(props: KeysWorkspaceProps) {
  return (
    <div className="workspace-stack">
      <WorkspaceIntro
        eyebrow="Key Pools"
        title="Operate provider credentials with import, audit, and batch tooling."
        description="The left rail handles intake and export while the inventory surface keeps quotas, health, and batch actions visible for active operations."
      />
      <KeyPoolsWorkspace
        onToast={props.onToast}
        refreshNonce={props.refreshNonce}
      />
    </div>
  );
}
