import type { KeyPoolProvider, ProviderConfigRecord, KeyPoolSummary } from "@shared/contracts";
import { KEY_POOL_PROVIDERS } from "@shared/contracts";

type KeyPoolProviderPickerProps = Readonly<{
  onChange: (provider: KeyPoolProvider) => void;
  value: KeyPoolProvider;
  providers?: ProviderConfigRecord[];
  summary?: KeyPoolSummary | null;
}>;

export function KeyPoolProviderPicker(props: KeyPoolProviderPickerProps) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-border/60 bg-muted/40 p-1">
      {KEY_POOL_PROVIDERS.map((provider) => {
        const isSelected = provider === props.value;
        const providerRecord = props.providers?.find((p) => p.provider === provider);
        const count =
          providerRecord?.keyCount ??
          (props.summary?.provider === provider ? props.summary.totalKeys : undefined);

        return (
          <button
            key={provider}
            type="button"
            onClick={() => props.onChange(provider)}
            className={`
              flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all outline-none cursor-pointer
              ${isSelected
                ? "border border-border/80 bg-background text-foreground shadow-xs"
                : "border border-transparent text-muted-foreground hover:bg-background/40 hover:text-foreground"
              }
            `}
          >
            <span className={`size-2 rounded-full ${isSelected ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
            <span className="font-mono font-semibold">{provider}</span>
            {count !== undefined ? (
              <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                {count} keys
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
