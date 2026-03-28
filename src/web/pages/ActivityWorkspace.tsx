import type { RequestActivityRecord } from "@shared/contracts";
import { ActivityHub } from "../components/ActivityHub";
import { formatNumber } from "../format";
import { WorkspaceIntro } from "../components/WorkspaceIntro";

type ActivityWorkspaceProps = Readonly<{
  activity: RequestActivityRecord[];
  loading: boolean;
}>;

function countFailed(activity: RequestActivityRecord[]) {
  return activity.filter((item) => item.request.status === "failed").length;
}

function countTools(activity: RequestActivityRecord[]) {
  return new Set(activity.map((item) => item.request.toolName)).size;
}

export function ActivityWorkspace(props: ActivityWorkspaceProps) {
  const metrics = [
    { label: "Logged Requests", value: formatNumber(props.activity.length) },
    {
      label: "Failed Runs",
      value: formatNumber(countFailed(props.activity)),
      tone: countFailed(props.activity) ? ("warning" as const) : undefined,
    },
    { label: "Observed Tools", value: formatNumber(countTools(props.activity)) },
  ];

  return (
    <div className="workspace-stack">
      <WorkspaceIntro
        eyebrow="Activity"
        title="Trace request execution across tools, providers, and retry attempts."
        description="Use this inspector to filter traffic, scan failures quickly, and inspect the exact inputs, outputs, and provider attempts behind each run."
        metrics={metrics}
      />
      <ActivityHub activity={props.activity} loading={props.loading} />
    </div>
  );
}
