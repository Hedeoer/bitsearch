import { Badge } from "@/components/ui/badge";
import type { StrategyPanelProps } from "./strategy-types";

function ToolGroup(props: Readonly<{
  label: string;
  tools: string[];
  variant: "default" | "neutral" | "warning" | "success";
}>) {
  return (
    <div className="grid gap-3 rounded-lg border border-border/70 bg-muted/20 p-4">
      <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {props.label}
      </div>
      <div className="flex flex-wrap gap-2">
        {props.tools.length > 0 ? (
          props.tools.map((tool) => (
            <Badge key={tool} variant={props.variant}>
              {tool}
            </Badge>
          ))
        ) : (
          <span className="text-sm text-muted-foreground">None</span>
        )}
      </div>
    </div>
  );
}

export function StrategySurfaceTab(props: Pick<StrategyPanelProps, "toolSurface">) {
  const hiddenTools = props.toolSurface.hiddenTools.map(
    (tool) => `${tool.tool} (${tool.reason})`,
  );

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 xl:grid-cols-2">
        <ToolGroup
          label="Generic tools"
          tools={props.toolSurface.genericTools}
          variant="default"
        />
        <ToolGroup
          label="Provider tools"
          tools={props.toolSurface.providerTools}
          variant="neutral"
        />
      </div>
      <div className="grid gap-3 xl:grid-cols-2">
        <ToolGroup
          label="Meta tools"
          tools={props.toolSurface.metaTools}
          variant="success"
        />
        <ToolGroup
          label="Planning tools"
          tools={props.toolSurface.planningTools}
          variant="success"
        />
      </div>
      <ToolGroup label="Hidden tools" tools={hiddenTools} variant="warning" />
    </div>
  );
}
