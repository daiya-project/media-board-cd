"use client";

import { CalendarDays } from "lucide-react";
import type { PeriodType } from "@/lib/logic/boardLogic";
import PeriodTypeToggle from "@/components/common/PeriodTypeToggle";
import PeriodRangeSlider from "@/components/common/PeriodRangeSlider";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DashboardControlsProps {
  periodType: PeriodType;
  chartRange: number;
  latestDate: string;
  onPeriodTypeChange: (t: PeriodType) => void;
  onChartRangeChange: (n: number) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Period selection control panel for the Dashboard section.
 *
 * Provides a toggle to switch between monthly / weekly / daily views,
 * and a range slider (always visible) to adjust the number of periods
 * displayed in the chart.
 *
 * KPI cards always compare the latest period vs the direct previous period,
 * independent of the chart range slider.
 *
 * @param periodType          - Currently active period type
 * @param chartRange          - Number of periods shown in the chart
 * @param latestDate          - Most recent data date shown as reference
 * @param onPeriodTypeChange  - Callback when period type is changed
 * @param onChartRangeChange  - Callback when chart range slider is moved
 */
export default function DashboardControls({
  periodType,
  chartRange,
  latestDate,
  onPeriodTypeChange,
  onChartRangeChange,
}: DashboardControlsProps) {
  return (
    <div className="mx-6 bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-3">
      {/* Period type toggle */}
      <PeriodTypeToggle value={periodType} onChange={onPeriodTypeChange} />

      {/* Divider + slider (always visible) */}
      <div className="w-px h-5 bg-gray-200 flex-shrink-0" />
      <div className="flex items-center gap-3">
        <span className="text-xs text-gray-500 whitespace-nowrap">
          표시 기간
        </span>
        <PeriodRangeSlider
          periodType={periodType}
          value={chartRange}
          onChange={onChartRangeChange}
        />
      </div>

      {/* Reference date (right-aligned) */}
      <div className="ml-auto flex items-center gap-1.5 text-xs text-gray-400">
        <CalendarDays className="w-3.5 h-3.5" />
        <span>기준 {latestDate}</span>
      </div>
    </div>
  );
}
