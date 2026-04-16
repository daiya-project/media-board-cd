"use client";

import { useState, useMemo } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import type { BoardChartPoint, BoardTrendItem } from "@/types/app-db.types";
import type { TrendMetric, PeriodType } from "@/lib/logic/boardLogic";
import { cn } from "@/lib/utils";
import { ChartTooltip } from "@/components/common/ChartTooltip";
import TrendList from "./TrendList";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

/** Primary line colors by metric. */
const CHART_COLOR: Record<TrendMetric, string> = {
  adRevenue: "#6366f1",
  vimp: "#10b981",
  mfr: "#ef4444",
};

/** Short display labels for the overlay checkboxes. */
const METRIC_LABEL: Record<TrendMetric, string> = {
  adRevenue: "Rev.",
  vimp: "vIMP",
  mfr: "MFR",
};

const ALL_METRICS: TrendMetric[] = ["adRevenue", "vimp", "mfr"];

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

/**
 * Formats an X-axis label based on period type.
 * - daily: YYYY-MM-DD → MM/DD
 * - weekly/monthly: label is already formatted (e.g. "M/D~M/D", "M월")
 */
function fmtDateLabel(label: string, periodType: PeriodType): string {
  if (periodType === "daily") {
    return label.slice(5).replace("-", "/");
  }
  return label; // weekly ("M/D~M/D") and monthly ("M월") are pre-formatted
}

function fmtYAxis(metric: TrendMetric) {
  return (value: number): string => {
    if (metric === "mfr") return `${value.toFixed(0)}%`;
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
    return `${value}`;
  };
}

function fmtTooltipValue(metric: TrendMetric) {
  return (value: number): string => {
    if (metric === "mfr") return `${value.toFixed(2)}%`;
    return Math.round(value).toLocaleString("ko-KR");
  };
}

// ---------------------------------------------------------------------------
// Board Tooltip
// Wraps ChartTooltip; filters out overlay_* payload entries (normalized values).
// ---------------------------------------------------------------------------

interface BoardTooltipProps {
  active?: boolean;
  payload?: Array<{ dataKey?: string; value: number }>;
  label?: string;
  metric: TrendMetric;
  metricLabel: string;
}

function BoardTooltip({
  active,
  payload,
  label,
  metric,
  metricLabel,
}: BoardTooltipProps) {
  if (!active || !payload?.length) return null;
  // Exclude overlay_* entries — their values are normalized and not meaningful
  const primary = payload.find(
    (p) => p.dataKey && !String(p.dataKey).startsWith("overlay_"),
  );
  if (!primary) return null;
  return (
    <ChartTooltip
      title={label}
      items={[
        {
          color: CHART_COLOR[metric],
          label: metricLabel,
          value: fmtTooltipValue(metric)(primary.value),
        },
      ]}
    />
  );
}

// ---------------------------------------------------------------------------
// BoardChart
// ---------------------------------------------------------------------------

interface BoardChartProps {
  title: string;
  metric: TrendMetric;
  metricLabel: string;
  /** dataKey inside BoardChartPoint that this chart plots */
  dataKey: keyof Pick<BoardChartPoint, "adRevenue" | "vimp" | "mfr">;
  chartPoints: BoardChartPoint[];
  trendItems: BoardTrendItem[];
  direction: "up" | "down";
  onDirectionChange: (d: "up" | "down") => void;
  selectedServiceId: string | null;
  selectedServiceName: string | null;
  onServiceSelect: (id: string | null) => void;
  periodType: PeriodType;
}

/**
 * Single chart panel: Recharts LineChart + overlay checkboxes + TrendList.
 *
 * Displays time-series for one of the three Board metrics (Ad Revenue, vIMP, MFR).
 * Additional metrics can be overlaid via checkboxes; their values are normalized
 * to the primary Y-axis domain so the trend shape is visible without a second axis.
 *
 * @param title             - Panel title
 * @param metric            - Metric key for color / formatting
 * @param metricLabel       - Human-readable metric name for tooltip
 * @param dataKey           - Field on BoardChartPoint to plot
 * @param chartPoints       - Aggregated time-series data (oldest → newest)
 * @param trendItems        - Trend list items from calcTrendList()
 * @param direction         - UP or DOWN tab state
 * @param onDirectionChange - Switch UP/DOWN direction
 * @param selectedServiceId - Currently highlighted service, or null
 * @param onServiceSelect   - Toggle service selection
 */
export default function BoardChart({
  title,
  metric,
  metricLabel,
  dataKey,
  chartPoints,
  trendItems,
  direction,
  onDirectionChange,
  selectedServiceId,
  selectedServiceName,
  onServiceSelect,
  periodType,
}: BoardChartProps) {
  const color = CHART_COLOR[metric];
  const fmtY = fmtYAxis(metric);

  // Overlay metric toggle state (the primary metric is always excluded)
  const [activeOverlays, setActiveOverlays] = useState<Set<TrendMetric>>(
    new Set(),
  );

  function toggleOverlay(m: TrendMetric) {
    setActiveOverlays((prev) => {
      const next = new Set(prev);
      if (next.has(m)) next.delete(m);
      else next.add(m);
      return next;
    });
  }

  // Y-axis domain: add ±60% padding so the line sits near vertical center
  const yDomain = useMemo((): [number, number] => {
    const values = chartPoints
      .map((p) => Number(p[dataKey]))
      .filter((v) => isFinite(v) && v >= 0);

    if (values.length === 0) return [0, 1];

    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;

    // Flat line fallback: use 15% of the value (or 1) as padding
    const padding = range > 0 ? range * 0.6 : Math.max(max * 0.15, 1);

    return [Math.max(0, min - padding), max + padding];
  }, [chartPoints, dataKey]);

  // Merge normalized overlay values into the chart data array.
  // Each active overlay's values are mapped from its own [min, max] into
  // the primary Y-axis [yLow, yHigh] range so the trend shape is visible
  // without adding a secondary axis.
  const data = useMemo(() => {
    const [yLow, yHigh] = yDomain;
    const yRange = yHigh - yLow;

    // Pre-compute normalized arrays per overlay metric
    const normalized: Partial<Record<TrendMetric, number[]>> = {};
    for (const om of activeOverlays) {
      const raw = chartPoints.map((p) =>
        Number(p[om as keyof BoardChartPoint]),
      );
      const oMin = Math.min(...raw);
      const oMax = Math.max(...raw);
      const oRange = oMax - oMin;
      normalized[om] = raw.map((v) =>
        oRange === 0
          ? (yLow + yHigh) / 2
          : yLow + ((v - oMin) / oRange) * yRange,
      );
    }

    return chartPoints.map((p, i) => {
      const point: Record<string, unknown> = {
        ...p,
        label: fmtDateLabel(p.date, periodType),
      };
      for (const om of activeOverlays) {
        point[`overlay_${om}`] = normalized[om]![i];
      }
      return point;
    });
  }, [chartPoints, yDomain, activeOverlays, periodType]);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      {/* Layout: chart (left) + trend list (right) */}
      <div className="flex gap-6">
        {/* Chart column: title + chart stacked, fills trend list height */}
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            {/* Left: title + selected service badge */}
            <div className="flex items-center gap-3">
              <h3 className="text-xl font-bold text-gray-700">{title}</h3>
              {selectedServiceId && selectedServiceName && (
                <span className="inline-flex items-center gap-1.5 text-xs bg-blue-50 border border-blue-200 text-blue-700 rounded-full px-2.5 py-0.5">
                  {selectedServiceId}. {selectedServiceName}
                  <button
                    onClick={() => onServiceSelect(null)}
                    className="hover:text-blue-900 font-bold leading-none"
                  >
                    ✕
                  </button>
                </span>
              )}
            </div>
            {/* Right: overlay metric checkboxes */}
            <div className="flex items-center gap-4">
              {ALL_METRICS.map((m) => {
                const isCurrent = m === metric;
                const isChecked = isCurrent || activeOverlays.has(m);
                return (
                  <label
                    key={m}
                    className={cn(
                      "flex items-center gap-1.5 text-xs select-none",
                      isCurrent
                        ? "cursor-not-allowed text-gray-300"
                        : "cursor-pointer text-gray-800 hover:opacity-70",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      disabled={isCurrent}
                      onChange={() => !isCurrent && toggleOverlay(m)}
                      className="w-3 h-3 flex-shrink-0"
                      style={{
                        accentColor: isCurrent ? "#d1d5db" : CHART_COLOR[m],
                      }}
                    />
                    {METRIC_LABEL[m]}
                  </label>
                );
              })}
            </div>
          </div>
          <div className="flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={data}
                margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: "#94a3b8" }}
                  tickLine={false}
                  axisLine={{ stroke: "#e2e8f0" }}
                />
                <YAxis
                  domain={yDomain}
                  tickFormatter={fmtY}
                  tick={{ fontSize: 10, fill: "#94a3b8" }}
                  tickLine={false}
                  axisLine={false}
                  width={48}
                />
                <Tooltip
                  content={
                    <BoardTooltip metric={metric} metricLabel={metricLabel} />
                  }
                />
                {/* Primary metric line */}
                <Line
                  type="monotone"
                  dataKey={dataKey}
                  stroke={color}
                  strokeWidth={2}
                  dot={{ r: 3, fill: color, strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: color }}
                />
                {/* Overlay lines — normalized to primary Y-axis, no secondary axis */}
                {Array.from(activeOverlays).map((om) => (
                  <Line
                    key={`overlay_${om}`}
                    type="monotone"
                    dataKey={`overlay_${om}`}
                    stroke={CHART_COLOR[om]}
                    strokeWidth={1.5}
                    strokeDasharray="4 2"
                    dot={false}
                    activeDot={false}
                    legendType="none"
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Trend list */}
        <div className="w-[270px] flex-shrink-0">
          <TrendList
            items={trendItems}
            metric={metric}
            direction={direction}
            onDirectionChange={onDirectionChange}
            selectedServiceId={selectedServiceId}
            onServiceSelect={onServiceSelect}
          />
        </div>
      </div>
    </div>
  );
}
