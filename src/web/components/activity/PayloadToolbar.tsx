import { Copy, WrapText } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

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
        <Button
          className="size-8 rounded-lg"
          onClick={props.onToggleWrap}
          aria-label={props.wordWrap ? "Disable word wrap" : "Enable word wrap"}
          size="icon"
          type="button"
          variant="ghost"
        >
          <WrapText size={14} className={props.wordWrap ? "text-primary" : ""} />
        </Button>
        <Button
          className="relative size-8 rounded-lg"
          onClick={handleCopy}
          aria-label="Copy to clipboard"
          disabled={!props.payloadContent}
          size="icon"
          type="button"
          variant="ghost"
        >
          <Copy size={14} />
          {copied ? <span className="activity-payload-toolbar-copied">✓</span> : null}
        </Button>
      </div>
    </div>
  );
}
