import type { DashboardTrendPoint } from "@shared/contracts";
import { Activity, CheckCircle, XCircle } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatNumber } from "../format";
import { LoadingOverlay } from "./Feedback";

const SUCCESS_COLOR = "#40e56c";
const DANGER_COLOR = "#ff8e7d";
const GRID_COLOR = "rgba(132, 147, 150, 0.14)";
const AXIS_COLOR = "#7a8898";

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
  if (!props.active || !props.payload?.length) return null;
  return (
    <div className="trend-tooltip">
      <span className="trend-tooltip-label">{props.label}</span>
      {props.payload.map((entry) => (
        <div key={entry.name} className="trend-tooltip-row">
          <span className="trend-tooltip-dot" style={{ background: entry.color }} />
          <span>{entry.name === "success" ? "Successful" : "Failed"}:</span>
          <strong>{formatNumber(entry.value)}</strong>
        </div>
      ))}
    </div>
  );
}

function TrendChart(props: Readonly<{ trend: DashboardTrendPoint[] }>) {
  if (props.trend.length === 0) {
    return (
      <div className="trend-chart-empty">
        <Activity size={28} />
        <span>No data in the last 24 hours</span>
      </div>
    );
  }

  const data = toChartData(props.trend);

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid stroke={GRID_COLOR} strokeDasharray="" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: AXIS_COLOR, fontSize: 12, fontFamily: "IBM Plex Mono, monospace" }}
          tickLine={false}
          axisLine={false}
          interval={3}
        />
        <YAxis
          tick={{ fill: AXIS_COLOR, fontSize: 12, fontFamily: "IBM Plex Mono, monospace" }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => formatNumber(v)}
          width={40}
          allowDecimals={false}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ stroke: GRID_COLOR, strokeWidth: 1 }} />
        <Line
          type="linear"
          dataKey="success"
          stroke={SUCCESS_COLOR}
          strokeWidth={2.5}
          dot={{ r: 3.5, fill: SUCCESS_COLOR, stroke: "rgba(10,14,20,0.94)", strokeWidth: 2 }}
          activeDot={{ r: 5 }}
          isAnimationActive={false}
        />
        <Line
          type="linear"
          dataKey="failed"
          stroke={DANGER_COLOR}
          strokeWidth={2.5}
          dot={{ r: 3.5, fill: DANGER_COLOR, stroke: "rgba(10,14,20,0.94)", strokeWidth: 2 }}
          activeDot={{ r: 5 }}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function RequestTrendPanel(props: RequestTrendPanelProps) {
  return (
    <article className="surface-card page-panel">
      {props.loading ? <LoadingOverlay label="Refreshing request trend" /> : null}
      <div className="page-panel-header">
        <div>
          <div className="eyebrow">Traffic</div>
          <h3>24h Request Trend</h3>
        </div>
        <div className="trend-legend">
          <span className="chip neutral-chip">
            <Activity size={12} />
            Hourly buckets
          </span>
          <span className="chip success-chip">
            <CheckCircle size={12} />
            Successful
          </span>
          <span className="chip danger">
            <XCircle size={12} />
            Failed
          </span>
        </div>
      </div>
      <div className="trend-chart-shell">
        <TrendChart trend={props.trend} />
      </div>
    </article>
  );
}
