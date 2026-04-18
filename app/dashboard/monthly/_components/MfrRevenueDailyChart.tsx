"use client";

import { memo, useMemo } from "react";
import {
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartTooltip } from "@/components/common/ChartTooltip";
import type { DailyMfrRevenuePoint } from "@/lib/features/dashboard-monthly/aggregate";
import {
  DASHBOARD_CHART_ANIMATION_DURATION,
  DASHBOARD_CHART_MARGIN,
  DASHBOARD_CHART_TICK_FONT_SIZE,
} from "./monthly-helpers";

const TICK_DAYS = [5, 10, 15, 20, 25];
const REVENUE_COLOR = "#2563eb";
const MFR_COLOR = "oklch(0.769 0.188 70.08)";

interface Props {
  data: DailyMfrRevenuePoint[];
  monthLabel: string;
}

export const MfrRevenueDailyChart = memo(function MfrRevenueDailyChart({
  data,
  monthLabel,
}: Props) {
  // Ad Revenue 누적 변환 — null (미데이터) 인 day 는 그대로 null 유지
  const chartData = useMemo(() => {
    let cum = 0;
    return data.map((row) => {
      if (row.revenue === null) {
        return { ...row, revenueCumulative: null };
      }
      cum += row.revenue;
      return { ...row, revenueCumulative: cum };
    });
  }, [data]);

  const xTicks = (() => {
    const last = chartData.length;
    const days = [...TICK_DAYS, last].filter((d) => d <= last);
    return [...new Set(days)]
      .sort((a, b) => a - b)
      .map((d) => chartData[d - 1]?.label ?? "")
      .filter(Boolean);
  })();

  return (
    <section className="flex h-full w-full flex-col rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="mb-4 flex flex-wrap items-center gap-3 text-base font-bold text-gray-700">
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block size-2.5 rounded-full"
            style={{ backgroundColor: REVENUE_COLOR }}
          />
          Daily Chart · Ad Revenue
        </span>
        <span className="text-gray-300">+</span>
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block size-2.5 rounded-full"
            style={{ backgroundColor: MFR_COLOR }}
          />
          MFR
        </span>
        <span className="ml-auto text-xs font-medium text-gray-400">
          {monthLabel}
        </span>
      </h3>
      <div className="h-[320px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={DASHBOARD_CHART_MARGIN}>
            <XAxis
              dataKey="label"
              ticks={xTicks}
              tick={{ fontSize: DASHBOARD_CHART_TICK_FONT_SIZE, fill: "#94a3b8" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis yAxisId="revenue" hide />
            <YAxis yAxisId="mfr" orientation="right" hide domain={[0, 100]} />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const row = payload[0].payload as DailyMfrRevenuePoint & {
                  revenueCumulative: number | null;
                };
                const items = [
                  ...(row.revenueCumulative != null
                    ? [
                        {
                          color: REVENUE_COLOR,
                          label: "Ad Revenue (누적)",
                          value: row.revenueCumulative,
                        },
                      ]
                    : []),
                  ...(row.mfr != null
                    ? [{ color: MFR_COLOR, label: "MFR", value: `${row.mfr.toFixed(1)}%` }]
                    : []),
                ];
                if (items.length === 0) return null;
                return <ChartTooltip title={row.label} items={items} />;
              }}
            />
            <Line
              yAxisId="revenue"
              type="monotone"
              dataKey="revenueCumulative"
              stroke={REVENUE_COLOR}
              strokeWidth={2.5}
              dot={{ r: 2.5, fill: REVENUE_COLOR, strokeWidth: 0 }}
              activeDot={{ r: 5, fill: REVENUE_COLOR }}
              connectNulls={false}
              animationDuration={DASHBOARD_CHART_ANIMATION_DURATION}
            />
            <Line
              yAxisId="mfr"
              type="monotone"
              dataKey="mfr"
              stroke={MFR_COLOR}
              strokeWidth={2}
              dot={{ r: 2, fill: MFR_COLOR, strokeWidth: 0 }}
              activeDot={{ r: 4, fill: MFR_COLOR }}
              connectNulls={false}
              animationDuration={DASHBOARD_CHART_ANIMATION_DURATION}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
});
