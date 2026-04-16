"use client";

import { cn } from "@/lib/utils";
import { getDayType } from "@/lib/utils/date-utils";
import {
  formatMetricValue,
  formatComparison,
  formatChange,
  showChangeColumn,
} from "@/lib/utils/number-utils";
import {
  TABLE_TD_CLASS,
  getDateCellColorClass,
  getStickyColStyle,
  isLastStickyCol,
} from "@/lib/utils/table-display-utils";
import {
  calculateAverage,
  calculatePreviousDay,
  calculateChange,
} from "@/lib/logic/dataBoardCalculations";
import type {
  DataFilterType,
  DataMetricType,
  RawDateComponents,
} from "@/types/app-db.types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface DataTableTotalRowProps {
  dates: string[];
  holidays: Set<string>;
  filterType: DataFilterType;
  metricType: DataMetricType;
  totalDateValues: Map<string, number>;
  totalRawDates: Map<string, RawDateComponents>;
  isLatestDate: (date: string) => boolean;
  /** If true, skip weekday filtering in calculateAverage (for period mode). */
  skipWeekdayFilter?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Pinned "합계 (Total)" row, always rendered first in the table body.
 * The label cell spans all identifier columns (client / service / widget)
 * so that no empty placeholder cells are rendered.
 */
export default function DataTableTotalRow({
  dates,
  holidays,
  filterType,
  metricType,
  totalDateValues,
  totalRawDates,
  isLatestDate,
  skipWeekdayFilter = false,
}: DataTableTotalRowProps) {
  const avgValue = calculateAverage(
    dates,
    totalDateValues,
    holidays,
    metricType,
    totalRawDates,
    skipWeekdayFilter,
  );
  const prevValue = calculatePreviousDay(dates, totalDateValues, metricType);
  const changeValue = calculateChange(dates, totalDateValues);
  const showChange = showChangeColumn(metricType);

  return (
    <tr className="bg-muted border-b-2 border-border font-medium">
      {/* 합계 label — sticky client column */}
      <td
        className={cn(
          TABLE_TD_CLASS,
          "text-xs font-semibold text-foreground text-center whitespace-nowrap bg-muted",
          isLastStickyCol(filterType, "client") && "sticky-col-shadow",
        )}
        style={getStickyColStyle(filterType, "client", false)}
      >
        합계
      </td>

      {/* Empty sticky cells for remaining identifier columns */}
      {filterType !== "client" && (
        <td
          className={cn(
            TABLE_TD_CLASS,
            "bg-muted",
            isLastStickyCol(filterType, "service") && "sticky-col-shadow",
          )}
          style={getStickyColStyle(filterType, "service", false)}
        />
      )}
      {filterType === "widget" && (
        <>
          <td
            className={cn(TABLE_TD_CLASS, "bg-muted")}
            style={getStickyColStyle(filterType, "widget_id", false)}
          />
          <td
            className={cn(TABLE_TD_CLASS, "bg-muted sticky-col-shadow")}
            style={getStickyColStyle(filterType, "widget_name", false)}
          />
        </>
      )}

      {/* Average */}
      <td
        className={cn(
          TABLE_TD_CLASS,
          "text-xs text-right tabular-nums whitespace-nowrap",
          avgValue === null
            ? "text-muted-foreground/30"
            : avgValue >= 0
              ? "text-blue-600"
              : "text-destructive",
        )}
      >
        {avgValue === null ? "-" : formatComparison(avgValue, metricType)}
      </td>

      {/* Previous Day */}
      <td
        className={cn(
          TABLE_TD_CLASS,
          "text-xs text-right tabular-nums whitespace-nowrap",
          prevValue === null
            ? "text-muted-foreground/30"
            : prevValue >= 0
              ? "text-blue-600"
              : "text-destructive",
        )}
      >
        {prevValue === null ? "-" : formatComparison(prevValue, metricType)}
      </td>

      {/* Change */}
      {showChange && (
        <td className={cn(TABLE_TD_CLASS, "text-xs text-right tabular-nums whitespace-nowrap text-foreground")}>
          {changeValue === null ? "-" : formatChange(changeValue, metricType)}
        </td>
      )}

      {/* Date columns */}
      {dates.map((date, idx) => {
        const value = totalDateValues.get(date);
        const isLatest = isLatestDate(date);
        const isZero = value === 0 || value === undefined;
        const dayType = skipWeekdayFilter ? "weekday" as const : getDayType(date, holidays);

        return (
          <td
            key={date}
            className={cn(
              TABLE_TD_CLASS,
              "text-xs text-right tabular-nums whitespace-nowrap",
              isLatest && !skipWeekdayFilter && "bg-amber-50",
              getDateCellColorClass(dayType, isZero),
              idx > 0 && "border-l border-border",
            )}
          >
            {isZero ? "-" : formatMetricValue(value ?? 0, metricType)}
          </td>
        );
      })}
    </tr>
  );
}
