import { DollarSign, Eye, Percent, TrendingUp, TrendingDown } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { BoardSummary } from "@/types/app-db.types";
import type { PeriodType } from "@/lib/logic/boardLogic";
import { cn } from "@/lib/utils";
import { formatNumberForDisplay } from "@/lib/utils/number-utils";

// ---------------------------------------------------------------------------
// Format helpers
// ---------------------------------------------------------------------------

function fmtNumber(v: number): string {
  return formatNumberForDisplay(v);
}

function fmtMfr(v: number): string {
  return `${v.toFixed(1)}%`;
}

/**
 * Formats a change rate for display.
 * @param rate  - The change rate value
 * @param isMfr - If true, appends "pp" (percentage point) instead of "%"
 */
function fmtRate(rate: number, isMfr: boolean): string {
  const sign = rate >= 0 ? "+" : "";
  const suffix = isMfr ? "pp" : "%";
  return `${sign}${rate.toFixed(1)}${suffix}`;
}

// ---------------------------------------------------------------------------
// KpiCard sub-component
// ---------------------------------------------------------------------------

interface KpiCardProps {
  title: string;
  icon: LucideIcon;
  latestValue: string;
  previousValue: string;
  changeRate: number;
  /** When true, positive changeRate is styled as "bad" (MFR inversion). */
  invertColors?: boolean;
  latestDate: string;
  comparisonLabel: string;
}

function KpiCard({
  title,
  icon: Icon,
  latestValue,
  previousValue,
  changeRate,
  invertColors = false,
  latestDate,
  comparisonLabel,
}: KpiCardProps) {
  const isPositive = changeRate > 0;
  const isGood = invertColors ? !isPositive : isPositive;
  const isZero = changeRate === 0;

  const changeStr = fmtRate(changeRate, invertColors);

  const badgeClass = isZero
    ? "bg-gray-100 text-gray-400"
    : isGood
      ? "bg-emerald-50 text-emerald-700"
      : "bg-red-50 text-red-600";

  const iconClass = isZero
    ? "hidden"
    : isGood
      ? "text-emerald-600"
      : "text-red-500";

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-3 shadow-sm hover:shadow-md transition-shadow">
      {/* Header: title + icon */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          {title}
        </span>
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-50">
          <Icon className="w-4 h-4 text-indigo-500" />
        </div>
      </div>

      {/* Latest value */}
      <div className="text-2xl font-extrabold text-gray-900 tabular-nums">
        {latestValue}
      </div>

      {/* Comparison row */}
      <div className="flex items-center gap-2 pt-2.5 border-t border-gray-100">
        {/* Change rate badge */}
        <span
          className={cn(
            "inline-flex items-center gap-0.5 rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums",
            badgeClass,
          )}
        >
          {!isZero && (
            isGood
              ? <TrendingUp className={cn("w-3 h-3", iconClass)} />
              : <TrendingDown className={cn("w-3 h-3", iconClass)} />
          )}
          {changeStr}
        </span>

        {/* vs previous value */}
        <span className="text-xs text-gray-400">
          {comparisonLabel}{" "}
          <span className="font-mono text-gray-500">{previousValue}</span>
        </span>
      </div>

      {/* Latest date label */}
      <div className="text-[10px] text-gray-400 -mt-1">
        기준일: {latestDate}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SummaryCards
// ---------------------------------------------------------------------------

interface SummaryCardsProps {
  summary: BoardSummary;
  latestDate: string;
  comparisonLabel: string;
  periodType: PeriodType;
}

/**
 * Renders three KPI cards: Ad Revenue, vIMP, MFR.
 *
 * @param summary          - Aggregated KPI metrics from calcBoardSummaryByDateRange()
 * @param latestDate       - Most recent date string (YYYY-MM-DD)
 * @param comparisonLabel  - Human-readable comparison label (e.g. "vs 02/14", "vs 전주")
 * @param periodType       - Active period type for context display
 */
export default function SummaryCards({
  summary,
  latestDate,
  comparisonLabel,
}: SummaryCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 px-6 pt-6">
      <KpiCard
        title="Ad Revenue"
        icon={DollarSign}
        latestValue={fmtNumber(summary.adRevenue.latestValue)}
        previousValue={fmtNumber(summary.adRevenue.previousValue)}
        changeRate={summary.adRevenue.changeRate}
        latestDate={latestDate}
        comparisonLabel={comparisonLabel}
      />
      <KpiCard
        title="vIMP"
        icon={Eye}
        latestValue={fmtNumber(summary.vimp.latestValue)}
        previousValue={fmtNumber(summary.vimp.previousValue)}
        changeRate={summary.vimp.changeRate}
        latestDate={latestDate}
        comparisonLabel={comparisonLabel}
      />
      <KpiCard
        title="MFR"
        icon={Percent}
        latestValue={fmtMfr(summary.mfr.latestValue)}
        previousValue={fmtMfr(summary.mfr.previousValue)}
        changeRate={summary.mfr.changeRate}
        invertColors
        latestDate={latestDate}
        comparisonLabel={comparisonLabel}
      />
    </div>
  );
}
