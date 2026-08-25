import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import type { ProviderConfigRecord } from "@shared/contracts";
import { KeyRound } from "lucide-react";
import { Switch } from "@/components/ui/switch";

export type PanelProps = Readonly<{
  busy: boolean;
  dirty: boolean;
  error?: string;
  provider: ProviderConfigRecord;
}>;

export type ProviderSwitchProps = Readonly<{
  checked: boolean;
  disabled: boolean;
  onToggle: () => void;
}>;

export function ProviderSwitch(props: ProviderSwitchProps) {
  return (
    <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground cursor-pointer select-none">
      <Switch
        aria-checked={props.checked}
        checked={props.checked}
        className="data-[size=default]:h-5 data-[size=default]:w-9"
        disabled={props.disabled}
        onCheckedChange={props.onToggle}
      />
      <span className={props.checked ? "text-foreground" : "text-muted-foreground"}>
        {props.checked ? "Enabled" : "Disabled"}
      </span>
    </label>
  );
}

export function PanelBadges(props: Readonly<{
  dirty: boolean;
  keyCount: number;
}>) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="neutral">
        <KeyRound className="size-3.5" />
        <span className="font-mono tabular-nums">{props.keyCount}</span> keys
      </Badge>
      {props.dirty ? <Badge variant="warning">unsaved</Badge> : null}
    </div>
  );
}

export function FormField(props: Readonly<{
  children: ReactNode;
  description?: string;
  label: string;
  className?: string;
}>) {
  return (
    <div className={props.className ?? "space-y-1.5"}>
      <div className="flex flex-col gap-0.5">
        <label className="text-sm font-medium text-foreground">
          {props.label}
        </label>
        {props.description ? (
          <p className="text-xs text-muted-foreground leading-relaxed">
            {props.description}
          </p>
        ) : null}
      </div>
      <div className="pt-0.5">{props.children}</div>
    </div>
  );
}

/**
 * @deprecated Use FormField instead of FieldShell
 */
export const FieldShell = FormField;

export function parseTimeoutMs(value: string, fallback: number) {
  const nextValue = Number(value);
  if (!Number.isFinite(nextValue) || nextValue < 0) {
    return fallback;
  }
  return Math.trunc(nextValue);
}
