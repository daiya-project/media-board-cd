"use client";

import { cn } from "@/lib/utils";
import { formatNumberForDisplay } from "@/lib/utils/number-utils";
import { TABLE_TD_CLASS } from "@/lib/utils/table-display-utils";
import type { CvrRawRow, CvrPayload } from "@/types/app-db.types";

// ---------------------------------------------------------------------------
// Level badge (same palette as CvrTableMonthly)
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
// Helpers
// ---------------------------------------------------------------------------

function fmtInt(v: number | null): string {
  if (v == null) return "-";
  return formatNumberForDisplay(v);
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CvrTableYearlyProps {
  rows: CvrRawRow[];
  selectedMonth: string; // YYYY-MM
  pastMonthLevels: CvrPayload["pastMonthLevels"]; // ascending
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * CVR section yearly view table.
 *
 * Shows the past 13 months of level badges per service row.
 * The selectedMonth column is highlighted in amber.
 * Rows are fixed in vimp-descending order (no sort controls).
 *
 * Columns: Client (sticky) | Service (sticky) | vIMP | [13 month level columns]
 */
export default function CvrTableYearly({
  rows,
  selectedMonth,
  pastMonthLevels,
}: CvrTableYearlyProps) {
  // pastMonthLevels is ascending — display newest right (keep as-is for left→right oldest→newest)
  const months = pastMonthLevels.map((p) => p.month);

  return (
    <div className="flex-1 overflow-auto mx-4 mt-3 mb-4 rounded-xl border border-border shadow-sm">
      <table className="w-max min-w-full border-collapse text-sm">
        {/* ---------------------------------------------------------------- */}
        {/* HEADER                                                             */}
        {/* ---------------------------------------------------------------- */}
        <thead className="sticky top-0 z-10 bg-muted/50 border-b border-border shadow-sm backdrop-blur-sm">
          <tr>
            {/* Client (sticky) */}
            <th
              className="h-10 px-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide text-left bg-muted"
              style={STICKY_CLIENT_HEADER_STYLE}
            >
              Client
            </th>

            {/* Service (sticky + shadow) */}
            <th
              className="h-10 px-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide text-left bg-muted sticky-col-shadow"
              style={STICKY_SERVICE_HEADER_STYLE}
            >
              Service
            </th>

            {/* vIMP */}
            <th
              className="h-10 px-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide text-center whitespace-nowrap"
              style={{ minWidth: 90 }}
            >
              vIMP
            </th>

            {/* Month level columns */}
            {months.map((month) => {
              const isSelected = month === selectedMonth;
              return (
                <th
                  key={month}
                  className={cn(
                    "h-10 px-2 text-[11px] font-semibold text-muted-foreground tracking-wide text-center whitespace-nowrap",
                    isSelected && "bg-amber-50 text-amber-700",
                  )}
                  style={{ minWidth: 72 }}
                >
                  {month}
                </th>
              );
            })}
          </tr>
        </thead>

        {/* ---------------------------------------------------------------- */}
        {/* BODY                                                               */}
        {/* ---------------------------------------------------------------- */}
        <tbody>
          {rows.map((row) => {
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

                {/* vIMP (selected month) */}
                <td className={cn(TABLE_TD_CLASS, "text-center text-xs tabular-nums")}>
                  {fmtInt(row.vimp)}
                </td>

                {/* Month level badges */}
                {pastMonthLevels.map(({ month, levels }) => {
                  const isSelected = month === selectedMonth;
                  const level = levels[row.service_id] ?? null;
                  return (
                    <td
                      key={month}
                      className={cn(
                        TABLE_TD_CLASS,
                        "text-center",
                        isSelected && "bg-amber-50",
                      )}
                    >
                      <LevelBadge level={level} />
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
