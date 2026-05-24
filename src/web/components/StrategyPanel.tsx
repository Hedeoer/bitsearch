import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoadingOverlay } from "./Feedback";
import { StrategyAccessTab } from "./strategy/StrategyAccessTab";
import { StrategyRoutingTab } from "./strategy/StrategyRoutingTab";
import type { StrategyPanelProps } from "./strategy/strategy-types";

export function StrategyPanel(props: StrategyPanelProps) {
  return (
    <Card className="relative min-w-0">
      {props.loading ? <LoadingOverlay label="Refreshing controls" /> : null}
      <CardHeader className="pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="eyebrow">Configuration</div>
            <CardTitle className="mt-2">Configuration & Access</CardTitle>
            <CardDescription className="mt-2 max-w-xl">
              Edit routing and manage access without repeating the overview state.
            </CardDescription>
          </div>
          <Badge variant="neutral">controls</Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        <Tabs defaultValue="routing">
          <TabsList>
            <TabsTrigger value="routing">Routing</TabsTrigger>
            <TabsTrigger value="access">Access</TabsTrigger>
          </TabsList>
          <TabsContent value="routing">
            <StrategyRoutingTab {...props} />
          </TabsContent>
          <TabsContent value="access">
            <StrategyAccessTab
              adminAccess={props.adminAccess}
              loading={props.loading}
              mcpAccess={props.mcpAccess}
              onSaveAdminAccess={props.onSaveAdminAccess}
              onSaveMcpAccess={props.onSaveMcpAccess}
              onToast={props.onToast}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
