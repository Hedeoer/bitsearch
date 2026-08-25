import { EyeOff } from "lucide-react";
import type { StrategyPanelProps } from "./strategy-types";

function ToolTag(props: Readonly<{
  name: string;
  dotColor?: string;
}>) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-border/70 bg-muted/30 px-2.5 py-1 font-mono text-xs text-foreground/90 transition-colors hover:border-primary/40 hover:bg-muted/60">
      <span className={`size-1.5 rounded-full ${props.dotColor ?? "bg-primary/70"}`} />
      {props.name}
    </span>
  );
}

function ToolSection(props: Readonly<{
  count: number;
  dotColor?: string;
  label: string;
  tools: string[];
}>) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-foreground">
          {props.label}
        </span>
        <span className="font-mono text-xs text-muted-foreground">
          {props.count}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5 rounded-lg border border-border/50 bg-muted/15 p-3 min-h-[52px] items-center">
        {props.tools.length > 0 ? (
          props.tools.map((tool) => (
            <ToolTag key={tool} name={tool} dotColor={props.dotColor} />
          ))
        ) : (
          <span className="text-xs text-muted-foreground italic">None registered</span>
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
    <div className="space-y-4 pt-1">
      <div className="grid gap-4 md:grid-cols-2">
        <ToolSection
          label="Generic Tools"
          count={props.toolSurface.genericTools.length}
          tools={props.toolSurface.genericTools}
          dotColor="bg-primary"
        />
        <ToolSection
          label="Provider Tools"
          count={props.toolSurface.providerTools.length}
          tools={props.toolSurface.providerTools}
          dotColor="bg-sky-500"
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <ToolSection
          label="Meta Tools"
          count={props.toolSurface.metaTools.length}
          tools={props.toolSurface.metaTools}
          dotColor="bg-emerald-500"
        />
        <ToolSection
          label="Planning Tools"
          count={props.toolSurface.planningTools.length}
          tools={props.toolSurface.planningTools}
          dotColor="bg-amber-500"
        />
      </div>

      {hiddenTools.length > 0 ? (
        <div className="space-y-2 pt-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-warning">
            <EyeOff className="size-3.5" />
            <span>Hidden Tools ({hiddenTools.length})</span>
          </div>
          <div className="flex flex-wrap gap-1.5 rounded-lg border border-warning/30 bg-warning/5 p-3">
            {hiddenTools.map((tool) => (
              <span
                key={tool}
                className="inline-flex items-center gap-1.5 rounded-md border border-warning/30 bg-warning/10 px-2 py-0.5 font-mono text-xs text-foreground/80"
              >
                <span className="size-1.5 rounded-full bg-warning" />
                {tool}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
