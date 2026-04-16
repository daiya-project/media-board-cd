"use client";

import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateHeader, getDayType } from "@/lib/utils/date-utils";
import { showChangeColumn } from "@/lib/utils/number-utils";
import {
  getDateHeaderColorClass,
  getStickyColStyle,
  isLastStickyCol,
} from "@/lib/utils/table-display-utils";
import type { SortState } from "@/lib/utils/sort-utils";
import type { SortField } from "@/lib/logic/dataBoardCalculations";
import { EmptyTableRow } from "@/components/common/EmptyState";
import type { PeriodType } from "@/lib/logic/boardLogic";
import type {
  DataBoardGroupedRow,
  DataFilterType,
  DataMetricType,
  RawDateComponents,
} from "@/types/app-db.types";
import DataTableRow from "./DataTableRow";
import DataTableTotalRow from "./DataTableTotalRow";

// ---------------------------------------------------------------------------
// Sort icon
// ---------------------------------------------------------------------------

function SortIcon({
  field,
  sort,
}: {
  field: SortField;
  sort: SortState<SortField>;
}) {
  if (sort.field !== field)
    return <ChevronsUpDown className="w-3 h-3 text-gray-300 ml-0.5 shrink-0" />;
  if (sort.direction === "asc")
    return <ChevronUp className="w-3 h-3 text-blue-500 ml-0.5 shrink-0" />;
  if (sort.direction === "desc")
    return <ChevronDown className="w-3 h-3 text-blue-500 ml-0.5 shrink-0" />;
  return <ChevronsUpDown className="w-3 h-3 text-gray-300 ml-0.5 shrink-0" />;
}

// ---------------------------------------------------------------------------
// Sortable header cell
// ---------------------------------------------------------------------------

interface ThProps {
  field: SortField;
  sort: SortState<SortField>;
  onSort: (f: SortField) => void;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  align?: "left" | "center" | "right";
}

function Th({ field, sort, onSort, children, className, style, align = "center" }: ThProps) {
  const isActive = sort.field === field && sort.direction !== "none";
  return (
    <th
      className={cn(
        "h-10 px-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wide",
        "cursor-pointer select-none hover:text-gray-800 transition-colors whitespace-nowrap",
        isActive && "text-blue-600",
        className,
      )}
      style={style}
      onClick={() => onSort(field)}
    >
      <div
        className={cn(
          "flex items-center gap-0.5",
          align === "right" && "justify-end",
          align === "center" && "justify-center",
          align === "left" && "justify-start",
        )}
      >
        {children}
        <SortIcon field={field} sort={sort} />
      </div>
    </th>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface DataTableProps {
  dates: string[];
  holidays: Set<string>;
  filterType: DataFilterType;
  metricType: DataMetricType;
  /** Period mode determines column header labels and date formatting. */
  periodType: PeriodType;
  sortedRows: DataBoardGroupedRow[];
  totalDateValues: Map<string, number>;
  totalRawDates: Map<string, RawDateComponents>;
  sort: SortState<SortField>;
  onSort: (field: SortField) => void;
  isEmpty: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * DATA section table with sticky header and sortable columns.
 * The total row is always pinned at the top of the tbody.
 * All column visibility is driven by the current filterType and metricType.
 */
export default function DataTable({
  dates,
  holidays,
  filterType,
  metricType,
  periodType,
  sortedRows,
  totalDateValues,
  totalRawDates,
  sort,
  onSort,
  isEmpty,
}: DataTableProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const thProps = { sort, onSort };
  const showChange = showChangeColumn(metricType);
  const isPeriodicMode = periodType !== "daily";

  // "전일" label changes based on period type
  const prevColLabel =
    periodType === "weekly" ? "전주" : periodType === "monthly" ? "전월" : "전일";

  const latestDate = dates[0] ?? "";
  const isLatestDate = (d: string) => d === latestDate;

  // Calculate total column count for empty/skeleton states
  const fixedCols =
    1 + // client
    (filterType !== "client" ? 1 : 0) + // service
    (filterType === "widget" ? 2 : 0) + // widget_id + widget_name
    2 + // average + previous
    (showChange ? 1 : 0); // change
  const totalCols = fixedCols + dates.length;

  // Row virtualization — only data rows, not header or total row
  const rowVirtualizer = useVirtualizer({
    count: sortedRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 33, // ~33px per row (text-sm + padding)
    overscan: 20,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();
  const paddingTop = virtualItems[0]?.start ?? 0;
  const paddingBottom =
    totalSize - (virtualItems[virtualItems.length - 1]?.end ?? 0);

  return (
    <div ref={parentRef} className="flex-1 overflow-auto mx-4 mt-3 mb-4 rounded-xl border border-border shadow-sm">
      <table className="w-max min-w-full border-collapse text-sm">
        {/* ---------------------------------------------------------------- */}
        {/* HEADER                                                             */}
        {/* ---------------------------------------------------------------- */}
        <thead className="sticky top-0 z-10 bg-white border-b border-border shadow-[0_1px_0_0_#e5e7eb]">
          <tr>
            {/* Client (sticky) */}
            <Th
              {...thProps}
              field="client"
              style={getStickyColStyle(filterType, "client", true)}
              className={cn(
                "bg-muted",
                isLastStickyCol(filterType, "client") && "sticky-col-shadow",
              )}
            >
              Client
            </Th>

            {/* Service (sticky) */}
            {filterType !== "client" && (
              <Th
                {...thProps}
                field="service"
                style={getStickyColStyle(filterType, "service", true)}
                className={cn(
                  "bg-muted",
                  isLastStickyCol(filterType, "service") && "sticky-col-shadow",
                )}
              >
                Service
              </Th>
            )}

            {/* Widget columns (sticky) */}
            {filterType === "widget" && (
              <>
                <Th
                  {...thProps}
                  field="widget_id"
                  style={getStickyColStyle(filterType, "widget_id", true)}
                  className="bg-muted"
                >
                  W-ID
                </Th>
                <Th
                  {...thProps}
                  field="widget_name"
                  style={getStickyColStyle(filterType, "widget_name", true)}
                  className="bg-muted sticky-col-shadow"
                >
                  Widget Name
                </Th>
              </>
            )}

            {/* Stat columns */}
            <Th {...thProps} field="average" style={{ minWidth: 72 }}>
              평균
            </Th>
            <Th {...thProps} field="previous" style={{ minWidth: 72 }}>
              {prevColLabel}
            </Th>
            {showChange && (
              <Th {...thProps} field="change" style={{ minWidth: 80 }}>
                증감
              </Th>
            )}

            {/* Date / period columns */}
            {dates.map((date, idx) => {
              const isLatest = date === latestDate;
              // In period mode, dates are labels (not YYYY-MM-DD) — skip holiday coloring
              const dayType = isPeriodicMode ? "weekday" : getDayType(date, holidays);
              const field = `date-${idx}` as SortField;
              // In daily mode, format as MM/DD; in period mode, use the label as-is
              const colLabel = isPeriodicMode ? date : formatDateHeader(date);

              return (
                <Th
                  key={date}
                  {...thProps}
                  field={field}
                  style={{ minWidth: 80 }}
                  className={cn(
                    getDateHeaderColorClass(dayType),
                    isLatest && !isPeriodicMode && "bg-amber-50",
                  )}
                >
                  {colLabel}
                </Th>
              );
            })}
          </tr>
        </thead>

        {/* ---------------------------------------------------------------- */}
        {/* BODY                                                               */}
        {/* ---------------------------------------------------------------- */}
        <tbody>
          {/* Total row — always first */}
          <DataTableTotalRow
            dates={dates}
            holidays={holidays}
            filterType={filterType}
            metricType={metricType}
            totalDateValues={totalDateValues}
            totalRawDates={totalRawDates}
            isLatestDate={isLatestDate}
            skipWeekdayFilter={isPeriodicMode}
          />

          {isEmpty ? (
            <EmptyTableRow colSpan={totalCols} message="조건에 맞는 데이터가 없습니다." />
          ) : (
            <>
              {paddingTop > 0 && (
                <tr>
                  <td style={{ height: paddingTop, padding: 0, border: "none" }} />
                </tr>
              )}
              {virtualItems.map((virtualRow) => {
                const row = sortedRows[virtualRow.index];
                const key = `${row.client_id}-${row.service_id}-${row.widget_id ?? ""}`;
                return (
                  <DataTableRow
                    key={key}
                    row={row}
                    dates={dates}
                    holidays={holidays}
                    filterType={filterType}
                    metricType={metricType}
                    isLatestDate={isLatestDate}
                    skipWeekdayFilter={isPeriodicMode}
                  />
                );
              })}
              {paddingBottom > 0 && (
                <tr>
                  <td style={{ height: paddingBottom, padding: 0, border: "none" }} />
                </tr>
              )}
            </>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

/** @deprecated Use `TableSkeleton` from `@/components/common/PageSkeleton` instead. */
export { TableSkeleton as DataTableSkeleton } from "@/components/common/PageSkeleton";
