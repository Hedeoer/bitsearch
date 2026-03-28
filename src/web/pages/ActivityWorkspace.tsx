import type { RequestActivityRecord } from "@shared/contracts";
import { ActivityHub } from "../components/ActivityHub";

type ActivityWorkspaceProps = Readonly<{
  activity: RequestActivityRecord[];
  loading: boolean;
}>;

export function ActivityWorkspace(props: ActivityWorkspaceProps) {
  return (
    <div className="workspace-stack">
      <ActivityHub activity={props.activity} loading={props.loading} />
    </div>
  );
}
