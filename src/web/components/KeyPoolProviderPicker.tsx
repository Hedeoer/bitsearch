import type { KeyPoolProvider } from "@shared/contracts";
import { Check, ChevronsUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const PROVIDER_OPTIONS: ReadonlyArray<KeyPoolProvider> = ["tavily", "firecrawl"];

function formatProviderLabel(provider: KeyPoolProvider): string {
  return provider === "tavily" ? "Tavily" : "Firecrawl";
}

type KeyPoolProviderPickerProps = Readonly<{
  onChange: (provider: KeyPoolProvider) => void;
  value: KeyPoolProvider;
}>;

export function KeyPoolProviderPicker(props: KeyPoolProviderPickerProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          aria-haspopup="listbox"
          className="justify-between"
          role="combobox"
          type="button"
          variant="outline"
        >
          <span>{formatProviderLabel(props.value)}</span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[180px] p-1" role="listbox">
        {PROVIDER_OPTIONS.map((provider) => (
          <Button
            key={provider}
            aria-selected={provider === props.value}
            className="w-full justify-start gap-2 px-3 py-2 font-normal"
            role="option"
            type="button"
            variant={provider === props.value ? "secondary" : "ghost"}
            onClick={() => props.onChange(provider)}
          >
            <Check
              className={`size-4 ${provider === props.value ? "opacity-100" : "opacity-0"}`}
            />
            {formatProviderLabel(provider)}
          </Button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
