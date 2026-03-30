import { ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { StrategyPanelProps } from "./strategy-types";

function ToolGroup(props: Readonly<{
  label: string;
  tools: string[];
  variant: "default" | "neutral" | "warning";
}>) {
  return (
    <div className="grid gap-3 rounded-[20px] border border-white/8 bg-white/4 p-4">
      <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--text-dim)]">
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
          <span className="text-sm text-[color:var(--text-soft)]">None</span>
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
      <ToolGroup label="Hidden tools" tools={hiddenTools} variant="warning" />

      <details className="rounded-[22px] border border-white/8 bg-[color:var(--ui-card-soft)] p-4">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-[color:var(--text)]">
          <span>Recommended prompt</span>
          <ChevronDown className="size-4 text-[color:var(--text-dim)]" />
        </summary>
        <ScrollArea className="mt-4 max-h-44 pr-3">
          <pre className="whitespace-pre-wrap font-['IBM_Plex_Mono'] text-[12px] leading-6 text-[color:var(--text-soft)]">
            {props.toolSurface.clientGuidance.recommendedPrompt}
          </pre>
        </ScrollArea>
      </details>
    </div>
  );
}
