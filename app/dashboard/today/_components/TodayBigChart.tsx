"use client";

import { memo } from "react";
import {
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartTooltip } from "@/components/common/ChartTooltip";
import type {
  MetricKey,
  SeriesData,
} from "@/lib/features/dashboard-today/aggregate";
import {
  COMPARISON_LINE_COLORS,
  DASHBOARD_CHART_ANIMATION_DURATION,
  DASHBOARD_CHART_MARGIN,
  DASHBOARD_CHART_TICK_FONT_SIZE,
  formatKoreanAmount,
  formatMetricValue,
  getMetricConfig,
} from "./today-chart-constants";

interface Props {
  metric: MetricKey;
  series: SeriesData;
}

interface Row {
  h: number;
  label: string;
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
      label: `${String(h).padStart(2, "0")}시`,
      today: series.today[h] ?? null,
      projected: series.projectedToday[h] ?? null,
      yesterday: series.yesterday[h],
      pastAvg: series.pastWeekdayAvg[h],
    });
  }
  return out;
}

/**
 * 큰 차트 — 오늘 실선 + 예측 점선(누적 metric) + 전일 + 지난 평일 평균.
 */
export const TodayBigChart = memo(function TodayBigChart({
  metric,
  series,
}: Props) {
  const cfg = getMetricConfig(metric);
  const data = buildRows(series);
  const isLargeNumber = cfg.format === "integer";
  const yFormat = (v: number) =>
    isLargeNumber ? formatKoreanAmount(v) : formatMetricValue(v, cfg.format);

  return (
    <section className="flex h-full w-full flex-col rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="mb-4 flex items-center gap-2 text-base font-bold text-gray-700">
        <span
          aria-hidden
          className="inline-block size-2.5 rounded-full"
          style={{ backgroundColor: cfg.color }}
        />
        {cfg.label} · 시간대별 추이
      </h3>
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={DASHBOARD_CHART_MARGIN}>
            <XAxis
              dataKey="label"
              tick={{ fontSize: DASHBOARD_CHART_TICK_FONT_SIZE, fill: "#94a3b8" }}
              axisLine={false}
              tickLine={false}
              interval={2}
            />
            <YAxis
              tick={{ fontSize: DASHBOARD_CHART_TICK_FONT_SIZE, fill: "#94a3b8" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={yFormat}
              width={56}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const row = payload[0].payload as Row;
                const items = [
                  ...(row.today != null
                    ? [
                        {
                          color: COMPARISON_LINE_COLORS.today,
                          label: "오늘",
                          value: formatMetricValue(row.today, cfg.format),
                        },
                      ]
                    : []),
                  ...(row.projected != null && row.today == null
                    ? [
                        {
                          color: COMPARISON_LINE_COLORS.today,
                          label: "예측",
                          value: formatMetricValue(row.projected, cfg.format),
                        },
                      ]
                    : []),
                  {
                    color: COMPARISON_LINE_COLORS.yesterday,
                    label: "전일",
                    value: formatMetricValue(row.yesterday, cfg.format),
                  },
                  {
                    color: COMPARISON_LINE_COLORS.pastWeekdayAvg,
                    label: "지난 평일 평균",
                    value: formatMetricValue(row.pastAvg, cfg.format),
                  },
                ];
                return <ChartTooltip title={String(label)} items={items} />;
              }}
            />
            <Line
              type="monotone"
              dataKey="pastAvg"
              stroke={COMPARISON_LINE_COLORS.pastWeekdayAvg}
              strokeOpacity={0.9}
              strokeWidth={1}
              dot={false}
              animationDuration={DASHBOARD_CHART_ANIMATION_DURATION}
            />
            <Line
              type="monotone"
              dataKey="yesterday"
              stroke={COMPARISON_LINE_COLORS.yesterday}
              strokeOpacity={0.9}
              strokeWidth={1}
              dot={false}
              animationDuration={DASHBOARD_CHART_ANIMATION_DURATION}
            />
            <Line
              type="monotone"
              dataKey="today"
              stroke={COMPARISON_LINE_COLORS.today}
              strokeWidth={2.5}
              dot={false}
              connectNulls={false}
              animationDuration={DASHBOARD_CHART_ANIMATION_DURATION}
            />
            {cfg.projection && (
              <Line
                type="monotone"
                dataKey="projected"
                stroke={COMPARISON_LINE_COLORS.today}
                strokeDasharray="4 4"
                strokeWidth={1.5}
                dot={false}
                connectNulls={true}
                animationDuration={DASHBOARD_CHART_ANIMATION_DURATION}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
});
