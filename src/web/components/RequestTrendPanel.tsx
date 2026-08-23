import type { DashboardTrendPoint } from "@shared/contracts";
import { Activity, CheckCircle2, XCircle } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatNumber } from "../format";
import { LoadingOverlay } from "./Feedback";

const SUCCESS_COLOR = "var(--success)";
const DANGER_COLOR = "var(--destructive)";
const GRID_COLOR = "color-mix(in oklab, var(--border) 60%, transparent)";
const AXIS_COLOR = "var(--muted-foreground)";
const DOT_STROKE = "var(--card)";

type RequestTrendPanelProps = Readonly<{
  loading: boolean;
  trend: DashboardTrendPoint[];
}>;

type ChartDatum = {
  label: string;
  success: number;
  failed: number;
};

function formatHourLabel(bucketStart: string): string {
  const date = new Date(bucketStart);
  if (Number.isNaN(date.getTime())) {
    return "--:--";
  }
  return date.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function toChartData(trend: DashboardTrendPoint[]): ChartDatum[] {
  return trend.map((point) => ({
    label: formatHourLabel(point.bucketStart),
    success: point.successCount,
    failed: point.failedCount,
  }));
}

function CustomTooltip(props: Readonly<{
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}>) {
  if (!props.active || !props.payload?.length) {
    return null;
  }
  return (
    <div className="rounded-2xl border border-border/70 bg-popover px-4 py-3 text-xs shadow-lg">
      <div className="font-mono text-[11px] text-muted-foreground">
        {props.label}
      </div>
      <div className="mt-2 grid gap-2">
        {props.payload.map((entry) => (
          <div key={entry.name} className="flex items-center gap-2">
            <span
              className="size-2 rounded-full"
              style={{ background: entry.color }}
            />
            <span>{entry.name === "success" ? "Successful" : "Failed"}:</span>
            <strong>{formatNumber(entry.value)}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function TrendChart(props: Readonly<{ trend: DashboardTrendPoint[] }>) {
  if (props.trend.length === 0) {
    return (
      <div className="grid min-h-[280px] place-items-center text-center text-muted-foreground">
        <div className="grid gap-3">
          <Activity className="mx-auto size-8" />
          <span>No traffic has been recorded in the last 24 hours.</span>
        </div>
      </div>
    );
  }

  const data = toChartData(props.trend);

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid stroke={GRID_COLOR} strokeDasharray="" vertical={false} />
        <XAxis
          axisLine={false}
          dataKey="label"
          interval={3}
          tick={{ fill: AXIS_COLOR, fontSize: 12, fontFamily: "var(--font-mono)" }}
          tickLine={false}
        />
        <YAxis
          allowDecimals={false}
          axisLine={false}
          tick={{ fill: AXIS_COLOR, fontSize: 12, fontFamily: "var(--font-mono)" }}
          tickFormatter={(value: number) => formatNumber(value)}
          tickLine={false}
          width={40}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ stroke: GRID_COLOR, strokeWidth: 1 }} />
        <Line
          activeDot={{ r: 5 }}
          dataKey="success"
          dot={{ r: 3.5, fill: SUCCESS_COLOR, stroke: DOT_STROKE, strokeWidth: 2 }}
          isAnimationActive={false}
          stroke={SUCCESS_COLOR}
          strokeWidth={2.5}
          type="linear"
        />
        <Line
          activeDot={{ r: 5 }}
          dataKey="failed"
          dot={{ r: 3.5, fill: DANGER_COLOR, stroke: DOT_STROKE, strokeWidth: 2 }}
          isAnimationActive={false}
          stroke={DANGER_COLOR}
          strokeWidth={2.5}
          type="linear"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function RequestTrendPanel(props: RequestTrendPanelProps) {
  return (
    <Card className="relative min-w-0">
      {props.loading ? <LoadingOverlay label="Refreshing request trend" /> : null}
      <CardHeader className="pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Traffic</p>
            <CardTitle className="mt-2">24h request trend</CardTitle>
            <CardDescription className="mt-2">
              Hourly buckets keep the chart readable while still surfacing drift and failure bursts.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="neutral">
              <Activity className="size-3.5" />
              hourly
            </Badge>
            <Badge variant="success">
              <CheckCircle2 className="size-3.5" />
              success
            </Badge>
            <Badge variant="danger">
              <XCircle className="size-3.5" />
              failed
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-[22px] border border-border/70 bg-muted/20 p-4">
          <TrendChart trend={props.trend} />
        </div>
      </CardContent>
    </Card>
  );
}
