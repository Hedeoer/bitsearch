import { InlineSpinner } from "../Feedback";

type ProbeModelsDialogProps = Readonly<{
  error: string;
  loading: boolean;
  models: string[];
  onClose: () => void;
  onRetry: () => void;
  onSelect: (model: string) => void;
  open: boolean;
}>;

export function ProbeModelsDialog(props: ProbeModelsDialogProps) {
  if (!props.open) {
    return null;
  }

  return (
    <div className="dialog-backdrop" role="presentation" onClick={props.onClose}>
      <section
        className="dialog-card w-full max-w-[640px]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="provider-probe-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="eyebrow">search_engine</div>
        <h3 id="provider-probe-title">Detected models</h3>
        <p className="supporting">
          Probe checks the current staged Base URL, timeout, API format, and API key settings, then
          lists detected models without saving changes.
        </p>
        <div className="mt-4 grid gap-3">
          {props.loading ? (
            <div className="grid min-h-[120px] place-items-center rounded-[18px] border border-white/8 bg-[color:var(--ui-card-soft)] p-4">
              <InlineSpinner label="Probing models" />
            </div>
          ) : null}
          {!props.loading && props.error ? (
            <div className="warning-banner">{props.error}</div>
          ) : null}
          {!props.loading && !props.error && props.models.length === 0 ? (
            <div className="grid min-h-[120px] place-items-center rounded-[18px] border border-white/8 bg-[color:var(--ui-card-soft)] p-4">
              <p className="supporting">Probe completed, but no models were returned.</p>
            </div>
          ) : null}
          {!props.loading && props.models.length > 0 ? (
            <div className="grid max-h-[320px] gap-2 overflow-y-auto" role="listbox" aria-label="Detected models">
              {props.models.map((model) => (
                <button
                  key={model}
                  className="min-h-11 w-full rounded-[16px] border border-white/8 bg-[color:var(--ui-card-soft)] px-4 py-3 text-left text-sm text-[color:var(--text)] transition hover:border-cyan-300/30 hover:bg-cyan-400/10"
                  type="button"
                  onClick={() => props.onSelect(model)}
                >
                  {model}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <div className="dialog-actions">
          <button
            className="secondary-button"
            disabled={props.loading}
            type="button"
            onClick={props.onRetry}
          >
            Probe again
          </button>
          <button className="primary-button" type="button" onClick={props.onClose}>
            Close
          </button>
        </div>
      </section>
    </div>
  );
}
