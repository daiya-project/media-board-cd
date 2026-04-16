"use client";

/**
 * Cumulative monthly vIMP chart with actual, projected, and goal lines.
 *
 * X-axis: day of month (1–31)
 * Y-axis: cumulative vIMP
 * Lines:
 *   - Actual (solid green): cumulative vimp through latest data day
 *   - Projected (dashed green): linear projection to end of month
 *   - Goal (dashed blue): linear goal line from 0 to monthly target
 */

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from "recharts";
import { formatNumberForDisplay } from "@/lib/utils/number-utils";
import { parseYearMonth } from "@/lib/utils/date-utils";
import { ChartTooltip } from "@/components/common/ChartTooltip";
import type { CumulativeChartPoint } from "@/lib/logic/goalLogic";

interface Props {
  chartPoints: CumulativeChartPoint[];
  currentMonthKey: string;
  monthGoal: number;
}

function fmtYAxis(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(0)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return `${value}`;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ dataKey?: string; value: number | null; color?: string }>;
  label?: number;
}

function CumulativeTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;

  const items = payload
    .filter((p) => p.value !== null && p.value !== undefined)
    .map((p) => {
      const labelMap: Record<string, string> = {
        actual: "실제",
        projected: "예상",
        goalLine: "목표",
      };
      return {
        color: p.color ?? "#666",
        label: labelMap[p.dataKey ?? ""] ?? p.dataKey ?? "",
        value: formatNumberForDisplay(p.value!),
      };
    });

  return <ChartTooltip title={`${label}일`} items={items} />;
}

export default function CumulativeVimpChart({
  chartPoints,
  currentMonthKey,
  monthGoal,
}: Props) {
  const [, monthNum] = parseYearMonth(currentMonthKey);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">
        {monthNum}월 누적 vIMP
      </h3>
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartPoints}
            margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis
              dataKey="day"
              tick={{ fontSize: 10, fill: "#94a3b8" }}
              tickLine={false}
              axisLine={{ stroke: "#e2e8f0" }}
              tickFormatter={(v) => `${v}`}
            />
            <YAxis
              tickFormatter={fmtYAxis}
              tick={{ fontSize: 10, fill: "#94a3b8" }}
              tickLine={false}
              axisLine={false}
              width={56}
            />
            <Tooltip content={<CumulativeTooltip />} />
            <Legend
              verticalAlign="top"
              align="right"
              iconType="line"
              wrapperStyle={{ fontSize: 11, paddingBottom: 8 }}
            />

            {/* Goal line */}
            {monthGoal > 0 && (
              <Line
                type="linear"
                dataKey="goalLine"
                name="목표"
                stroke="#3b82f6"
                strokeWidth={1.5}
                strokeDasharray="6 3"
                dot={false}
                activeDot={false}
                connectNulls
              />
            )}

            {/* Projected line (dashed) */}
            <Line
              type="linear"
              dataKey="projected"
              name="예상"
              stroke="#10b981"
              strokeWidth={1.5}
              strokeDasharray="4 2"
              dot={false}
              activeDot={false}
              connectNulls
            />

            {/* Actual line (solid) */}
            <Line
              type="monotone"
              dataKey="actual"
              name="실제"
              stroke="#10b981"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 4, fill: "#10b981" }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
