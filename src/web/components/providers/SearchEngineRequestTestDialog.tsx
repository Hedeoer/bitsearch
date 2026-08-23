import type { SearchEngineRequestTestResponse } from "@shared/contracts";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CircleCheck, CircleX } from "lucide-react";
import { InlineSpinner } from "../Feedback";

type SearchEngineRequestTestDialogProps = Readonly<{
  loading: boolean;
  onClose: () => void;
  onRetry: () => void;
  open: boolean;
  result: SearchEngineRequestTestResponse | null;
}>;

function StatusBadge({ success }: { success: boolean }) {
  return (
    <Badge variant={success ? "success" : "danger"} className="gap-1">
      {success ? <CircleCheck className="size-3" /> : <CircleX className="size-3" />}
      {success ? "Healthy" : "Failed"}
    </Badge>
  );
}

function ModelProbeCard({ result }: { result: SearchEngineRequestTestResponse }) {
  const probe = result.modelProbe;
  const listedLabel =
    probe.modelListed === null
      ? "Unknown"
      : probe.modelListed
        ? "Listed"
        : "Not listed";

  return (
    <section className="grid gap-2 rounded-lg border bg-muted/40 p-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <strong>Model probe diagnostics</strong>
        <StatusBadge success={probe.status === "success"} />
      </header>
      <p className="text-muted-foreground text-sm">Probe mode: {probe.probeMode}</p>
      <p className="text-muted-foreground text-sm">
        Returned models: {probe.modelsCount ?? "unknown"}
      </p>
      <p className="text-muted-foreground text-sm">{listedLabel}</p>
      {probe.message ? (
        <p className="text-muted-foreground text-sm">{probe.message}</p>
      ) : null}
    </section>
  );
}

export function SearchEngineRequestTestDialog(props: SearchEngineRequestTestDialogProps) {
  return (
    <Dialog
      open={props.open}
      onOpenChange={(open) => {
        if (!open) props.onClose();
      }}
    >
      <DialogContent className="sm:max-w-[720px]">
        <DialogHeader>
          <DialogTitle>Live request test</DialogTitle>
          <DialogDescription>
            Sends a real request with the current staged Base URL, API key, timeout, model, and API
            format. No settings are saved.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          {props.loading ? (
            <div className="grid min-h-[160px] place-items-center rounded-lg border bg-muted/40 p-4">
              <InlineSpinner label="Running live test" />
            </div>
          ) : null}

          {!props.loading && props.result ? (
            <>
              <section className="grid gap-3 rounded-lg border bg-muted/40 p-4">
                <header className="flex flex-wrap items-center justify-between gap-2">
                  <strong>
                    {props.result.status === "success"
                      ? "Request succeeded"
                      : "Request failed"}
                  </strong>
                  <span className="text-muted-foreground text-sm">
                    {props.result.model} · {props.result.apiFormat} ·{" "}
                    {props.result.durationMs} ms
                  </span>
                </header>
                {props.result.error ? (
                  <p className="text-destructive text-sm">{props.result.error}</p>
                ) : null}
                {props.result.statusCode !== null ? (
                  <p className="text-muted-foreground text-sm">
                    HTTP status: {props.result.statusCode}
                  </p>
                ) : null}
                {props.result.responsePreview ? (
                  <pre className="max-h-[220px] overflow-auto rounded-md border bg-background p-3 text-xs whitespace-pre-wrap">
                    {props.result.responsePreview}
                  </pre>
                ) : null}
              </section>
              <ModelProbeCard result={props.result} />
            </>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            disabled={props.loading}
            type="button"
            onClick={props.onRetry}
          >
            Run again
          </Button>
          <Button type="button" onClick={props.onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
