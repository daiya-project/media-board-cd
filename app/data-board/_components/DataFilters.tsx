"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { Info } from "lucide-react";
import type { DataFilterType, DataMetricType } from "@/types/app-db.types";
import type { PeriodType } from "@/lib/logic/boardLogic";
import PeriodRangeSlider from "@/components/common/PeriodRangeSlider";

// ---------------------------------------------------------------------------
// Filter type tab definitions
// ---------------------------------------------------------------------------

const FILTER_TABS: { value: DataFilterType; label: string }[] = [
  { value: "client", label: "C" },
  { value: "service", label: "S" },
  { value: "widget", label: "W" },
];

// ---------------------------------------------------------------------------
// Metric type tab definitions
// ---------------------------------------------------------------------------

const METRIC_TABS: { value: DataMetricType; label: string }[] = [
  { value: "adrevenue", label: "Ad Revenue" },
  { value: "pubprofit", label: "Pub Profit" },
  { value: "mfr", label: "MFR" },
  { value: "imp", label: "IMP" },
  { value: "vimp", label: "vIMP" },
  { value: "vrate", label: "vRATE" },
  { value: "vctr", label: "vCTR" },
];

// ---------------------------------------------------------------------------
// Period type link definitions
// ---------------------------------------------------------------------------

const PERIOD_TABS: { value: PeriodType; label: string; href: string }[] = [
  { value: "monthly", label: "월", href: "/data-board/monthly" },
  { value: "weekly", label: "주", href: "/data-board/weekly" },
  { value: "daily", label: "일", href: "/data-board/daily" },
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface DataFiltersProps {
  filterType: DataFilterType;
  onFilterTypeChange: (type: DataFilterType) => void;
  metricType: DataMetricType;
  onMetricTypeChange: (type: DataMetricType) => void;
  periodType: PeriodType;
  chartRange: number;
  onChartRangeChange: (n: number) => void;
  excludeSmall: boolean;
  onExcludeSmallChange: (value: boolean) => void;
  excludeBlog: boolean;
  onExcludeBlogChange: (value: boolean) => void;
  excludeSsp: boolean;
  onExcludeSspChange: (value: boolean) => void;
  sliderMaxOverride?: number;
  isWidgetDisabled?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Filter bar for the DATA section.
 * Layout: C/S/W | metric tabs | 월/주/일 (Link) | slider | 소액지면
 *
 * Period type switching now uses Link-based navigation between
 * /data-board/daily, /data-board/weekly, /data-board/monthly.
 */
export default function DataFilters({
  filterType,
  onFilterTypeChange,
  metricType,
  onMetricTypeChange,
  periodType,
  chartRange,
  onChartRangeChange,
  excludeSmall,
  onExcludeSmallChange,
  excludeBlog,
  onExcludeBlogChange,
  excludeSsp,
  onExcludeSspChange,
  sliderMaxOverride,
  isWidgetDisabled,
}: DataFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-[#f5f7fb] px-4 py-2.5">
      {/* C / S / W granularity */}
      <div className="flex items-center gap-1 rounded-xl bg-[#e7ecf3] p-1">
        {FILTER_TABS.map(({ value, label }) => {
          const disabled = value === "widget" && isWidgetDisabled;
          return (
            <button
              key={value}
              disabled={disabled}
              onClick={() => onFilterTypeChange(value)}
              className={cn(
                "h-9 min-w-12 rounded-lg border border-transparent px-3 text-xs font-semibold transition-colors",
                filterType === value
                  ? "border border-slate-200 bg-white text-[#2563eb] shadow-[0_1px_2px_rgba(15,23,42,0.08)]"
                  : "text-slate-500 hover:text-slate-700",
                disabled && "opacity-40 cursor-not-allowed",
              )}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Divider */}
      <div className="h-6 w-px bg-slate-300" />

      {/* Metric type tabs */}
      <div className="flex items-center gap-1 rounded-xl bg-[#e7ecf3] p-1">
        {METRIC_TABS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => onMetricTypeChange(value)}
            className={cn(
              "h-9 rounded-lg border border-transparent px-4 text-xs font-semibold transition-colors",
              metricType === value
                ? "border border-slate-200 bg-white text-[#2563eb] shadow-[0_1px_2px_rgba(15,23,42,0.08)]"
                : "text-slate-500 hover:text-slate-700",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Divider */}
      <div className="h-6 w-px bg-slate-300" />

      {/* Period type toggle (Link-based navigation) */}
      <div className="flex items-center gap-1 rounded-xl bg-[#e7ecf3] p-1">
        {PERIOD_TABS.map(({ value, label, href }) => {
          const isActive = periodType === value;
          return isActive ? (
            <span
              key={value}
              className="h-9 min-w-10 rounded-lg border border-slate-200 bg-white text-[#2563eb] shadow-[0_1px_2px_rgba(15,23,42,0.08)] px-3 text-xs font-semibold flex items-center justify-center"
            >
              {label}
            </span>
          ) : (
            <Link
              key={value}
              href={href}
              className="h-9 min-w-10 rounded-lg border border-transparent px-3 text-xs font-semibold text-slate-500 hover:text-slate-700 transition-colors flex items-center justify-center"
            >
              {label}
            </Link>
          );
        })}
      </div>

      {/* Period range slider */}
      <PeriodRangeSlider
        periodType={periodType}
        value={chartRange}
        onChange={onChartRangeChange}
        maxOverride={sliderMaxOverride}
        sliderClassName="w-24"
      />

      {/* Divider */}
      <div className="h-6 w-px bg-slate-300" />

      {/* Small-slot exclusion */}
      <label className="flex cursor-pointer select-none items-center gap-1.5 text-xs text-slate-600">
        <input
          type="checkbox"
          checked={excludeSmall}
          onChange={(e) => onExcludeSmallChange(e.target.checked)}
          className="h-4 w-4 accent-[#2563eb]"
        />
        <span className="font-medium">소액 지면 제외</span>
        <Info className="h-3.5 w-3.5 text-slate-400" />
      </label>

      {/* Blog exclusion */}
      <label className="flex cursor-pointer select-none items-center gap-1.5 text-xs text-slate-600">
        <input
          type="checkbox"
          checked={excludeBlog}
          onChange={(e) => onExcludeBlogChange(e.target.checked)}
          className="h-4 w-4 accent-[#2563eb]"
        />
        <span className="font-medium">BLOG 제외</span>
      </label>

      {/* SSP exclusion */}
      <label className="flex cursor-pointer select-none items-center gap-1.5 text-xs text-slate-600">
        <input
          type="checkbox"
          checked={excludeSsp}
          onChange={(e) => onExcludeSspChange(e.target.checked)}
          className="h-4 w-4 accent-[#2563eb]"
        />
        <span className="font-medium">SSP 제외</span>
      </label>
    </div>
  );
}
