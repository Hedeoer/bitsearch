import type { SearchEngineRequestTestResponse } from "@shared/contracts";
import { InlineSpinner } from "../Feedback";

type SearchEngineRequestTestDialogProps = Readonly<{
  loading: boolean;
  onClose: () => void;
  onRetry: () => void;
  open: boolean;
  result: SearchEngineRequestTestResponse | null;
}>;

function renderModelProbe(result: SearchEngineRequestTestResponse) {
  const statusLabel = result.modelProbe.status === "success" ? "Healthy" : "Failed";
  const listedLabel =
    result.modelProbe.modelListed === null
      ? "Unknown"
      : result.modelProbe.modelListed
        ? "Listed"
        : "Not listed";

  return (
    <div className="grid gap-2 rounded-[18px] border border-white/8 bg-[color:var(--ui-card-soft)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <strong>/models diagnostics</strong>
        <span className="supporting compact">
          {statusLabel} · {listedLabel}
        </span>
      </div>
      <p className="supporting compact">
        Returned models: {result.modelProbe.modelsCount ?? "unknown"}
      </p>
      {result.modelProbe.message ? <p className="supporting compact">{result.modelProbe.message}</p> : null}
    </div>
  );
}

export function SearchEngineRequestTestDialog(props: SearchEngineRequestTestDialogProps) {
  if (!props.open) {
    return null;
  }

  return (
    <div className="dialog-backdrop" role="presentation" onClick={props.onClose}>
      <section
        className="dialog-card w-full max-w-[720px]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="search-engine-request-test-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="eyebrow">search_engine</div>
        <h3 id="search-engine-request-test-title">Live request test</h3>
        <p className="supporting">
          Sends a real `chat/completions` request with the current staged Base URL, API key,
          timeout, and model. No settings are saved.
        </p>
        <div className="mt-4 grid gap-3">
          {props.loading ? (
            <div className="grid min-h-[160px] place-items-center rounded-[18px] border border-white/8 bg-[color:var(--ui-card-soft)] p-4">
              <InlineSpinner label="Running live test" />
            </div>
          ) : null}
          {!props.loading && props.result ? (
            <>
              <div className="grid gap-2 rounded-[18px] border border-white/8 bg-[color:var(--ui-card-soft)] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <strong>
                    {props.result.status === "success" ? "Request succeeded" : "Request failed"}
                  </strong>
                  <span className="supporting compact">
                    {props.result.model} · {props.result.durationMs} ms
                  </span>
                </div>
                {props.result.error ? <div className="warning-banner">{props.result.error}</div> : null}
                {props.result.statusCode !== null ? (
                  <p className="supporting compact">HTTP status: {props.result.statusCode}</p>
                ) : null}
                {props.result.responsePreview ? (
                  <pre className="overflow-x-auto rounded-[16px] border border-white/8 bg-black/20 p-4 text-sm whitespace-pre-wrap">
                    {props.result.responsePreview}
                  </pre>
                ) : null}
              </div>
              {renderModelProbe(props.result)}
            </>
          ) : null}
        </div>
        <div className="dialog-actions">
          <button
            className="secondary-button"
            disabled={props.loading}
            type="button"
            onClick={props.onRetry}
          >
            Run again
          </button>
          <button className="primary-button" type="button" onClick={props.onClose}>
            Close
          </button>
        </div>
      </section>
    </div>
  );
}
