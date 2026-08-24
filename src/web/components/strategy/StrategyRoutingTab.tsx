import { useEffect } from "react";
import { Save } from "lucide-react";
import type { KeyPoolProvider, SystemSettings } from "@shared/contracts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { StrategyPanelProps } from "./strategy-types";

const MAX_RESULT_BUDGET_CHARS = 1_000_000;
const MIN_RESULT_BUDGET_CHARS = 1_000;
const RESULT_BUDGET_STEP = 1_000;

type ResultBudget = SystemSettings["mcpResultBudget"];

function getSecondaryProvider(primary: KeyPoolProvider): KeyPoolProvider {
  return primary === "tavily" ? "firecrawl" : "tavily";
}

function parseBudgetChars(value: string, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(
    MAX_RESULT_BUDGET_CHARS,
    Math.max(MIN_RESULT_BUDGET_CHARS, Math.trunc(parsed)),
  );
}

function normalizeResultBudget(
  current: ResultBudget,
  patch: Partial<ResultBudget>,
): ResultBudget {
  const next = { ...current, ...patch };
  if (next.firstResponseChars > next.pageChars) {
    next.pageChars = next.firstResponseChars;
  }
  if (next.pageChars > next.hardResponseChars) {
    next.hardResponseChars = next.pageChars;
  }
  return next;
}

function selectRoutingOrder(
  current: SystemSettings,
  primary: KeyPoolProvider,
): KeyPoolProvider[] {
  if (current.genericRoutingMode === "single_provider") {
    return [primary];
  }
  return [primary, getSecondaryProvider(primary)];
}

export function StrategyRoutingTab(props: StrategyPanelProps) {
  const availableGenericProviders = props.toolSurface.providerCapabilities
    .filter((item) => item.genericAvailable)
    .map((item) => item.provider);
  const availableProvidersKey = availableGenericProviders.join(",");
  const selectedPrimary = props.system.genericProviderOrder[0] ?? "tavily";
  const canUseFailover = availableGenericProviders.length > 1;
  const resultBudget = props.system.mcpResultBudget;

  function updateResultBudget(patch: Partial<ResultBudget>) {
    props.setSystem((current) => ({
      ...current,
      mcpResultBudget: normalizeResultBudget(current.mcpResultBudget, patch),
    }));
  }

  useEffect(() => {
    if (availableGenericProviders.length !== 1) {
      return;
    }
    const onlyProvider = availableGenericProviders[0];
    if (
      props.system.genericRoutingMode === "single_provider" &&
      props.system.genericProviderOrder[0] === onlyProvider
    ) {
      return;
    }
    props.setSystem((current) => ({
      ...current,
      genericRoutingMode: "single_provider",
      genericProviderOrder: [onlyProvider],
    }));
  }, [
    availableProvidersKey,
    availableGenericProviders,
    props.setSystem,
    props.system.genericProviderOrder,
    props.system.genericRoutingMode,
  ]);

  return (
    <div className="grid gap-4">
      <div className="rounded-lg border border-border/70 bg-muted/20 p-4">
        <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Affected tools
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {props.toolSurface.genericRouting.affectedTools.map((tool) => (
            <Badge key={tool} variant="neutral">
              {tool}
            </Badge>
          ))}
        </div>
        {!canUseFailover ? (
          <div className="mt-3 text-sm text-muted-foreground">
            Only one provider is ready, so failover is currently locked.
          </div>
        ) : null}
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <div className="grid gap-2">
          <Label className="text-sm font-medium">Routing Mode</Label>
          <Select
            disabled={props.loading}
            value={props.system.genericRoutingMode}
            onValueChange={(value) => {
              const nextMode = value as SystemSettings["genericRoutingMode"];
              props.setSystem((current) => ({
                ...current,
                genericRoutingMode: nextMode,
                genericProviderOrder:
                  nextMode === "single_provider"
                    ? [current.genericProviderOrder[0] ?? "tavily"]
                    : [
                        current.genericProviderOrder[0] ?? "tavily",
                        getSecondaryProvider(current.genericProviderOrder[0] ?? "tavily"),
                      ],
              }));
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select routing mode" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="single_provider">single_provider</SelectItem>
              <SelectItem disabled={!canUseFailover} value="ordered_failover">
                ordered_failover
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label className="text-sm font-medium">Primary Provider</Label>
          <Select
            disabled={props.loading}
            value={selectedPrimary}
            onValueChange={(value) => {
              const primary = value as KeyPoolProvider;
              props.setSystem((current) => ({
                ...current,
                genericProviderOrder: selectRoutingOrder(current, primary),
              }));
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select primary provider" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="tavily">tavily</SelectItem>
              <SelectItem value="firecrawl">firecrawl</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-2">
        <Label className="text-sm font-medium">Fallback Provider</Label>
        <Input
          disabled
          readOnly
          value={
            props.system.genericRoutingMode === "ordered_failover"
              ? props.system.genericProviderOrder[1] ?? getSecondaryProvider(selectedPrimary)
              : "not used"
          }
        />
      </div>

      <div className="rounded-lg border border-border/70 bg-muted/20 p-4">
        <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          MCP result budget
        </div>
        <div className="mt-3 grid gap-3 xl:grid-cols-3">
          <div className="grid gap-2">
            <Label className="text-sm font-medium">First Response Chars</Label>
            <Input
              className="font-mono"
              disabled={props.loading}
              inputMode="numeric"
              max={MAX_RESULT_BUDGET_CHARS}
              min={MIN_RESULT_BUDGET_CHARS}
              step={RESULT_BUDGET_STEP}
              type="number"
              value={resultBudget.firstResponseChars}
              onChange={(event) =>
                updateResultBudget({
                  firstResponseChars: parseBudgetChars(
                    event.target.value,
                    resultBudget.firstResponseChars,
                  ),
                })
              }
            />
            <p className="text-muted-foreground text-xs">Initial preview size.</p>
          </div>

          <div className="grid gap-2">
            <Label className="text-sm font-medium">Page Chars</Label>
            <Input
              className="font-mono"
              disabled={props.loading}
              inputMode="numeric"
              max={MAX_RESULT_BUDGET_CHARS}
              min={MIN_RESULT_BUDGET_CHARS}
              step={RESULT_BUDGET_STEP}
              type="number"
              value={resultBudget.pageChars}
              onChange={(event) =>
                updateResultBudget({
                  pageChars: parseBudgetChars(event.target.value, resultBudget.pageChars),
                })
              }
            />
            <p className="text-muted-foreground text-xs">Follow-up page size.</p>
          </div>

          <div className="grid gap-2">
            <Label className="text-sm font-medium">Hard Response Chars</Label>
            <Input
              className="font-mono"
              disabled={props.loading}
              inputMode="numeric"
              max={MAX_RESULT_BUDGET_CHARS}
              min={MIN_RESULT_BUDGET_CHARS}
              step={RESULT_BUDGET_STEP}
              type="number"
              value={resultBudget.hardResponseChars}
              onChange={(event) =>
                updateResultBudget({
                  hardResponseChars: parseBudgetChars(
                    event.target.value,
                    resultBudget.hardResponseChars,
                  ),
                })
              }
            />
            <p className="text-xs text-muted-foreground">Absolute response cap.</p>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button disabled={props.loading} type="button" onClick={props.onSave}>
          <Save size={14} />
          Save Routing
        </Button>
      </div>
    </div>
  );
}
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
