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
  DataBoardGroupedRow,
  DataFilterType,
  DataMetricType,
} from "@/types/app-db.types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface DataTableRowProps {
  row: DataBoardGroupedRow;
  dates: string[];
  holidays: Set<string>;
  filterType: DataFilterType;
  metricType: DataMetricType;
  isLatestDate: (date: string) => boolean;
  /** If true, skip weekday filtering in calculateAverage (for period mode). */
  skipWeekdayFilter?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * A single data row in the DATA section table.
 * All stat columns (average, previous, change) are computed inline from
 * the row's precomputed dateValues and rawDates maps.
 */
export default function DataTableRow({
  row,
  dates,
  holidays,
  filterType,
  metricType,
  isLatestDate,
  skipWeekdayFilter = false,
}: DataTableRowProps) {
  const avgValue = calculateAverage(
    dates,
    row.dateValues,
    holidays,
    metricType,
    row.rawDates,
    skipWeekdayFilter,
  );
  const prevValue = calculatePreviousDay(dates, row.dateValues, metricType);
  const changeValue = calculateChange(dates, row.dateValues);
  const showChange = showChangeColumn(metricType);

  return (
    <tr className="group border-b border-border hover:bg-gray-50 transition-colors">
      {/* Client (sticky) */}
      <td
        className={cn(
          TABLE_TD_CLASS,
          "text-xs text-foreground whitespace-nowrap overflow-hidden text-ellipsis bg-background group-hover:bg-gray-50 transition-colors",
          isLastStickyCol(filterType, "client") && "sticky-col-shadow",
        )}
        style={getStickyColStyle(filterType, "client", false)}
      >
        <span className="text-muted-foreground mr-1">{row.client_id}.</span>
        {row.client_name}
      </td>

      {/* Service (sticky, hidden in client mode) */}
      {filterType !== "client" && (
        <td
          className={cn(
            TABLE_TD_CLASS,
            "text-xs text-foreground whitespace-nowrap overflow-hidden text-ellipsis bg-background group-hover:bg-gray-50 transition-colors",
            isLastStickyCol(filterType, "service") && "sticky-col-shadow",
          )}
          style={getStickyColStyle(filterType, "service", false)}
        >
          <span className="text-muted-foreground mr-1">{row.service_id}.</span>
          {row.service_name}
        </td>
      )}

      {/* Widget ID + Name (sticky, widget mode only) */}
      {filterType === "widget" && (
        <>
          <td
            className={cn(
              TABLE_TD_CLASS,
              "text-xs text-muted-foreground font-mono whitespace-nowrap overflow-hidden text-ellipsis bg-background group-hover:bg-gray-50 transition-colors",
            )}
            style={getStickyColStyle(filterType, "widget_id", false)}
          >
            {row.widget_id ?? "-"}
          </td>
          <td
            className={cn(
              TABLE_TD_CLASS,
              "text-xs text-foreground whitespace-nowrap overflow-hidden text-ellipsis bg-background group-hover:bg-gray-50 transition-colors sticky-col-shadow",
            )}
            style={getStickyColStyle(filterType, "widget_name", false)}
          >
            {row.widget_name ?? "-"}
          </td>
        </>
      )}

      {/* Average */}
      <td
        className={cn(
          TABLE_TD_CLASS,
          "text-xs text-right tabular-nums whitespace-nowrap",
          avgValue === null ? "text-muted-foreground/30" : avgValue >= 0 ? "text-blue-600" : "text-destructive",
        )}
      >
        {avgValue === null ? "-" : formatComparison(avgValue, metricType)}
      </td>

      {/* Previous Day */}
      <td
        className={cn(
          TABLE_TD_CLASS,
          "text-xs text-right tabular-nums whitespace-nowrap",
          prevValue === null ? "text-muted-foreground/30" : prevValue >= 0 ? "text-blue-600" : "text-destructive",
        )}
      >
        {prevValue === null ? "-" : formatComparison(prevValue, metricType)}
      </td>

      {/* Change (hidden for % metric types) */}
      {showChange && (
        <td className={cn(TABLE_TD_CLASS, "text-xs text-right tabular-nums whitespace-nowrap text-muted-foreground")}>
          {changeValue === null ? "-" : formatChange(changeValue, metricType)}
        </td>
      )}

      {/* Date columns */}
      {dates.map((date, idx) => {
        const value = row.dateValues.get(date);
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
            {isZero ? "-" : formatMetricValue(value, metricType)}
          </td>
        );
      })}
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

/** Loading skeleton for a single data row. */
export function DataTableRowSkeleton({
  colCount,
}: {
  colCount: number;
}) {
  return (
    <tr className="border-b border-border">
      {Array.from({ length: colCount }).map((_, i) => (
        <td key={i} className={TABLE_TD_CLASS}>
          <div className="h-3 bg-muted rounded animate-pulse" />
        </td>
      ))}
    </tr>
  );
}
