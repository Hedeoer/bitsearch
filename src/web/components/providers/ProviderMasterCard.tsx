import type { RemoteProvider, ProviderConfigRecord } from "@shared/contracts";
import type { ProviderDraft } from "../../types";
import { Badge } from "@/components/ui/badge";

type ProviderMasterCardProps = Readonly<{
  provider: RemoteProvider;
  providerRecord: ProviderConfigRecord;
  draft: ProviderDraft;
  isSelected: boolean;
  isDirty: boolean;
  hasError: boolean;
  isSaving: boolean;
  onClick: () => void;
}>;

function getStatusBadge(props: ProviderMasterCardProps) {
  if (props.isSaving) {
    return <Badge variant="warning">Saving...</Badge>;
  }
  if (props.hasError) {
    return <Badge variant="danger">Error</Badge>;
  }
  if (props.isDirty) {
    return <Badge variant="warning">Unsaved</Badge>;
  }
  if (props.draft.enabled) {
    return <Badge variant="success">Ready</Badge>;
  }
  return <Badge variant="neutral">Disabled</Badge>;
}

export function ProviderMasterCard(props: ProviderMasterCardProps) {
  const isCore = props.provider === "search_engine";

  return (
    <button
      type="button"
      onClick={props.onClick}
      className={`
        w-full rounded-lg border p-3 text-left transition-all
        ${props.isSelected
          ? "border-primary/40 bg-primary/10"
          : "border-border/70 bg-card hover:border-primary/25 hover:bg-accent/20"
        }
        ${isCore ? "border-primary/30" : ""}
      `}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-mono text-sm font-medium">
              {props.provider}
            </span>
            {isCore && (
              <Badge className="text-[10px]" variant="default">
                Core
              </Badge>
            )}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {props.provider === "search_engine" ? "Search Layer" : "Provider Runtime"}
          </div>
        </div>
        {getStatusBadge(props)}
      </div>

      {props.draft.enabled && (
        <div className="mt-2 text-xs text-muted-foreground">
          {props.provider === "search_engine"
            ? `${props.draft.apiKey ? "API key saved" : "No key"}`
            : `${props.providerRecord.keyCount} key(s)`
          }
        </div>
      )}
    </button>
  );
}
