import type { ToastTone } from "../components/Feedback";
import { KeyPoolsWorkspace } from "../components/KeyPoolsWorkspace";

type KeysWorkspaceProps = Readonly<{
  onToast: (type: ToastTone, message: string) => void;
  refreshNonce: number;
}>;

export function KeysWorkspace(props: KeysWorkspaceProps) {
  return (
    <div className="workspace-stack">
      <KeyPoolsWorkspace
        onToast={props.onToast}
        refreshNonce={props.refreshNonce}
      />
    </div>
  );
}
