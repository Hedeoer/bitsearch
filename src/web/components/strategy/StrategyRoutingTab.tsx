import { useEffect } from "react";
import { Save } from "lucide-react";
import type { KeyPoolProvider, SystemSettings } from "@shared/contracts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { StrategyPanelProps } from "./strategy-types";

function getSecondaryProvider(primary: KeyPoolProvider): KeyPoolProvider {
  return primary === "tavily" ? "firecrawl" : "tavily";
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

      <div className="flex justify-end">
        <Button disabled={props.loading} type="button" onClick={props.onSave}>
          <Save size={14} />
          Save Routing
        </Button>
      </div>
    </div>
  );
}
