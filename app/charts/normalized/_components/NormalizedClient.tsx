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
  ReferenceLine,
} from "recharts";
import type { DailyTotalRow } from "@/types/app-db.types";
import type { NormChartPoint } from "@/lib/logic/chartsLogic";
import { calcNormChartPoints } from "@/lib/logic/chartsLogic";
import { cn } from "@/lib/utils";
import { ChartTooltip } from "@/components/common/ChartTooltip";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const DATE_RANGE_OPTIONS = [14, 30, 60, 90] as const;
type DateRange = (typeof DATE_RANGE_OPTIONS)[number];

const METRIC_COLOR = {
  adRevenue: "#6366f1",
  vimp: "#10b981",
  mfr: "#ef4444",
} as const;

const METRIC_LABEL = {
  adRevenue: "Rev.",
  vimp: "vIMP",
  mfr: "MFR",
} as const;

type MetricKey = keyof typeof METRIC_COLOR;
const ALL_METRICS: MetricKey[] = ["adRevenue", "vimp", "mfr"];

// ---------------------------------------------------------------------------
// Tooltip
// ---------------------------------------------------------------------------

interface NormTooltipProps {
  active?: boolean;
  payload?: Array<{ dataKey?: string; value: number | null; color?: string }>;
  label?: string;
  activeMetrics: MetricKey[];
}

function NormTooltip({ active, payload, label, activeMetrics }: NormTooltipProps) {
  if (!active || !payload?.length) return null;

  const items = activeMetrics
    .map((m) => {
      const entry = payload.find((p) => p.dataKey === m);
      if (!entry || entry.value == null) return null;
      return {
        color: METRIC_COLOR[m],
        label: METRIC_LABEL[m],
        value: `${entry.value.toFixed(1)}`,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  return <ChartTooltip title={label} items={items} />;
}

// ---------------------------------------------------------------------------
// NormalizedClient
// ---------------------------------------------------------------------------

interface NormalizedClientProps {
  totalData: DailyTotalRow[];
}

/**
 * Normalized analytics view.
 *
 * Maps Ad Revenue, vIMP, and MFR each to a 0–100 scale using min-max normalization
 * so their trend directions can be visually compared on a single chart.
 * No Y-axis values are shown since the scale is dimensionless.
 */
export default function NormalizedClient({ totalData }: NormalizedClientProps) {
  const [dateRange, setDateRange] = useState<DateRange>(30);
  const [activeMetrics, setActiveMetrics] = useState<Set<MetricKey>>(
    new Set(ALL_METRICS),
  );

  function toggleMetric(m: MetricKey) {
    setActiveMetrics((prev) => {
      if (prev.size === 1 && prev.has(m)) return prev; // keep at least one
      const next = new Set(prev);
      if (next.has(m)) next.delete(m);
      else next.add(m);
      return next;
    });
  }

  const points: NormChartPoint[] = useMemo(
    () => calcNormChartPoints(totalData, dateRange),
    [totalData, dateRange],
  );

  return (
    <div className="flex flex-col gap-4 px-6 pb-8">
      {/* Controls */}
      <div className="flex items-center gap-6 py-2">
        {/* Date range */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 font-medium">기간</span>
          <div className="flex rounded-lg overflow-hidden border border-gray-200 text-xs font-semibold">
            {DATE_RANGE_OPTIONS.map((d) => (
              <button
                key={d}
                onClick={() => setDateRange(d)}
                className={cn(
                  "px-3 py-1.5 transition-colors",
                  dateRange === d
                    ? "bg-blue-600 text-white"
                    : "bg-white text-gray-600 hover:bg-gray-50",
                )}
              >
                {d}D
              </button>
            ))}
          </div>
        </div>

        {/* Metric toggles */}
        <div className="flex items-center gap-3">
          {ALL_METRICS.map((m) => {
            const active = activeMetrics.has(m);
            return (
              <button
                key={m}
                onClick={() => toggleMetric(m)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all",
                  active
                    ? "border-transparent text-white shadow-sm"
                    : "border-gray-200 bg-white text-gray-400",
                )}
                style={active ? { backgroundColor: METRIC_COLOR[m] } : {}}
              >
                {METRIC_LABEL[m]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="mb-4">
          <h3 className="text-xl font-bold text-gray-700">Normalized Trends</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            각 지표를 0–100으로 정규화하여 트렌드 방향을 비교합니다
          </p>
        </div>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={points}
              margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: "#94a3b8" }}
                tickLine={false}
                axisLine={{ stroke: "#e2e8f0" }}
              />
              {/* Y-axis: 0–100 scale, label only — no raw values */}
              <YAxis
                domain={[0, 100]}
                ticks={[0, 25, 50, 75, 100]}
                tickFormatter={(v: number) => `${v}`}
                tick={{ fontSize: 10, fill: "#94a3b8" }}
                tickLine={false}
                axisLine={false}
                width={32}
              />
              {/* Midpoint reference line */}
              <ReferenceLine
                y={50}
                stroke="#e2e8f0"
                strokeDasharray="6 3"
                strokeWidth={1}
              />
              <Tooltip
                content={
                  <NormTooltip
                    activeMetrics={Array.from(activeMetrics)}
                  />
                }
              />
              {ALL_METRICS.filter((m) => activeMetrics.has(m)).map((m) => (
                <Line
                  key={m}
                  type="monotone"
                  dataKey={m}
                  stroke={METRIC_COLOR[m]}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: METRIC_COLOR[m] }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-gray-100">
          {ALL_METRICS.map((m) => (
            <div
              key={m}
              className={cn(
                "flex items-center gap-2 text-xs transition-opacity",
                activeMetrics.has(m) ? "opacity-100" : "opacity-30",
              )}
            >
              <span
                className="w-6 h-0.5 rounded-full inline-block"
                style={{ backgroundColor: METRIC_COLOR[m] }}
              />
              <span className="text-gray-600 font-medium">{METRIC_LABEL[m]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
