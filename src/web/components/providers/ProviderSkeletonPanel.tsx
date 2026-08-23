import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingOverlay } from "../Feedback";

export function ProviderSkeletonPanel() {
  return (
    <Card className="relative min-h-[320px] min-w-0">
      <LoadingOverlay label="Loading provider" />
      <CardHeader>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Provider</p>
        <CardTitle>Loading...</CardTitle>
      </CardHeader>
    </Card>
  );
}
