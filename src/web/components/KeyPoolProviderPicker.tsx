import { useEffect, useRef, useState } from "react";
import type { KeyPoolProvider } from "@shared/contracts";
import { ChevronDown } from "lucide-react";

const PROVIDER_OPTIONS: ReadonlyArray<KeyPoolProvider> = ["tavily", "firecrawl"];

function formatProviderLabel(provider: KeyPoolProvider): string {
  return provider === "tavily" ? "Tavily" : "Firecrawl";
}

type KeyPoolProviderPickerProps = Readonly<{
  onChange: (provider: KeyPoolProvider) => void;
  value: KeyPoolProvider;
}>;

export function KeyPoolProviderPicker(props: KeyPoolProviderPickerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  return (
    <div className="key-pool-provider-picker" ref={rootRef}>
      <button
        aria-expanded={open}
        aria-haspopup="listbox"
        className="key-pool-provider-picker-trigger"
        type="button"
        onClick={() => setOpen((current) => !current)}
      >
        <span className="key-pool-provider-picker-label">{formatProviderLabel(props.value)}</span>
        <ChevronDown className={open ? "search-model-picker-chevron-open" : ""} size={14} />
      </button>
      {open ? (
        <div
          className="search-model-picker-menu key-pool-provider-picker-menu"
          role="listbox"
          aria-label="Key pool provider"
        >
          {PROVIDER_OPTIONS.map((provider) => (
            <button
              key={provider}
              aria-selected={provider === props.value}
              className={`search-model-picker-option${provider === props.value ? " search-model-picker-option-active" : ""}`}
              role="option"
              type="button"
              onClick={() => {
                props.onChange(provider);
                setOpen(false);
              }}
            >
              {formatProviderLabel(provider)}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
