import { Copy, WrapText } from "lucide-react";
import { useState } from "react";

type PayloadToolbarProps = {
  activeTab: string;
  payloadContent: string | null | undefined;
  wordWrap: boolean;
  onToggleWrap: () => void;
};

export function PayloadToolbar(props: PayloadToolbarProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!props.payloadContent) return;
    
    try {
      await navigator.clipboard.writeText(props.payloadContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <div className="activity-payload-toolbar">
      <span className="eyebrow">{props.activeTab.toUpperCase()} PAYLOAD</span>
      <div className="activity-payload-toolbar-actions">
        <button
          className="icon-button activity-payload-toolbar-btn"
          onClick={props.onToggleWrap}
          title={props.wordWrap ? "Disable word wrap" : "Enable word wrap"}
          type="button"
        >
          <WrapText size={14} className={props.wordWrap ? "text-primary" : ""} />
        </button>
        <button
          className="icon-button activity-payload-toolbar-btn"
          onClick={handleCopy}
          title="Copy to clipboard"
          disabled={!props.payloadContent}
          type="button"
          style={{ position: "relative" }}
        >
          <Copy size={14} />
          {copied ? <span className="activity-payload-toolbar-copied">✓</span> : null}
        </button>
      </div>
    </div>
  );
}
