"use client";

import {
  DollarSign,
  Eye,
  MousePointerClick,
  Percent,
  TrendingDown,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  CardData,
  MetricKey,
} from "@/lib/features/dashboard-today/aggregate";
import {
  calcChangeRate,
  formatMetricValue,
  getMetricConfig,
} from "./today-chart-constants";

const ICONS: Record<MetricKey, LucideIcon> = {
  revenue: DollarSign,
  vimp: Eye,
  cpc: MousePointerClick,
  vctr: Percent,
  mfr: TrendingDown,
};

/** 증감률 → "+12.3%" / "-4.5%". base=0 또는 NaN 이면 null. */
function formatChangePct(current: number, base: number): string | null {
  const rate = calcChangeRate(current, base);
  if (rate === null || !Number.isFinite(rate)) return null;
  const sign = rate > 0 ? "+" : "";
  return `${sign}${rate.toFixed(1)}%`;
}

/**
 * 증감률 뱃지 색.
 * isHigherBetter=false (mfr/cpc) 인 metric 은 부호 반전 적용.
 */
function changeBadgeClass(rate: number | null, isHigherBetter: boolean): string {
  if (rate === null || rate === 0) return "bg-gray-100 text-gray-600";
  const isPositive = rate > 0;
  const isGood = isPositive === isHigherBetter;
  return isGood
    ? "bg-emerald-100 text-emerald-700"
    : "bg-rose-100 text-rose-700";
}

const HIGHER_IS_BETTER: Record<MetricKey, boolean> = {
  revenue: true,
  vimp: true,
  cpc: false,
  vctr: true,
  mfr: false,
};

interface Props {
  metric: MetricKey;
  data: CardData;
}

export function TodayStatusCard({ metric, data }: Props) {
  const cfg = getMetricConfig(metric);
  const Icon = ICONS[metric];
  const higherBetter = HIGHER_IS_BETTER[metric];
  const { current, yesterdaySameHour, pastWeekdayAvgSameHour } = data;

  const rateYtd = calcChangeRate(current, yesterdaySameHour);
  const rateWk = calcChangeRate(current, pastWeekdayAvgSameHour);
  const rateYtdStr = formatChangePct(current, yesterdaySameHour);
  const rateWkStr = formatChangePct(current, pastWeekdayAvgSameHour);

  return (
    <div className="flex flex-col rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          {cfg.label}
        </h3>
        <div
          className="flex size-10 items-center justify-center rounded-xl"
          style={{ backgroundColor: `color-mix(in oklch, ${cfg.color} 15%, white)` }}
        >
          <Icon className="size-5" style={{ color: cfg.color }} />
        </div>
      </div>
      <div className="flex flex-1 flex-col">
        <div className="text-right text-2xl font-extrabold tabular-nums tracking-tight text-gray-900">
          {formatMetricValue(current, cfg.format)}
        </div>
        <div className="mt-3 flex flex-col gap-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-gray-500">전일</span>
            <div className="flex items-center gap-2 tabular-nums">
              <span className="font-semibold text-gray-700">
                {formatMetricValue(yesterdaySameHour, cfg.format)}
              </span>
              {rateYtdStr && (
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-semibold",
                    changeBadgeClass(rateYtd, higherBetter),
                  )}
                >
                  {rateYtdStr}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between border-t border-gray-100 pt-2">
            <span className="text-gray-500">평균</span>
            <div className="flex items-center gap-2 tabular-nums">
              <span className="font-semibold text-gray-700">
                {formatMetricValue(pastWeekdayAvgSameHour, cfg.format)}
              </span>
              {rateWkStr && (
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-semibold",
                    changeBadgeClass(rateWk, higherBetter),
                  )}
                >
                  {rateWkStr}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
