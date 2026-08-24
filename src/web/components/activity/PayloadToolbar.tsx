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
    <div className="flex items-center justify-between border-b border-border/60 px-3.5 py-2.5">
      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{props.activeTab.toUpperCase()} PAYLOAD</span>
      <div className="flex items-center gap-1.5">
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
          {copied ? <span className="absolute -top-7 right-0 rounded-md bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground">✓</span> : null}
        </Button>
      </div>
    </div>
  );
}
