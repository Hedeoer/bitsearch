import type { DashboardTrendPoint } from "@shared/contracts";
import { Activity, CheckCircle, XCircle } from "lucide-react";
import { formatNumber } from "../format";
import { LoadingOverlay } from "./Feedback";

const SVG_WIDTH = 760;
const SVG_HEIGHT = 280;
const PADDING_TOP = 24;
const PADDING_RIGHT = 18;
const PADDING_BOTTOM = 30;
const PADDING_LEFT = 44;
const HOUR_LABEL_STEP = 4;

type RequestTrendPanelProps = Readonly<{
  loading: boolean;
  trend: DashboardTrendPoint[];
}>;

type ChartPoint = {
  x: number;
  successY: number;
  failedY: number;
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

function getTickValues(maxValue: number): number[] {
  if (maxValue <= 0) {
    return [0];
  }
  const values = new Set([0, Math.ceil(maxValue / 2), maxValue]);
  return [...values].sort((left, right) => left - right);
}

function toY(value: number, maxValue: number, plotHeight: number): number {
  if (maxValue <= 0) {
    return PADDING_TOP + plotHeight;
  }
  return PADDING_TOP + ((maxValue - value) / maxValue) * plotHeight;
}

function buildPoints(trend: DashboardTrendPoint[], maxValue: number): ChartPoint[] {
  const plotWidth = SVG_WIDTH - PADDING_LEFT - PADDING_RIGHT;
  const plotHeight = SVG_HEIGHT - PADDING_TOP - PADDING_BOTTOM;
  const xStep = trend.length > 1 ? plotWidth / (trend.length - 1) : 0;
  return trend.map((point, index) => ({
    x: PADDING_LEFT + index * xStep,
    successY: toY(point.successCount, maxValue, plotHeight),
    failedY: toY(point.failedCount, maxValue, plotHeight),
  }));
}

function buildPath(points: ChartPoint[], key: "successY" | "failedY"): string {
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point[key]}`)
    .join(" ");
}

function renderXAxisLabels(trend: DashboardTrendPoint[]) {
  const lastIndex = trend.length - 1;
  const plotWidth = SVG_WIDTH - PADDING_LEFT - PADDING_RIGHT;
  const xStep = trend.length > 1 ? plotWidth / (trend.length - 1) : 0;
  return trend.map((point, index) => {
    if (index !== lastIndex && index % HOUR_LABEL_STEP !== 0) {
      return null;
    }
    const x = PADDING_LEFT + index * xStep;
    return (
      <text key={point.bucketStart} x={x} y={SVG_HEIGHT - 8} className="trend-axis-label">
        {formatHourLabel(point.bucketStart)}
      </text>
    );
  });
}

function renderChart(trend: DashboardTrendPoint[]) {
  const maxValue = Math.max(
    0,
    ...trend.map((point) => Math.max(point.successCount, point.failedCount)),
  );
  if (maxValue === 0) {
    return <div className="trend-chart-empty">No requests recorded in the last 24 hours.</div>;
  }

  const plotWidth = SVG_WIDTH - PADDING_LEFT - PADDING_RIGHT;
  const plotHeight = SVG_HEIGHT - PADDING_TOP - PADDING_BOTTOM;
  const points = buildPoints(trend, maxValue);
  const tickValues = getTickValues(maxValue);

  return (
    <svg
      viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
      className="trend-chart-svg"
      role="img"
      aria-label="24 hour request trend"
      preserveAspectRatio="none"
    >
      {tickValues.map((tick) => {
        const y = toY(tick, maxValue, plotHeight);
        return (
          <g key={tick}>
            <line x1={PADDING_LEFT} y1={y} x2={PADDING_LEFT + plotWidth} y2={y} className="trend-grid-line" />
            <text x={PADDING_LEFT - 10} y={y + 4} className="trend-axis-label trend-axis-label--y">
              {formatNumber(tick)}
            </text>
          </g>
        );
      })}
      <path d={buildPath(points, "successY")} className="trend-line trend-line--success" />
      <path d={buildPath(points, "failedY")} className="trend-line trend-line--failed" />
      {points.map((point, index) => (
        <g key={trend[index].bucketStart}>
          <circle cx={point.x} cy={point.successY} r="3.5" className="trend-point trend-point--success" />
          <circle cx={point.x} cy={point.failedY} r="3.5" className="trend-point trend-point--failed" />
        </g>
      ))}
      {renderXAxisLabels(trend)}
    </svg>
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
      <div className="trend-chart-shell">{renderChart(props.trend)}</div>
    </article>
  );
}
