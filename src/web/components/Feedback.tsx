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

export function ToastViewport(props: ToastViewportProps) {
  if (props.items.length === 0) {
    return null;
  }
  return (
    <aside className="toast-viewport" aria-live="polite" aria-atomic="true">
      {props.items.map((item) => (
        <section key={item.id} className={`toast-card toast-${item.type}`}>
          <p>{item.message}</p>
          <button
            className="text-button"
            type="button"
            onClick={() => props.onDismiss(item.id)}
          >
            Close
          </button>
        </section>
      ))}
    </aside>
  );
}

export function ConfirmDialog(props: ConfirmDialogProps) {
  if (!props.open) {
    return null;
  }
  return (
    <div className="dialog-backdrop" role="presentation" onClick={props.onCancel}>
      <section
        className="dialog-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="eyebrow">Confirm action</div>
        <h3 id="confirm-dialog-title">{props.title}</h3>
        <p className="supporting">{props.description}</p>
        <div className="dialog-actions">
          <button className="secondary-button" type="button" onClick={props.onCancel}>
            {props.cancelLabel ?? "Cancel"}
          </button>
          <button
            className={props.danger ? "danger-button" : "primary-button"}
            disabled={props.pending}
            type="button"
            onClick={props.onConfirm}
          >
            {props.pending ? <InlineSpinner label="Working" /> : null}
            {props.confirmLabel}
          </button>
        </div>
      </section>
    </div>
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
    <section className="empty-state">
      <div className="eyebrow">Empty state</div>
      <h4>{props.title}</h4>
      <p className="supporting">{props.description}</p>
      {props.actionLabel && props.onAction ? (
        <button className="secondary-button" type="button" onClick={props.onAction}>
          {props.actionLabel}
        </button>
      ) : null}
    </section>
  );
}
