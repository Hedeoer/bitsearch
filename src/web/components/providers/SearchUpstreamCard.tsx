import { useState } from "react";
import type { SearchUpstreamMode, SystemSettings } from "@shared/contracts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "../../api";
import type { ToastTone } from "../Feedback";

const MODE_LABELS: Record<SearchUpstreamMode, string> = {
  llm_first: "LLM first, then Tavily",
  llm_only: "LLM only",
  tavily_first: "Tavily first, then LLM",
  tavily_only: "Tavily only",
};

type SearchUpstreamCardProps = Readonly<{
  mode: SearchUpstreamMode;
  loading: boolean;
  onSaved: (mode: SearchUpstreamMode) => void;
  onToast: (type: ToastTone, message: string) => void;
}>;

export function SearchUpstreamCard({ mode, loading, onSaved, onToast }: SearchUpstreamCardProps) {
  const [draft, setDraft] = useState(mode);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const busy = loading || saving;

  async function save() {
    setSaving(true);
    setError("");
    try {
      const response = await apiRequest<Pick<SystemSettings, "searchUpstreamMode">>(
        "PUT", "/admin/search-upstream", { searchUpstreamMode: draft },
      );
      if (!response.ok) throw new Error(response.message);
      onSaved(response.data.searchUpstreamMode);
      onToast("success", "Search upstream saved. New searches use this routing immediately.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save search upstream. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Search Upstream</CardTitle>
        <CardDescription>
          Choose the answer upstream for web_search. First modes switch to the other
          upstream on failure or no usable answer. Extra-source routing is configured separately.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-2 sm:max-w-md">
          <Label htmlFor="search-upstream-mode">Upstream mode</Label>
          <Select value={draft} disabled={busy} onValueChange={(value) => setDraft(value as SearchUpstreamMode)}>
            <SelectTrigger id="search-upstream-mode" className="w-full" aria-describedby="search-upstream-help">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(MODE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p id="search-upstream-help" className="text-sm text-muted-foreground">
          Tavily requires an enabled provider and API keys in its pool. It uses advanced
          search, up to 5 results and a 60-second timeout per request. Saving here changes only the search mode.
        </p>
        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" disabled={busy || draft === mode} onClick={() => { setDraft(mode); setError(""); }}>
            Reset
          </Button>
          <Button type="button" disabled={busy || draft === mode} onClick={() => void save()}>
            {saving ? "Saving..." : "Save Search Upstream"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
