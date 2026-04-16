"use client";

import { useState, useMemo, useCallback } from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatNumberForDisplay } from "@/lib/utils/number-utils";
import {
  TABLE_THEAD_CLASS,
  TABLE_TH_CLASS,
  TABLE_TD_CLASS,
  EMPTY_STATE_CLASS,
} from "@/lib/utils/table-display-utils";
import {
  cycleSortDirection,
  compareNullable,
  type SortState,
} from "@/lib/utils/sort-utils";
import type { ExternalCombinedRow } from "@/types/external";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Calculates CPM (cost per mille) from revenue and impressions. */
function calcCpm(revenue: number, imp: number): number {
  if (imp === 0) return 0;
  return (revenue / imp) * 1000;
}

/** Formats CPM value with 1 decimal place. */
function formatCpm(revenue: number, imp: number): string {
  if (imp === 0) return "—";
  const cpm = calcCpm(revenue, imp);
  return `₩${formatNumberForDisplay(Math.round(cpm))}`;
}

// ---------------------------------------------------------------------------
// Sort fields
// ---------------------------------------------------------------------------

type ExternalSortField =
  | "date"
  | "source"
  | "label"
  | "internal_imp"
  | "internal_cpm"
  | "internal_revenue"
  | "external_imp"
  | "external_cpm"
  | "external_revenue"
  | "total_imp"
  | "total_revenue";

/** Extracts a comparable sort key from a row for the given field. */
function getSortKey(row: ExternalCombinedRow, field: ExternalSortField): string | number {
  switch (field) {
    case "date":             return row.date;
    case "source":           return row.source;
    case "label":            return row.label;
    case "internal_imp":     return row.internal.imp;
    case "internal_cpm":     return calcCpm(row.internal.revenue, row.internal.imp);
    case "internal_revenue": return row.internal.revenue;
    case "external_imp":     return row.external.imp;
    case "external_cpm":     return calcCpm(row.external.revenue, row.external.imp);
    case "external_revenue": return row.external.revenue;
    case "total_imp":        return row.total.imp;
    case "total_revenue":    return row.total.revenue;
  }
}

// ---------------------------------------------------------------------------
// Sort icon
// ---------------------------------------------------------------------------

function SortIcon({
  field,
  sort,
}: {
  field: ExternalSortField;
  sort: SortState<ExternalSortField>;
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
  field: ExternalSortField;
  sort: SortState<ExternalSortField>;
  onSort: (f: ExternalSortField) => void;
  children: React.ReactNode;
  className?: string;
  align?: "left" | "center" | "right";
}

function Th({ field, sort, onSort, children, className, align = "center" }: ThProps) {
  const isActive = sort.field === field && sort.direction !== "none";
  return (
    <th
      className={cn(
        TABLE_TH_CLASS,
        isActive && "text-blue-600",
        className,
      )}
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
        <span>{children}</span>
        <SortIcon field={field} sort={sort} />
      </div>
    </th>
  );
}

// ---------------------------------------------------------------------------
// Group colors
// ---------------------------------------------------------------------------

const GROUP_COLORS = {
  internal: { header: "bg-blue-50 text-blue-700", cell: "text-blue-700" },
  external: { header: "bg-orange-50 text-orange-700", cell: "text-orange-700" },
  total: { header: "bg-green-50 text-green-700", cell: "text-green-700" },
} as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ExternalTableProps {
  rows: ExternalCombinedRow[];
}

/**
 * Combined data table showing internal, external, and total metrics.
 * Each section shows: impressions, CPM, revenue.
 * Color-coded column groups with sortable headers.
 * Default sort: date descending (most recent first).
 */
export default function ExternalTable({ rows }: ExternalTableProps) {
  const [sort, setSort] = useState<SortState<ExternalSortField>>({
    field: "date",
    direction: "desc",
  });
  const [filterLabel, setFilterLabel] = useState<string | null>(null);

  const handleSort = (field: ExternalSortField) => {
    setSort((prev) => cycleSortDirection(prev, field));
  };

  const handleLabelClick = useCallback((label: string) => {
    setFilterLabel((prev) => (prev === label ? null : label));
  }, []);

  const filteredRows = useMemo(() => {
    if (!filterLabel) return rows;
    return rows.filter((r) => r.label === filterLabel);
  }, [rows, filterLabel]);

  const sortedRows = useMemo(() => {
    if (!sort.field || sort.direction === "none") {
      return [...filteredRows].sort((a, b) => b.date.localeCompare(a.date));
    }
    const multiplier = sort.direction === "asc" ? 1 : -1;
    return [...filteredRows].sort((a, b) =>
      compareNullable(
        getSortKey(a, sort.field!),
        getSortKey(b, sort.field!),
        multiplier as 1 | -1,
      ),
    );
  }, [filteredRows, sort]);

  if (rows.length === 0) {
    return (
      <div className={EMPTY_STATE_CLASS} style={{ height: 160 }}>
        데이터가 없습니다
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {filterLabel && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">필터:</span>
          <button
            onClick={() => setFilterLabel(null)}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-medium border border-blue-200 hover:bg-blue-100 transition-colors"
          >
            {filterLabel}
            <X className="w-3 h-3" />
          </button>
          <span className="text-xs text-gray-400 tabular-nums">
            {sortedRows.length}/{rows.length}건
          </span>
        </div>
      )}
      <div className="flex-1 overflow-auto rounded-xl border border-border shadow-sm">
      <table className="w-max min-w-full border-collapse text-sm">
        <thead className={TABLE_THEAD_CLASS}>
          {/* Group header row */}
          <tr className="border-b border-gray-100">
            <th
              colSpan={3}
              className="py-2 px-2 text-center text-[11px] font-semibold text-gray-500 uppercase tracking-wide"
            >
              기본 정보
            </th>
            <th
              colSpan={3}
              className={cn(
                "py-2 px-2 text-center text-[11px] font-semibold uppercase tracking-wide",
                GROUP_COLORS.internal.header,
              )}
            >
              내부
            </th>
            <th
              colSpan={3}
              className={cn(
                "py-2 px-2 text-center text-[11px] font-semibold uppercase tracking-wide",
                GROUP_COLORS.external.header,
              )}
            >
              외부
            </th>
            <th
              colSpan={2}
              className={cn(
                "py-2 px-2 text-center text-[11px] font-semibold uppercase tracking-wide",
                GROUP_COLORS.total.header,
              )}
            >
              전체
            </th>
          </tr>
          {/* Column header row */}
          <tr className="border-b border-gray-200">
            <Th field="date" sort={sort} onSort={handleSort} className="w-28 whitespace-nowrap">
              날짜
            </Th>
            <Th field="source" sort={sort} onSort={handleSort} className="w-20">
              Company
            </Th>
            <Th field="label" sort={sort} onSort={handleSort} className="min-w-[180px]">
              지면
            </Th>
            {/* Internal: 노출수 → CPM → 매출 */}
            <Th field="internal_imp" sort={sort} onSort={handleSort} align="right" className="text-blue-600">
              노출수
            </Th>
            <Th field="internal_cpm" sort={sort} onSort={handleSort} align="right" className="text-blue-600">
              CPM
            </Th>
            <Th field="internal_revenue" sort={sort} onSort={handleSort} align="right" className="text-blue-600">
              매출
            </Th>
            {/* External: 노출수 → CPM → 매출 */}
            <Th field="external_imp" sort={sort} onSort={handleSort} align="right" className="text-orange-600">
              노출수
            </Th>
            <Th field="external_cpm" sort={sort} onSort={handleSort} align="right" className="text-orange-600">
              CPM
            </Th>
            <Th field="external_revenue" sort={sort} onSort={handleSort} align="right" className="text-orange-600">
              매출
            </Th>
            {/* Total */}
            <Th field="total_imp" sort={sort} onSort={handleSort} align="right" className="text-green-600">
              노출수
            </Th>
            <Th field="total_revenue" sort={sort} onSort={handleSort} align="right" className="text-green-600">
              매출
            </Th>
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row, idx) => (
            <tr
              key={`${row.date}-${row.label}-${idx}`}
              className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
            >
              <td className={cn(TABLE_TD_CLASS, "text-center text-gray-700 font-mono text-xs tabular-nums whitespace-nowrap")}>
                {row.date}
              </td>
              <td className={cn(TABLE_TD_CLASS, "text-center")}>
                <span
                  className={cn(
                    "inline-block px-1.5 py-0.5 rounded text-[0.65rem] font-bold border",
                    row.source === "klmedia"
                      ? "bg-sky-50 text-sky-700 border-sky-200"
                      : "bg-purple-50 text-purple-700 border-purple-200",
                  )}
                >
                  {row.source === "klmedia" ? "KL" : "Sync"}
                </span>
              </td>
              <td
                className={cn(TABLE_TD_CLASS, "text-center text-sm truncate max-w-[260px]")}
                title={row.label || row.date}
              >
                <button
                  onClick={() => handleLabelClick(row.label)}
                  className={cn(
                    "hover:underline hover:text-blue-600 cursor-pointer transition-colors",
                    filterLabel === row.label ? "text-blue-600 font-semibold" : "text-gray-900",
                  )}
                >
                  {row.label || row.date}
                </button>
              </td>
              {/* Internal: 노출수 → CPM → 매출 */}
              <td className={cn(TABLE_TD_CLASS, "text-right tabular-nums", GROUP_COLORS.internal.cell)}>
                {formatNumberForDisplay(row.internal.imp)}
              </td>
              <td className={cn(TABLE_TD_CLASS, "text-right tabular-nums text-xs", GROUP_COLORS.internal.cell)}>
                {formatCpm(row.internal.revenue, row.internal.imp)}
              </td>
              <td className={cn(TABLE_TD_CLASS, "text-right tabular-nums", GROUP_COLORS.internal.cell)}>
                {formatNumberForDisplay(row.internal.revenue)}
              </td>
              {/* External: 노출수 → CPM → 매출 */}
              <td className={cn(TABLE_TD_CLASS, "text-right tabular-nums", GROUP_COLORS.external.cell)}>
                {formatNumberForDisplay(row.external.imp)}
              </td>
              <td className={cn(TABLE_TD_CLASS, "text-right tabular-nums text-xs", GROUP_COLORS.external.cell)}>
                {formatCpm(row.external.revenue, row.external.imp)}
              </td>
              <td className={cn(TABLE_TD_CLASS, "text-right tabular-nums", GROUP_COLORS.external.cell)}>
                {formatNumberForDisplay(row.external.revenue)}
              </td>
              {/* Total */}
              <td className={cn(TABLE_TD_CLASS, "text-right tabular-nums font-medium", GROUP_COLORS.total.cell)}>
                {formatNumberForDisplay(row.total.imp)}
              </td>
              <td className={cn(TABLE_TD_CLASS, "text-right tabular-nums font-medium", GROUP_COLORS.total.cell)}>
                {formatNumberForDisplay(row.total.revenue)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </div>
  );
}
