import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EyeOff, Loader2, Wrench } from "lucide-react";
import {
  GENERIC_LAYER_TOOLS,
  META_LAYER_TOOLS,
  PLANNING_LAYER_TOOLS,
  PROVIDER_LAYER_TOOLS,
  type ToolSurfaceSnapshot,
} from "@shared/contracts";
import type { ToastTone } from "../Feedback";
import { LoadingOverlay } from "../Feedback";
import { apiRequest } from "../../api";

const PROVIDER_TOOLS_FLAT: string[] = Object.values(PROVIDER_LAYER_TOOLS).flat();

type ToolSurfaceCardProps = Readonly<{
  toolSurface: ToolSurfaceSnapshot;
  loading: boolean;
  onToast: (type: ToastTone, message: string) => void;
  onToolSurfaceChange: (snapshot: ToolSurfaceSnapshot) => void;
}>;

function ToolTag(props: Readonly<{
  name: string;
  dotColor?: string;
  disabled: boolean;
  pending: boolean;
  onToggle: () => void;
}>) {
  return (
    <button
      type="button"
      aria-pressed={props.disabled}
      title={props.disabled ? `Enable ${props.name}` : `Disable ${props.name}`}
      className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-mono text-xs transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none ${
        props.disabled
          ? "border-border/50 bg-muted/20 text-muted-foreground line-through decoration-muted-foreground/50 hover:border-primary/40"
          : "border-border/70 bg-muted/30 text-foreground/90 hover:border-primary/40 hover:bg-muted/60"
      } ${props.pending ? "opacity-60" : ""}`}
      disabled={props.pending}
      onClick={props.onToggle}
    >
      {props.pending ? (
        <Loader2 className="size-3 animate-spin" aria-hidden="true" />
      ) : props.disabled ? (
        <EyeOff className="size-3" aria-hidden="true" />
      ) : (
        <span className={`size-1.5 rounded-full ${props.dotColor ?? "bg-primary/70"}`} />
      )}
      {props.name}
    </button>
  );
}

function ToolSection(props: Readonly<{
  dotColor?: string;
  label: string;
  universe: readonly string[];
  tools: string[];
  disabledSet: ReadonlySet<string>;
  pendingTool: string | null;
  onToggle: (tool: string) => void;
  hint?: string;
}>) {
  // 被手动禁用的工具仍留在原分组（灰态可点击恢复），exposed 工具按快照顺序在前。
  const shown = [
    ...props.tools,
    ...props.universe.filter(
      (tool) => props.disabledSet.has(tool) && !props.tools.includes(tool),
    ),
  ];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-foreground">
          {props.label}
        </span>
        <span className="font-mono text-xs text-muted-foreground">
          {props.tools.length}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5 rounded-lg border border-border/50 bg-muted/15 p-3 min-h-[52px] items-center">
        {shown.length > 0 ? (
          shown.map((tool) => (
            <ToolTag
              key={tool}
              name={tool}
              dotColor={props.dotColor}
              disabled={props.disabledSet.has(tool)}
              pending={props.pendingTool === tool}
              onToggle={() => props.onToggle(tool)}
            />
          ))
        ) : (
          <span className="text-xs text-muted-foreground italic">None registered</span>
        )}
      </div>
      {props.hint ? (
        <p className="m-0 text-xs text-muted-foreground">{props.hint}</p>
      ) : null}
    </div>
  );
}

export function ToolSurfaceCard(props: ToolSurfaceCardProps) {
  const [pendingTool, setPendingTool] = useState<string | null>(null);
  const hiddenTools = props.toolSurface.hiddenTools.map(
    (tool) => `${tool.tool} (${tool.reason})`,
  );
  const disabledSet = new Set(
    props.toolSurface.hiddenTools
      .filter((tool) => tool.reason === "manually_disabled")
      .map((tool) => tool.tool),
  );

  async function toggleTool(tool: string) {
    const nextDisabled = disabledSet.has(tool)
      ? [...disabledSet].filter((item) => item !== tool)
      : [...disabledSet, tool];
    setPendingTool(tool);
    const response = await apiRequest<ToolSurfaceSnapshot>(
      "PUT",
      "/admin/tools/disabled",
      { disabledTools: nextDisabled },
    );
    setPendingTool(null);
    if (!response.ok) {
      props.onToast("error", `Failed to update ${tool}: ${response.message}`);
      return;
    }
    props.onToolSurfaceChange(response.data);
    props.onToast(
      "success",
      disabledSet.has(tool)
        ? `${tool} enabled — clients were notified via tools/list_changed`
        : `${tool} disabled — clients were notified via tools/list_changed`,
    );
  }

  return (
    <Card className="relative shadow-xs">
      {props.loading ? <LoadingOverlay label="Refreshing tool surface" /> : null}
      <CardHeader className="border-b border-border/50 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Wrench className="size-4 text-primary" />
              <CardTitle className="text-base font-semibold">MCP Tool Exposure</CardTitle>
            </div>
            <CardDescription className="mt-1.5 max-w-xl text-xs leading-relaxed">
              All registered MCP tools organized by category. Click a tool to disable or re-enable it; changes broadcast tools/list_changed to connected clients immediately.
            </CardDescription>
          </div>
          <Badge variant="neutral">
            <span className="font-mono tabular-nums">{props.toolSurface.exposedTools.length}</span> exposed
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-5">
        <div className="grid gap-4 md:grid-cols-2">
          <ToolSection
            label="Generic Tools"
            universe={GENERIC_LAYER_TOOLS}
            tools={props.toolSurface.genericTools}
            dotColor="bg-primary"
            disabledSet={disabledSet}
            pendingTool={pendingTool}
            onToggle={(tool) => void toggleTool(tool)}
          />
          <ToolSection
            label="Provider Tools"
            universe={PROVIDER_TOOLS_FLAT}
            tools={props.toolSurface.providerTools}
            dotColor="bg-sky-500"
            disabledSet={disabledSet}
            pendingTool={pendingTool}
            onToggle={(tool) => void toggleTool(tool)}
          />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <ToolSection
            label="Meta Tools"
            universe={META_LAYER_TOOLS}
            tools={props.toolSurface.metaTools}
            dotColor="bg-emerald-500"
            disabledSet={disabledSet}
            pendingTool={pendingTool}
            onToggle={(tool) => void toggleTool(tool)}
            hint="Disabling these breaks client paging and config introspection."
          />
          <ToolSection
            label="Planning Tools"
            universe={PLANNING_LAYER_TOOLS}
            tools={props.toolSurface.planningTools}
            dotColor="bg-amber-500"
            disabledSet={disabledSet}
            pendingTool={pendingTool}
            onToggle={(tool) => void toggleTool(tool)}
            hint="Disabling these breaks the guided planning workflow."
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
      </CardContent>
    </Card>
  );
}
