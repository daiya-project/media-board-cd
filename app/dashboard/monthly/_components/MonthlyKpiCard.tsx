"use client";

import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MetricKpi } from "@/lib/features/dashboard-monthly/aggregate";
import {
  formatChangeAmount,
  formatNumberWithCommas,
  formatPercent,
  formatRate,
  rateColorClass,
} from "./monthly-helpers";

type ValueFormat = "integer" | "percent";

interface Props {
  label: string;
  icon: LucideIcon;
  iconColor: string;
  /** "전월 대비" / "전월" 등 비교 라벨 */
  comparisonLabel?: string;
  format: ValueFormat;
  isHigherBetter: boolean;
  data: MetricKpi;
}

function fmtValue(value: number, format: ValueFormat): string {
  if (format === "percent") return formatPercent(value, 1);
  return formatNumberWithCommas(value);
}

export function MonthlyKpiCard({
  label,
  icon: Icon,
  iconColor,
  comparisonLabel = "전월",
  format,
  isHigherBetter,
  data,
}: Props) {
  const { current, previous, changeAmount, changeRate } = data;

  return (
    <div className="flex flex-col rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          {label}
        </h3>
        <div
          className="flex size-10 items-center justify-center rounded-xl"
          style={{ backgroundColor: `color-mix(in oklch, ${iconColor} 15%, white)` }}
        >
          <Icon className="size-5" style={{ color: iconColor }} />
        </div>
      </div>
      <div className="flex flex-1 flex-col">
        <div className="text-xs text-gray-500">이번 달</div>
        <div className="text-2xl font-extrabold tabular-nums tracking-tight text-gray-900">
          {fmtValue(current, format)}
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-gray-500">{comparisonLabel} 대비</span>
          {format === "integer" ? (
            <span
              className={cn(
                "font-semibold tabular-nums",
                changeAmount > 0
                  ? "text-emerald-600"
                  : changeAmount < 0
                    ? "text-rose-600"
                    : "text-gray-500",
              )}
            >
              {formatChangeAmount(changeAmount)}
            </span>
          ) : (
            <span
              className={cn(
                "font-semibold tabular-nums",
                changeAmount > 0
                  ? isHigherBetter
                    ? "text-emerald-600"
                    : "text-rose-600"
                  : changeAmount < 0
                    ? isHigherBetter
                      ? "text-rose-600"
                      : "text-emerald-600"
                    : "text-gray-500",
              )}
            >
              {changeAmount > 0 ? "+" : ""}
              {changeAmount.toFixed(1)}%p
            </span>
          )}
          <span
            className={cn(
              "rounded-md px-1.5 py-0.5 font-semibold",
              rateColorClass(changeRate, isHigherBetter),
            )}
          >
            {formatRate(changeRate)}
          </span>
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3 text-sm">
          <span className="text-gray-500">{comparisonLabel}</span>
          <span className="font-semibold tabular-nums text-gray-700">
            {fmtValue(previous, format)}
          </span>
        </div>
      </div>
    </div>
  );
}
