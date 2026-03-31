import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingOverlay } from "../Feedback";

export function ProviderSkeletonPanel() {
  return (
    <Card className="relative min-h-[320px] min-w-0">
      <LoadingOverlay label="Loading provider" />
      <CardHeader>
        <div className="eyebrow">Provider</div>
        <CardTitle>Loading...</CardTitle>
      </CardHeader>
    </Card>
  );
}
