import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ToolSurfaceSnapshot } from "@shared/contracts";
import { LoadingOverlay } from "../Feedback";

type ToolSurfaceCardProps = Readonly<{
  toolSurface: ToolSurfaceSnapshot;
  loading: boolean;
}>;

function ToolGroup(props: Readonly<{
  label: string;
  tools: string[];
  variant: "default" | "neutral" | "warning" | "success";
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

export function ToolSurfaceCard(props: ToolSurfaceCardProps) {
  const hiddenTools = props.toolSurface.hiddenTools.map(
    (tool) => `${tool.tool} (${tool.reason})`,
  );

  return (
    <Card className="relative">
      {props.loading ? <LoadingOverlay label="Refreshing tool surface" /> : null}
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="eyebrow">Tool Surface</div>
            <CardTitle className="mt-2">MCP Tool Exposure</CardTitle>
            <CardDescription className="mt-2 max-w-xl">
              All registered MCP tools organized by category. Tools are automatically discovered and classified.
            </CardDescription>
          </div>
          <Badge variant="neutral">
            {props.toolSurface.exposedTools.length} exposed
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
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
        {hiddenTools.length > 0 ? (
          <ToolGroup label="Hidden tools" tools={hiddenTools} variant="warning" />
        ) : null}
      </CardContent>
    </Card>
  );
}
