"use client";

import { memo } from "react";
import {
  Area,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartTooltip } from "@/components/common/ChartTooltip";
import type { VimpMonthlyPoint } from "@/lib/features/dashboard-monthly/aggregate";
import {
  DASHBOARD_CHART_ANIMATION_DURATION,
  DASHBOARD_CHART_MARGIN,
  DASHBOARD_CHART_TICK_FONT_SIZE,
  formatKoreanAmount,
} from "./monthly-helpers";

const TICK_DAYS = [5, 10, 15, 20, 25];
const CURRENT_COLOR = "#2563eb";
const GOAL_COLOR = "oklch(0.65 0.22 25)";
const PROJECTED_COLOR = "#2563eb";

interface Props {
  data: VimpMonthlyPoint[];
  monthLabel: string;
  hasGoal: boolean;
}

export const VimpMonthlyChart = memo(function VimpMonthlyChart({
  data,
  monthLabel,
  hasGoal,
}: Props) {
  const xTicks = (() => {
    const last = data.length;
    const days = [...TICK_DAYS, last].filter((d) => d <= last);
    return [...new Set(days)]
      .sort((a, b) => a - b)
      .map((d) => data[d - 1]?.label ?? "")
      .filter(Boolean);
  })();

  return (
    <section className="flex h-full w-full flex-col rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="mb-4 flex flex-wrap items-center gap-3 text-base font-bold text-gray-700">
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block size-2.5 rounded-full"
            style={{ backgroundColor: CURRENT_COLOR }}
          />
          Monthly Chart · vIMP 누적
        </span>
        {hasGoal && (
          <>
            <span className="text-gray-300">vs</span>
            <span className="flex items-center gap-1.5">
              <span
                aria-hidden
                className="inline-block size-2.5 rounded-full"
                style={{ backgroundColor: GOAL_COLOR }}
              />
              월 목표
            </span>
          </>
        )}
        <span className="ml-auto text-xs font-medium text-gray-400">
          {monthLabel}
        </span>
      </h3>
      <div className="h-[320px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={DASHBOARD_CHART_MARGIN}>
            <defs>
              <linearGradient id="vimpFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CURRENT_COLOR} stopOpacity={0.3} />
                <stop offset="60%" stopColor={CURRENT_COLOR} stopOpacity={0.08} />
                <stop offset="100%" stopColor={CURRENT_COLOR} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="label"
              ticks={xTicks}
              tick={{ fontSize: DASHBOARD_CHART_TICK_FONT_SIZE, fill: "#94a3b8" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: DASHBOARD_CHART_TICK_FONT_SIZE, fill: "#94a3b8" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => formatKoreanAmount(v)}
              width={56}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const row = payload[0].payload as VimpMonthlyPoint;
                const items = [
                  ...(row.current != null
                    ? [
                        {
                          color: CURRENT_COLOR,
                          label: "이번 달 누적",
                          value: row.current,
                        },
                      ]
                    : []),
                  ...(row.projected != null && row.current == null
                    ? [
                        {
                          color: PROJECTED_COLOR,
                          label: "예상",
                          value: Math.round(row.projected),
                        },
                      ]
                    : []),
                  ...(hasGoal && row.goal != null
                    ? [{ color: GOAL_COLOR, label: "목표", value: row.goal }]
                    : []),
                ];
                if (items.length === 0) return null;
                return <ChartTooltip title={row.label} items={items} />;
              }}
            />
            {hasGoal && (
              <Line
                type="monotone"
                dataKey="goal"
                stroke={GOAL_COLOR}
                strokeWidth={1.5}
                strokeDasharray="6 4"
                strokeOpacity={0.9}
                dot={false}
                animationDuration={DASHBOARD_CHART_ANIMATION_DURATION}
              />
            )}
            <Line
              type="monotone"
              dataKey="projected"
              stroke={PROJECTED_COLOR}
              strokeWidth={1.5}
              strokeDasharray="4 4"
              strokeOpacity={0.6}
              dot={false}
              connectNulls
              animationDuration={DASHBOARD_CHART_ANIMATION_DURATION}
            />
            <Area
              type="monotone"
              dataKey="current"
              stroke={CURRENT_COLOR}
              fill="url(#vimpFill)"
              strokeWidth={2.5}
              dot={false}
              connectNulls={false}
              animationDuration={DASHBOARD_CHART_ANIMATION_DURATION}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
});
