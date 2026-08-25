import type { ProviderConfigRecord } from "@shared/contracts";
import type { ToastTone } from "../components/Feedback";
import { KeyPoolsWorkspace } from "../components/KeyPoolsWorkspace";

type KeysWorkspaceProps = Readonly<{
  onToast: (type: ToastTone, message: string) => void;
  refreshNonce: number;
  providers?: ProviderConfigRecord[];
}>;

export function KeysWorkspace(props: KeysWorkspaceProps) {
  return (
    <div className="grid gap-4">
      <KeyPoolsWorkspace
        onToast={props.onToast}
        refreshNonce={props.refreshNonce}
        providers={props.providers}
      />
    </div>
  );
}
