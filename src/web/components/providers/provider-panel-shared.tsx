import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import type { ProviderConfigRecord } from "@shared/contracts";
import { KeyRound } from "lucide-react";

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
    <button
      className={`provider-switch${props.checked ? " provider-switch-on" : ""}`}
      disabled={props.disabled}
      role="switch"
      type="button"
      aria-checked={props.checked}
      onClick={props.onToggle}
    >
      <span className="provider-switch-track">
        <span className="provider-switch-thumb" />
      </span>
      <span className="provider-switch-text">{props.checked ? "Enabled" : "Disabled"}</span>
    </button>
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
    <div className="rounded-[22px] border border-white/8 bg-[color:var(--ui-card-soft)] p-4">
      <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--text-dim)]">
        {props.title}
      </div>
      {props.description ? (
        <p className="mt-1 text-xs leading-5 text-[color:var(--text-soft)]">{props.description}</p>
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
