"use client";

import { memo, useMemo } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  YAxis,
  Tooltip,
} from "recharts";
import { cn } from "@/lib/utils";
import { ChartTooltip } from "@/components/common/ChartTooltip";
import {
  MA_METRIC_COLORS,
  MA_METRIC_LABELS,
  MA_METRIC_FORMATTERS,
  formatGapPct,
  type MaMetricType,
  type MaChartDataPoint,
} from "@/lib/logic/maChartLogic";

interface MaMidChartRowProps {
  midChartsData: Array<{
    metric: MaMetricType;
    data: MaChartDataPoint[];
  }>;
  primaryMetric: MaMetricType;
  onMetricSwap: (metric: MaMetricType) => void;
}

/**
 * 4-column row of medium-sized MA charts for non-primary metrics.
 * Clicking a card swaps that metric with the big chart.
 */
export default function MaMidChartRow({
  midChartsData,
  primaryMetric,
  onMetricSwap,
}: MaMidChartRowProps) {
  return (
    <div className="grid grid-cols-4 gap-3">
      {midChartsData.map(({ metric, data }) => (
        <MaMidCard
          key={metric}
          metric={metric}
          data={data}
          onSwap={() => onMetricSwap(metric)}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Single mid-chart card
// ---------------------------------------------------------------------------

interface MaMidCardProps {
  metric: MaMetricType;
  data: MaChartDataPoint[];
  onSwap: () => void;
}

function MidTooltipContent({
  active,
  payload,
  metricColor,
  metricLabel,
  fmtVal,
}: {
  active?: boolean;
  payload?: Array<{ dataKey?: string; value: unknown; payload?: { label?: string } }>;
  metricColor: string;
  metricLabel: string;
  fmtVal: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  const actual = payload.find((p) => p.dataKey === "actual");
  const ma = payload.find((p) => p.dataKey === "ma");
  const actualVal = actual?.value as number | null;
  const maVal = ma?.value as number | null;

  const gap =
    actualVal != null && maVal != null && maVal !== 0
      ? ((actualVal - maVal) / maVal) * 100
      : null;

  const items = [];
  if (actualVal != null) {
    items.push({ color: metricColor, label: metricLabel, value: fmtVal(actualVal) });
  }
  if (maVal != null) {
    items.push({ color: "#64748B", label: "MA", value: fmtVal(maVal) });
  }
  if (gap != null) {
    items.push({ color: "#94A3B8", label: "GAP", value: formatGapPct(gap) });
  }
  return <ChartTooltip title={actual?.payload?.label} items={items} />;
}

const MaMidCard = memo(function MaMidCard({
  metric,
  data,
  onSwap,
}: MaMidCardProps) {
  const metricColor = MA_METRIC_COLORS[metric];
  const metricLabel = MA_METRIC_LABELS[metric];
  const fmtVal = MA_METRIC_FORMATTERS[metric];

  const latestActual = data.length > 0
    ? data[data.length - 1]?.actual ?? null
    : null;

  const yDomain = useMemo((): [number, number] => {
    const values = data
      .flatMap((p) => [p.actual, p.ma])
      .filter((v): v is number => v != null && isFinite(v));
    if (values.length === 0) return [0, 1];
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;
    const pad = range > 0 ? range * 0.15 : Math.max(Math.abs(max) * 0.1, 1);
    return [Math.max(0, min - pad), max + pad];
  }, [data]);

  return (
    <button
      onClick={onSwap}
      className={cn(
        "flex flex-col rounded-xl border p-3 text-left transition-all cursor-pointer",
        "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm",
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: metricColor }}
          />
          <span className="text-xs font-semibold text-gray-600">
            {metricLabel}
          </span>
        </div>
        <span className="text-xs font-bold tabular-nums text-gray-800">
          {latestActual != null ? fmtVal(latestActual) : "-"}
        </span>
      </div>

      {/* Chart */}
      <div className="h-[160px] w-full">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <LineChart
            data={data}
            margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
          >
            <YAxis domain={yDomain} hide />
            <Tooltip
              content={
                <MidTooltipContent
                  metricColor={metricColor}
                  metricLabel={metricLabel}
                  fmtVal={fmtVal}
                />
              }
            />
            <Line
              type="monotone"
              dataKey="actual"
              stroke={metricColor}
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 5 }}
              isAnimationActive={false}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="ma"
              stroke="#64748B"
              strokeWidth={1}
              strokeDasharray="4 4"
              dot={false}
              activeDot={{ r: 5 }}
              isAnimationActive={false}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </button>
  );
});
