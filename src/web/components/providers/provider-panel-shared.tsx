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
    <label className="flex items-center gap-2 text-xs text-muted-foreground">
      <Switch
        aria-checked={props.checked}
        checked={props.checked}
        className="data-[size=default]:h-5 data-[size=default]:w-9"
        disabled={props.disabled}
        onCheckedChange={props.onToggle}
      />
      {props.checked ? "Enabled" : "Disabled"}
    </label>
  );
}

export function PanelBadges(props: Readonly<{
  dirty: boolean;
  keyCount: number;
}>) {
  return (
    <div className="flex flex-wrap gap-2">
      <Badge variant="neutral">
        <KeyRound className="size-3.5" />
        {props.keyCount} keys
      </Badge>
      {props.dirty ? <Badge variant="warning">unsaved</Badge> : null}
    </div>
  );
}

export function FieldShell(props: Readonly<{
  children: ReactNode;
  description?: string;
  title: string;
}>) {
  return (
    <div className="rounded-lg border border-border/70 bg-muted/20 p-4">
      <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {props.title}
      </div>
      {props.description ? (
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{props.description}</p>
      ) : null}
      <div className="mt-3">{props.children}</div>
    </div>
  );
}

export function parseTimeoutMs(value: string, fallback: number) {
  const nextValue = Number(value);
  if (!Number.isFinite(nextValue) || nextValue < 0) {
    return fallback;
  }
  return Math.trunc(nextValue);
}
