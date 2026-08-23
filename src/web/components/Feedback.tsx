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

export type ToastTone = "success" | "error" | "warning" | "info";

export type ToastItem = {
  id: string;
  type: ToastTone;
  message: string;
};

type ToastViewportProps = {
  items: ToastItem[];
  onDismiss: (id: string) => void;
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
    <div className="loading-overlay" aria-label={label} aria-busy="true">
      <div className="loading-bar" />
      <div className="loading-bar short" />
      <div className="loading-bar" />
    </div>
  );
}

export function InlineSpinner({ label }: { label: string }) {
  return (
    <span className="inline-spinner-wrap" aria-live="polite">
      <span className="inline-spinner" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}

export function EmptyState(props: EmptyStateProps) {
  return (
    <section className="grid place-items-center gap-2 rounded-2xl border border-border/60 bg-muted/20 px-6 py-10 text-center">
      <p className="m-0 text-xs font-semibold uppercase tracking-[0.16em] text-primary">Empty state</p>
      <h4 className="m-0 mt-1 text-lg font-semibold tracking-tight">{props.title}</h4>
      <p className="m-0 max-w-md text-sm text-muted-foreground">{props.description}</p>
      {props.actionLabel && props.onAction ? (
        <Button type="button" variant="secondary" onClick={props.onAction}>
          {props.actionLabel}
        </Button>
      ) : null}
    </section>
  );
}
