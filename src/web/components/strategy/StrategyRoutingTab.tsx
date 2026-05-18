import { useEffect } from "react";
import { Save } from "lucide-react";
import type { KeyPoolProvider, SystemSettings } from "@shared/contracts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
      <div className="rounded-[20px] border border-white/8 bg-white/4 p-4">
        <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--text-dim)]">
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
          <div className="mt-3 text-sm text-[color:var(--text-soft)]">
            Only one provider is ready, so failover is currently locked.
          </div>
        ) : null}
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <label className="field">
          <span>Routing Mode</span>
          <select
            disabled={props.loading}
            value={props.system.genericRoutingMode}
            onChange={(event) => {
              const nextMode = event.target.value as SystemSettings["genericRoutingMode"];
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
            <option value="single_provider">single_provider</option>
            <option value="ordered_failover" disabled={!canUseFailover}>
              ordered_failover
            </option>
          </select>
        </label>

        <label className="field">
          <span>Primary Provider</span>
          <select
            disabled={props.loading}
            value={selectedPrimary}
            onChange={(event) => {
              const primary = event.target.value as KeyPoolProvider;
              props.setSystem((current) => ({
                ...current,
                genericProviderOrder: selectRoutingOrder(current, primary),
              }));
            }}
          >
            <option value="tavily">tavily</option>
            <option value="firecrawl">firecrawl</option>
          </select>
        </label>
      </div>

      <label className="field">
        <span>Fallback Provider</span>
        <input
          disabled
          readOnly
          value={
            props.system.genericRoutingMode === "ordered_failover"
              ? props.system.genericProviderOrder[1] ?? getSecondaryProvider(selectedPrimary)
              : "not used"
          }
        />
      </label>

      <div className="rounded-[20px] border border-white/8 bg-white/4 p-4">
        <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--text-dim)]">
          MCP result budget
        </div>
        <div className="mt-3 grid gap-3 xl:grid-cols-3">
          <label className="field">
            <span>First Response Chars</span>
            <input
              className="font-['IBM_Plex_Mono']"
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
            <p className="field-note">Initial preview size.</p>
          </label>

          <label className="field">
            <span>Page Chars</span>
            <input
              className="font-['IBM_Plex_Mono']"
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
            <p className="field-note">Follow-up page size.</p>
          </label>

          <label className="field">
            <span>Hard Response Chars</span>
            <input
              className="font-['IBM_Plex_Mono']"
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
            <p className="field-note">Absolute response cap.</p>
          </label>
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
