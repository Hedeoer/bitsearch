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
    <div className="grid gap-4">
      <div className="rounded-[22px] border border-border/70 bg-card/95 p-4 shadow-sm backdrop-blur-xl">
        <AdminAccessFields
          adminAccess={props.adminAccess}
          loading={props.loading}
          onSaveAdminAccess={props.onSaveAdminAccess}
          onToast={props.onToast}
        />
      </div>
      <div className="rounded-[22px] border border-border/70 bg-card/95 p-4 shadow-sm backdrop-blur-xl">
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
