import type { StrategyPanelProps } from "./strategy-types";
import { AdminAccessFields } from "../AdminAccessFields";
import { McpAccessFields } from "../McpAccessFields";

export function StrategyAccessTab(
  props: Pick<
    StrategyPanelProps,
    "adminAccess" | "loading" | "mcpAccess" | "onSaveAdminAccess" | "onSaveMcpAccess" | "onToast"
  >,
) {
  return (
    <div className="strategy-access-embedded grid gap-4">
      <div className="rounded-[22px] border border-white/8 bg-[color:var(--ui-card-soft)] p-4">
        <AdminAccessFields
          adminAccess={props.adminAccess}
          loading={props.loading}
          onSaveAdminAccess={props.onSaveAdminAccess}
          onToast={props.onToast}
        />
      </div>
      <div className="rounded-[22px] border border-white/8 bg-[color:var(--ui-card-soft)] p-4">
        <McpAccessFields
          loading={props.loading}
          mcpAccess={props.mcpAccess}
          onSaveMcpAccess={props.onSaveMcpAccess}
          onToast={props.onToast}
        />
      </div>
    </div>
  );
}
