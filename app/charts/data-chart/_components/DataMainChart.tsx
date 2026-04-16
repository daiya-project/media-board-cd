"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer,
  LineChart,
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
  type MaMetricType,
} from "@/lib/logic/maChartLogic";
import type { DataChartDataPoint } from "@/lib/logic/dataChartLogic";

interface DataMainChartProps {
  data: DataChartDataPoint[];
  metric: MaMetricType;
  secondaryMetric: MaMetricType | null;
  holidaySet: Set<string>;
}

/**
 * Main Data chart — LineChart showing raw actual values.
 * Optionally overlays a secondary metric line (dashed, same Y-axis).
 */
export default function DataMainChart({
  data,
  metric,
  secondaryMetric,
  holidaySet,
}: DataMainChartProps) {
  const metricColor = MA_METRIC_COLORS[metric];
  const metricLabel = MA_METRIC_LABELS[metric];
  const fmtY = MA_YAXIS_FORMATTERS[metric];
  const fmtVal = MA_METRIC_FORMATTERS[metric];

  const secondaryColor = secondaryMetric
    ? MA_METRIC_COLORS[secondaryMetric]
    : undefined;
  const secondaryLabel = secondaryMetric
    ? MA_METRIC_LABELS[secondaryMetric]
    : undefined;
  const fmtSecondary = secondaryMetric
    ? MA_METRIC_FORMATTERS[secondaryMetric]
    : undefined;

  // Primary Y-axis domain (actual only)
  const yDomain = useMemo((): [number, number] => {
    const values = data
      .map((p) => p.actual)
      .filter((v): v is number => v != null && isFinite(v));
    if (values.length === 0) return [0, 1];
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;
    const pad = range > 0 ? range * 0.15 : Math.max(Math.abs(max) * 0.1, 1);
    return [Math.max(0, min - pad), max + pad];
  }, [data]);

  // Secondary Y-axis domain (hidden, independent scale)
  const yDomainSecondary = useMemo((): [number, number] => {
    if (!secondaryMetric) return [0, 1];
    const values = data
      .map((p) => p.secondary)
      .filter((v): v is number => v != null && isFinite(v));
    if (values.length === 0) return [0, 1];
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;
    const pad = range > 0 ? range * 0.15 : Math.max(Math.abs(max) * 0.1, 1);
    return [Math.max(0, min - pad), max + pad];
  }, [data, secondaryMetric]);

  // Custom X-axis tick: holidays in red
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderTick = useMemo(() => {
    return function CustomTick(props: any) {
      const { x, y, payload } = props;
      const date = data.find(
        (d: DataChartDataPoint) => d.label === payload?.value,
      )?.date;
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

  // Custom tooltip — shows both primary and secondary metrics
  function CustomTooltipContent({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: Array<{
      dataKey?: string;
      value: unknown;
      payload?: { label?: string };
    }>;
  }) {
    if (!active || !payload?.length) return null;

    const actualEntry = payload.find((p) => p.dataKey === "actual");
    const actualVal = actualEntry?.value as number | null;

    const items = [];
    if (actualVal != null) {
      items.push({
        color: metricColor,
        label: metricLabel,
        value: fmtVal(actualVal),
      });
    }

    const secondaryEntry = payload.find((p) => p.dataKey === "secondary");
    const secondaryVal = secondaryEntry?.value as number | null;
    if (secondaryVal != null && secondaryColor && secondaryLabel && fmtSecondary) {
      items.push({
        color: secondaryColor,
        label: secondaryLabel,
        value: fmtSecondary(secondaryVal),
      });
    }

    return (
      <ChartTooltip title={actualEntry?.payload?.label} items={items} />
    );
  }

  // Legend formatter
  function legendFormatter(value: string) {
    if (value === "actual") return metricLabel;
    if (value === "secondary") return secondaryLabel ?? "";
    return value;
  }

  return (
    <div className="h-[440px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 20, right: 35, left: 4, bottom: 10 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />

          <XAxis
            dataKey="label"
            tick={renderTick}
            tickLine={false}
            axisLine={{ stroke: "#e2e8f0" }}
            interval={data.length > 60 ? Math.floor(data.length / 30) : 0}
          />
          <YAxis
            yAxisId="left"
            domain={yDomain}
            tickFormatter={fmtY}
            tick={{ fontSize: 10, fill: "#94a3b8" }}
            tickLine={false}
            axisLine={false}
            width={48}
          />
          {secondaryMetric && (
            <YAxis
              yAxisId="right"
              orientation="right"
              domain={yDomainSecondary}
              hide
            />
          )}

          <Tooltip content={<CustomTooltipContent />} />

          <Legend
            verticalAlign="top"
            align="center"
            formatter={legendFormatter}
            wrapperStyle={{ fontSize: 12 }}
          />

          {/* Primary actual line */}
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="actual"
            stroke={metricColor}
            strokeWidth={2}
            dot={false}
            connectNulls
            isAnimationActive={false}
          />

          {/* Secondary metric line (dashed, independent right Y-axis hidden) */}
          {secondaryMetric && (
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="secondary"
              stroke={secondaryColor}
              strokeWidth={2}
              strokeDasharray="4 4"
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
