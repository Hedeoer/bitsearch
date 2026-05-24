import type { RemoteProvider, ProviderConfigRecord } from "@shared/contracts";
import type { ProviderDraft } from "../../types";
import type { ProviderSaveErrors } from "../../provider-actions";

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
    return <span className="text-xs text-amber-400">Saving...</span>;
  }
  if (props.hasError) {
    return <span className="text-xs text-red-400">Error</span>;
  }
  if (props.isDirty) {
    return <span className="text-xs text-amber-400">Unsaved</span>;
  }
  if (props.draft.enabled) {
    return <span className="text-xs text-emerald-400">✓ Ready</span>;
  }
  return <span className="text-xs text-[color:var(--text-dim)]">Disabled</span>;
}

export function ProviderMasterCard(props: ProviderMasterCardProps) {
  const isCore = props.provider === "search_engine";

  return (
    <button
      type="button"
      onClick={props.onClick}
      className={`
        w-full rounded-[16px] border p-3 text-left transition-all
        ${props.isSelected
          ? "border-cyan-400/40 bg-cyan-400/10"
          : "border-white/8 bg-white/4 hover:border-white/16 hover:bg-white/6"
        }
        ${isCore ? "border-l-4 border-l-cyan-400" : ""}
      `}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-mono text-sm font-medium">
              {props.provider}
            </span>
            {isCore && (
              <span className="rounded-full bg-cyan-400/20 px-2 py-0.5 text-[10px] font-medium text-cyan-300">
                Core
              </span>
            )}
          </div>
          <div className="mt-1 text-xs text-[color:var(--text-dim)]">
            {props.provider === "search_engine" ? "Search Layer" : "Provider Runtime"}
          </div>
        </div>
        {getStatusBadge(props)}
      </div>

      {props.draft.enabled && (
        <div className="mt-2 text-xs text-[color:var(--text-soft)]">
          {props.provider === "search_engine"
            ? `${props.draft.apiKey ? "API key saved" : "No key"}`
            : `${props.providerRecord.keyCount} key(s)`
          }
        </div>
      )}
    </button>
  );
}
