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
    <div className="grid">
      <section className="pb-5">
        <AdminAccessFields
          adminAccess={props.adminAccess}
          loading={props.loading}
          onSaveAdminAccess={props.onSaveAdminAccess}
          onToast={props.onToast}
        />
      </section>
      <section className="border-t border-border/60 pt-5">
        <McpAccessFields
          loading={props.loading}
          mcpAccess={props.mcpAccess}
          onSaveMcpAccess={props.onSaveMcpAccess}
          onToast={props.onToast}
        />
      </section>
    </div>
  );
}
