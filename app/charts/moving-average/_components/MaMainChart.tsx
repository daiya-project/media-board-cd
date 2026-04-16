"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { ChartTooltip } from "@/components/common/ChartTooltip";
import {
  MA_METRIC_COLORS,
  MA_METRIC_LABELS,
  MA_YAXIS_FORMATTERS,
  MA_METRIC_FORMATTERS,
  formatGapPct,
  type MaMetricType,
  type MaChartDataPoint,
  type MaWindow,
} from "@/lib/logic/maChartLogic";

interface MaMainChartProps {
  data: MaChartDataPoint[];
  metric: MaMetricType;
  maWindow: MaWindow;
  holidaySet: Set<string>;
}

/**
 * Main MA chart with red/blue area bands showing actual vs MA divergence.
 * Uses Recharts ComposedChart with Area + Line elements.
 */
export default function MaMainChart({
  data,
  metric,
  maWindow,
  holidaySet,
}: MaMainChartProps) {
  const metricColor = MA_METRIC_COLORS[metric];
  const metricLabel = MA_METRIC_LABELS[metric];
  const fmtY = MA_YAXIS_FORMATTERS[metric];
  const fmtVal = MA_METRIC_FORMATTERS[metric];

  // Y-axis domain with padding
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

  // Custom X-axis tick: holidays in red
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderTick = useMemo(() => {
    return function CustomTick(props: any) {
      const { x, y, payload } = props;
      const date = data.find((d: MaChartDataPoint) => d.label === payload?.value)?.date;
      const isHoliday = date ? holidaySet.has(date) : false;
      return (
        <text
          x={Number(x)}
          y={Number(y) + 12}
          textAnchor="middle"
          fontSize={10}
          fill={isHoliday ? "#ef4444" : "#94a3b8"}
        >
          {payload?.value}
        </text>
      );
    };
  }, [data, holidaySet]);

  // Custom tooltip
  function CustomTooltipContent({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: Array<{ dataKey?: string; value: unknown }>;
  }) {
    if (!active || !payload?.length) return null;

    const actualEntry = payload.find((p) => p.dataKey === "actual");
    const maEntry = payload.find((p) => p.dataKey === "ma");
    const actualVal = actualEntry?.value as number | null;
    const maVal = maEntry?.value as number | null;

    const gap =
      actualVal != null && maVal != null && maVal !== 0
        ? ((actualVal - maVal) / maVal) * 100
        : null;

    const items = [];
    if (actualVal != null) {
      items.push({
        color: metricColor,
        label: metricLabel,
        value: fmtVal(actualVal),
      });
    }
    if (maVal != null) {
      items.push({
        color: "#64748B",
        label: `${metricLabel} MA`,
        value: fmtVal(maVal),
      });
    }
    if (gap != null) {
      items.push({
        color: "#94A3B8",
        label: "GAP",
        value: formatGapPct(gap),
      });
    }

    const pointDate = data.find(
      (d) =>
        d.actual === actualVal ||
        (actualVal == null && d.ma === maVal),
    );

    return <ChartTooltip title={pointDate?.label} items={items} />;
  }

  // Legend formatter
  function legendFormatter(value: string) {
    if (value === "actual") return metricLabel;
    if (value === "ma") return `${metricLabel} MA`;
    return value;
  }

  return (
    <div className="h-[440px]">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={data}
          margin={{ top: 20, right: 35, left: 4, bottom: 10 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />

          {/* Red band: actual > MA (hidden from legend) */}
          <Area
            type="monotone"
            dataKey="redBand"
            fill="rgba(239, 68, 68, 0.18)"
            stroke="none"
            isAnimationActive={false}
            connectNulls
            legendType="none"
          />
          {/* Blue band: actual < MA (hidden from legend) */}
          <Area
            type="monotone"
            dataKey="blueBand"
            fill="rgba(59, 130, 246, 0.18)"
            stroke="none"
            isAnimationActive={false}
            connectNulls
            legendType="none"
          />

          <XAxis
            dataKey="label"
            tick={renderTick}
            tickLine={false}
            axisLine={{ stroke: "#e2e8f0" }}
            interval={data.length > 60 ? Math.floor(data.length / 30) : 0}
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
            content={<CustomTooltipContent />}
          />

          <Legend
            verticalAlign="top"
            align="center"
            formatter={legendFormatter}
            wrapperStyle={{ fontSize: 12 }}
          />

          {/* Actual line */}
          <Line
            type="monotone"
            dataKey="actual"
            stroke={metricColor}
            strokeWidth={2}
            dot={false}
            connectNulls
            isAnimationActive={false}
          />
          {/* MA line (dashed) */}
          <Line
            type="monotone"
            dataKey="ma"
            stroke="#64748B"
            strokeWidth={2}
            strokeDasharray="4 4"
            dot={false}
            connectNulls
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
