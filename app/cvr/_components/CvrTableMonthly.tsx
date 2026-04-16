"use client";

import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatNumberForDisplay } from "@/lib/utils/number-utils";
import { addMonths } from "@/lib/utils/date-utils";
import { TABLE_TD_CLASS } from "@/lib/utils/table-display-utils";
import type { SortState } from "@/lib/utils/sort-utils";
import type { CvrRawRow, CvrSortField } from "@/types/app-db.types";

// ---------------------------------------------------------------------------
// Level badge
// ---------------------------------------------------------------------------

const LEVEL_BADGE_CLASS: Record<string, string> = {
  A: "bg-lime-200 text-lime-800",
  B: "bg-blue-200 text-blue-800",
  C: "bg-amber-200 text-amber-800",
  D: "bg-red-200 text-red-800",
  E: "bg-violet-200 text-violet-800",
  F: "bg-muted text-muted-foreground",
};

function LevelBadge({ level }: { level: string | null }) {
  if (!level) {
    return <span className="text-muted-foreground/30">-</span>;
  }
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold",
        LEVEL_BADGE_CLASS[level] ?? "bg-muted text-muted-foreground",
      )}
    >
      {level}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Sort icon
// ---------------------------------------------------------------------------

function SortIcon({
  field,
  sort,
}: {
  field: CvrSortField;
  sort: SortState<CvrSortField>;
}) {
  if (sort.field !== field)
    return <ChevronsUpDown className="w-3 h-3 text-muted-foreground/40 ml-0.5 shrink-0" />;
  if (sort.direction === "asc")
    return <ChevronUp className="w-3 h-3 text-blue-600 ml-0.5 shrink-0" />;
  if (sort.direction === "desc")
    return <ChevronDown className="w-3 h-3 text-blue-600 ml-0.5 shrink-0" />;
  return <ChevronsUpDown className="w-3 h-3 text-muted-foreground/40 ml-0.5 shrink-0" />;
}

// ---------------------------------------------------------------------------
// Sortable header cell
// ---------------------------------------------------------------------------

interface ThProps {
  field: CvrSortField;
  sort: SortState<CvrSortField>;
  onSort: (f: CvrSortField) => void;
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
        "h-10 px-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide",
        "cursor-pointer select-none hover:text-foreground transition-colors whitespace-nowrap",
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
// Number formatting helpers
// ---------------------------------------------------------------------------

/** Format integer with comma separators. */
function fmtInt(v: number | null): string {
  if (v == null) return "-";
  return formatNumberForDisplay(v);
}

/** Format a _pct column value as "XX.XX%" — values are already stored in percentage form. */
function fmtPct(v: number | null): string {
  if (v == null) return "-";
  return `${v.toFixed(2)}%`;
}

// ---------------------------------------------------------------------------
// Sticky column styles
// ---------------------------------------------------------------------------

const CLIENT_WIDTH = 200;
const SERVICE_WIDTH = 180;

const STICKY_CLIENT_STYLE: React.CSSProperties = {
  position: "sticky",
  left: 0,
  width: CLIENT_WIDTH,
  minWidth: CLIENT_WIDTH,
  maxWidth: CLIENT_WIDTH,
  zIndex: 2,
};

const STICKY_CLIENT_HEADER_STYLE: React.CSSProperties = { ...STICKY_CLIENT_STYLE, zIndex: 20 };

const STICKY_SERVICE_STYLE: React.CSSProperties = {
  position: "sticky",
  left: CLIENT_WIDTH,
  width: SERVICE_WIDTH,
  minWidth: SERVICE_WIDTH,
  maxWidth: SERVICE_WIDTH,
  zIndex: 2,
};

const STICKY_SERVICE_HEADER_STYLE: React.CSSProperties = { ...STICKY_SERVICE_STYLE, zIndex: 20 };

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CvrTableMonthlyProps {
  rows: CvrRawRow[];
  prevLevels: Record<string, string | null>;
  selectedMonth: string; // YYYY-MM
  sort: SortState<CvrSortField>;
  onSort: (field: CvrSortField) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * CVR section monthly view table.
 *
 * Columns (left to right):
 *   Client (sticky) | Service (sticky) | vIMP | Level(current) | Level(prev) |
 *   CMR | CVR | Type | Revenue | RPM | vCTR | CPC | Invalid | Campaign
 */
export default function CvrTableMonthly({
  rows,
  prevLevels,
  selectedMonth,
  sort,
  onSort,
}: CvrTableMonthlyProps) {
  const thProps = { sort, onSort };

  // Previous month label for column header
  const prevMonth = addMonths(selectedMonth, -1);

  return (
    <div className="flex-1 overflow-auto mx-4 mt-3 mb-4 rounded-xl border border-border shadow-sm">
      <table className="w-max min-w-full border-collapse text-sm">
        {/* ---------------------------------------------------------------- */}
        {/* HEADER                                                             */}
        {/* ---------------------------------------------------------------- */}
        <thead className="sticky top-0 z-10 bg-muted/50 border-b border-border shadow-sm backdrop-blur-sm">
          <tr>
            {/* Client (sticky) */}
            <Th
              {...thProps}
              field="client"
              style={STICKY_CLIENT_HEADER_STYLE}
              className="bg-muted text-left"
              align="left"
            >
              Client
            </Th>

            {/* Service (sticky + shadow) */}
            <Th
              {...thProps}
              field="service"
              style={STICKY_SERVICE_HEADER_STYLE}
              className="bg-muted sticky-col-shadow text-left"
              align="left"
            >
              Service
            </Th>

            {/* Metric columns */}
            <Th {...thProps} field="vimp" style={{ minWidth: 90 }}>
              vIMP
            </Th>
            <Th {...thProps} field="level" style={{ minWidth: 72 }}>
              {selectedMonth}
            </Th>
            <Th {...thProps} field="prevLevel" style={{ minWidth: 72 }}>
              {prevMonth}
            </Th>
            <Th {...thProps} field="cmr" style={{ minWidth: 72 }} align="right">
              CMR
            </Th>
            <Th {...thProps} field="cvr" style={{ minWidth: 72 }} align="right">
              CVR
            </Th>
            <Th {...thProps} field="serviceType" style={{ minWidth: 100 }} align="left">
              Type
            </Th>
            <Th {...thProps} field="revenue" style={{ minWidth: 90 }} align="right">
              Revenue
            </Th>
            <Th {...thProps} field="rpm" style={{ minWidth: 70 }} align="right">
              RPM
            </Th>
            <Th {...thProps} field="vctr" style={{ minWidth: 70 }} align="right">
              vCTR
            </Th>
            <Th {...thProps} field="cpc" style={{ minWidth: 70 }} align="right">
              CPC
            </Th>
            <Th {...thProps} field="invalidRate" style={{ minWidth: 72 }} align="right">
              Invalid
            </Th>
            <Th {...thProps} field="campaign" style={{ minWidth: 80 }} align="right">
              Campaign
            </Th>
          </tr>
        </thead>

        {/* ---------------------------------------------------------------- */}
        {/* BODY                                                               */}
        {/* ---------------------------------------------------------------- */}
        <tbody>
          {rows.map((row) => {
            const prevLevel = prevLevels[row.service_id] ?? null;
            return (
              <tr
                key={`${row.client_id}-${row.service_id}`}
                className="border-b border-border/50 hover:bg-muted/30 transition-colors"
              >
                {/* Client (sticky) */}
                <td
                  className={cn(TABLE_TD_CLASS, "bg-white")}
                  style={STICKY_CLIENT_STYLE}
                >
                  <div className="truncate text-xs font-medium text-foreground/80">
                    {row.client_id}
                  </div>
                </td>

                {/* Service (sticky + shadow) */}
                <td
                  className={cn(TABLE_TD_CLASS, "bg-white sticky-col-shadow")}
                  style={STICKY_SERVICE_STYLE}
                >
                  <div className="truncate text-xs text-foreground/70">
                    {row.service_name ?? row.service_id}
                  </div>
                </td>

                {/* vIMP */}
                <td className={cn(TABLE_TD_CLASS, "text-center text-xs tabular-nums")}>
                  {fmtInt(row.vimp)}
                </td>

                {/* Level (current month) */}
                <td className={cn(TABLE_TD_CLASS, "text-center")}>
                  <LevelBadge level={row.level} />
                </td>

                {/* Level (prev month) */}
                <td className={cn(TABLE_TD_CLASS, "text-center")}>
                  <LevelBadge level={prevLevel} />
                </td>

                {/* CMR */}
                <td className={cn(TABLE_TD_CLASS, "text-right text-xs tabular-nums")}>
                  {fmtPct(row.contribution_margin_rate_pct)}
                </td>

                {/* CVR */}
                <td className={cn(TABLE_TD_CLASS, "text-right text-xs tabular-nums")}>
                  {fmtPct(row.normalized_cvr_pct)}
                </td>

                {/* Type */}
                <td className={cn(TABLE_TD_CLASS, "text-xs text-foreground/60")}>
                  {row.service_type ?? "-"}
                </td>

                {/* Revenue */}
                <td className={cn(TABLE_TD_CLASS, "text-right text-xs tabular-nums")}>
                  {fmtInt(row.revenue)}
                </td>

                {/* RPM */}
                <td className={cn(TABLE_TD_CLASS, "text-right text-xs tabular-nums")}>
                  {fmtInt(row.rpm)}
                </td>

                {/* vCTR */}
                <td className={cn(TABLE_TD_CLASS, "text-right text-xs tabular-nums")}>
                  {fmtPct(row.vctr_pct)}
                </td>

                {/* CPC */}
                <td className={cn(TABLE_TD_CLASS, "text-right text-xs tabular-nums")}>
                  {fmtInt(row.cpc)}
                </td>

                {/* Invalid */}
                <td className={cn(TABLE_TD_CLASS, "text-right text-xs tabular-nums")}>
                  {fmtPct(row.invalid_revenue_ratio_pct)}
                </td>

                {/* Campaign */}
                <td className={cn(TABLE_TD_CLASS, "text-right text-xs tabular-nums")}>
                  {fmtInt(row.campaign_count)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
