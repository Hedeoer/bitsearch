import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export type ToastTone = "success" | "error" | "warning" | "info";

export type ToastItem = {
  id: string;
  type: ToastTone;
  message: string;
};

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

type EmptyStateProps = {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function ConfirmDialog(props: ConfirmDialogProps) {
  return (
    <AlertDialog open={props.open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{props.title}</AlertDialogTitle>
          <AlertDialogDescription>{props.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel asChild>
            <Button variant="outline" onClick={props.onCancel}>
              {props.cancelLabel ?? "Cancel"}
            </Button>
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button
              disabled={props.pending}
              variant={props.danger ? "destructive" : "default"}
              onClick={props.onConfirm}
            >
              {props.pending ? <InlineSpinner label="Working" /> : null}
              {props.confirmLabel}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function LoadingOverlay({ label = "Loading" }: { label?: string }) {
  return (
    <div
      className="absolute inset-0 z-10 grid place-items-center rounded-[inherit] bg-background/60"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={label}
    >
      <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card px-3.5 py-2 text-xs font-medium text-muted-foreground shadow-xs">
        <Loader2 className="size-3.5 animate-spin text-primary" aria-hidden="true" />
        {label}
      </span>
    </div>
  );
}

export function InlineSpinner({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5" aria-live="polite">
      <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
      {label ? <span>{label}</span> : null}
    </span>
  );
}

export function EmptyState(props: EmptyStateProps) {
  return (
    <section className="grid place-items-center gap-2 rounded-xl border border-border/60 bg-muted/20 px-6 py-10 text-center">
      <h4 className="m-0 text-lg font-semibold tracking-tight">{props.title}</h4>
      <p className="m-0 max-w-md text-sm text-muted-foreground">{props.description}</p>
      {props.actionLabel && props.onAction ? (
        <Button type="button" variant="secondary" onClick={props.onAction}>
          {props.actionLabel}
        </Button>
      ) : null}
    </section>
  );
}
