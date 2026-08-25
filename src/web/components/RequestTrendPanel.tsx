import { useState } from "react";
import { Activity } from "lucide-react";
import type { DashboardTrendPoint, DashboardTrendRange, DashboardTrendSeries } from "@shared/contracts";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { formatNumber } from "../format";
import { LoadingOverlay } from "./Feedback";

const RANGE_OPTIONS: Array<{ value: DashboardTrendRange; label: string }> = [
  { value: "24h", label: "24h" },
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
];

const RANGE_DESCRIPTIONS: Record<DashboardTrendRange, string> = {
  "24h": "Hourly buckets for the last 24 hours.",
  "7d": "6-hour buckets for the last 7 days.",
  "30d": "Daily buckets for the last 30 days.",
};

const chartConfig = {
  success: { label: "Successful", color: "var(--success)" },
  failed: { label: "Failed", color: "var(--destructive)" },
} satisfies ChartConfig;

type RequestTrendPanelProps = Readonly<{
  loading: boolean;
  trend: DashboardTrendSeries | undefined;
}>;

type ChartDatum = {
  label: string;
  success: number;
  failed: number;
};

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function formatBucketLabel(bucketStart: string, range: DashboardTrendRange): string {
  const date = new Date(bucketStart);
  if (Number.isNaN(date.getTime())) {
    return "--";
  }
  const md = `${pad2(date.getMonth() + 1)}/${pad2(date.getDate())}`;
  if (range === "30d") {
    return md;
  }
  const hm = `${pad2(date.getHours())}:00`;
  return range === "7d" ? `${md} ${hm}` : `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function toChartData(points: DashboardTrendPoint[], range: DashboardTrendRange): ChartDatum[] {
  return points.map((point) => ({
    label: formatBucketLabel(point.bucketStart, range),
    success: point.successCount,
    failed: point.failedCount,
  }));
}

const X_AXIS_INTERVAL: Record<DashboardTrendRange, number> = {
  "24h": 3,
  "7d": 3,
  "30d": 4,
};

function TrendChart(props: Readonly<{ points: DashboardTrendPoint[]; range: DashboardTrendRange }>) {
  const data = toChartData(props.points, props.range);

  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-[320px] w-full">
      <AreaChart data={data} margin={{ top: 12, right: 12, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="fillSuccess" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-success)" stopOpacity={0.32} />
            <stop offset="95%" stopColor="var(--color-success)" stopOpacity={0.03} />
          </linearGradient>
          <linearGradient id="fillFailed" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-failed)" stopOpacity={0.32} />
            <stop offset="95%" stopColor="var(--color-failed)" stopOpacity={0.03} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="color-mix(in oklab, var(--border) 60%, transparent)" vertical={false} />
        <XAxis
          axisLine={false}
          dataKey="label"
          interval={X_AXIS_INTERVAL[props.range]}
          tick={{ fill: "var(--muted-foreground)", fontSize: 12, fontFamily: "var(--font-mono)" }}
          tickLine={false}
        />
        <YAxis
          allowDecimals={false}
          axisLine={false}
          tick={{ fill: "var(--muted-foreground)", fontSize: 12, fontFamily: "var(--font-mono)" }}
          tickFormatter={(value: number) => formatNumber(value)}
          tickLine={false}
          width={40}
        />
        <ChartTooltip
          cursor={{ stroke: "color-mix(in oklab, var(--border) 80%, transparent)", strokeWidth: 1 }}
          content={<ChartTooltipContent labelFormatter={(label) => label} />}
        />
        <Area
          dataKey="success"
          stroke="var(--color-success)"
          fill="url(#fillSuccess)"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
          isAnimationActive={false}
          type="monotone"
        />
        <Area
          dataKey="failed"
          stroke="var(--color-failed)"
          fill="url(#fillFailed)"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
          isAnimationActive={false}
          type="monotone"
        />
      </AreaChart>
    </ChartContainer>
  );
}

export function RequestTrendPanel(props: RequestTrendPanelProps) {
  const [range, setRange] = useState<DashboardTrendRange>("24h");
  const points = props.trend?.[range] ?? [];

  return (
    <Card className="relative min-w-0 shadow-glow">
      {props.loading ? <LoadingOverlay label="Refreshing request trend" /> : null}
      <CardHeader className="pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Request trend</CardTitle>
            <CardDescription className="mt-2">{RANGE_DESCRIPTIONS[range]}</CardDescription>
          </div>
          <ToggleGroup
            aria-label="Select trend time range"
            type="single"
            value={range}
            onValueChange={(value) => {
              if (value) {
                setRange(value as DashboardTrendRange);
              }
            }}
          >
            {RANGE_OPTIONS.map((option) => (
              <ToggleGroupItem key={option.value} value={option.value}>
                {option.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </CardHeader>
      <CardContent>
        {points.length === 0 ? (
          <div className="grid min-h-[280px] place-items-center text-center text-muted-foreground">
            <div className="grid gap-3">
              <Activity className="mx-auto size-8" />
              <span>No traffic has been recorded in this window.</span>
            </div>
          </div>
        ) : (
          <TrendChart points={points} range={range} />
        )}
      </CardContent>
    </Card>
  );
}
