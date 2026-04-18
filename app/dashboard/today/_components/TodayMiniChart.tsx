"use client";

import { memo } from "react";
import {
  ComposedChart,
  Line,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";
import type {
  MetricKey,
  SeriesData,
} from "@/lib/features/dashboard-today/aggregate";
import {
  COMPARISON_LINE_COLORS,
  getMetricConfig,
} from "./today-chart-constants";

interface Props {
  metric: MetricKey;
  series: SeriesData;
  onClick: () => void;
}

interface Row {
  h: number;
  today: number | null;
  projected: number | null;
  yesterday: number;
  pastAvg: number;
}

function buildRows(series: SeriesData): Row[] {
  const out: Row[] = [];
  for (let h = 0; h < 24; h++) {
    out.push({
      h,
      today: series.today[h] ?? null,
      projected: series.projectedToday[h] ?? null,
      yesterday: series.yesterday[h],
      pastAvg: series.pastWeekdayAvg[h],
    });
  }
  return out;
}

/** 2x2 미니 차트. 클릭 시 onClick → 큰 차트와 metric 스왑. */
export const TodayMiniChart = memo(function TodayMiniChart({
  metric,
  series,
  onClick,
}: Props) {
  const cfg = getMetricConfig(metric);
  const data = buildRows(series);

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${cfg.label} 차트로 전환`}
      className={cn(
        "group flex h-full w-full flex-col overflow-hidden rounded-lg border border-gray-200 bg-white p-3 text-left shadow-sm transition-shadow",
        "hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
      )}
    >
      <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-gray-600">
        <span
          aria-hidden
          className="inline-block size-2 rounded-full"
          style={{ backgroundColor: cfg.color }}
        />
        {cfg.label}
      </div>
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 2, right: 4, bottom: 0, left: 4 }}>
            <XAxis dataKey="h" hide />
            <YAxis hide />
            <Line
              type="monotone"
              dataKey="pastAvg"
              stroke={COMPARISON_LINE_COLORS.pastWeekdayAvg}
              strokeOpacity={0.85}
              strokeWidth={0.7}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="yesterday"
              stroke={COMPARISON_LINE_COLORS.yesterday}
              strokeOpacity={0.9}
              strokeWidth={0.7}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="today"
              stroke={COMPARISON_LINE_COLORS.today}
              strokeWidth={1.6}
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
            {cfg.projection && (
              <Line
                type="monotone"
                dataKey="projected"
                stroke={COMPARISON_LINE_COLORS.today}
                strokeDasharray="3 3"
                strokeWidth={1.25}
                dot={false}
                connectNulls={true}
                isAnimationActive={false}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </button>
  );
});
