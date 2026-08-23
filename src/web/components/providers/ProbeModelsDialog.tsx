import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
  return (
    <Dialog
      open={props.open}
      onOpenChange={(open) => {
        if (!open) props.onClose();
      }}
    >
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>Detected models</DialogTitle>
          <DialogDescription>
            Probe checks the current staged Base URL, timeout, API format, and API key settings,
            then lists detected models without saving changes.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          {props.loading ? (
            <div className="grid min-h-[120px] place-items-center rounded-lg border bg-muted/40 p-4">
              <InlineSpinner label="Probing models" />
            </div>
          ) : null}

          {!props.loading && props.error ? (
            <p className="text-destructive text-sm">{props.error}</p>
          ) : null}

          {!props.loading && !props.error && props.models.length === 0 ? (
            <div className="grid min-h-[120px] place-items-center rounded-lg border bg-muted/40 p-4">
              <p className="text-muted-foreground text-sm">
                Probe completed, but no models were returned.
              </p>
            </div>
          ) : null}

          {!props.loading && props.models.length > 0 ? (
            <div
              className="grid max-h-[320px] gap-2 overflow-y-auto"
              role="listbox"
              aria-label="Detected models"
            >
              {props.models.map((model) => (
                <Button
                  key={model}
                  variant="outline"
                  className="h-11 w-full justify-start px-4 text-left"
                  type="button"
                  onClick={() => props.onSelect(model)}
                >
                  {model}
                </Button>
              ))}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            disabled={props.loading}
            type="button"
            onClick={props.onRetry}
          >
            Probe again
          </Button>
          <Button type="button" onClick={props.onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
