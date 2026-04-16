"use client";

/**
 * 13-month client vIMP table for the Goal Monthly page.
 *
 * Columns: Client Name | Projected | Month1 (newest) | ... | Month13 (oldest)
 * Sorted by current month vIMP descending. Includes a totals row.
 */

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { formatNumberForDisplay } from "@/lib/utils/number-utils";
import type { ClientMonthlyVimpRow } from "@/types/app-db.types";
import { EmptyState } from "@/components/common/EmptyState";

interface Props {
  months: string[]; // 13 month keys (newest → oldest)
  rows: ClientMonthlyVimpRow[];
}

/**
 * Formats "YYYY-MM" to "2026년 03월" label.
 */
function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-");
  return `${year}년 ${month}월`;
}

export default function ClientMonthlyVimpTable({ months, rows }: Props) {
  const monthLabels = useMemo(
    () => months.map((m) => formatMonthLabel(m)),
    [months],
  );

  // Compute totals
  const totals = useMemo(() => {
    const projectedTotal = rows.reduce(
      (sum, r) => sum + (r.projectedVimp ?? 0),
      0,
    );
    const monthTotals = months.map((_, idx) =>
      rows.reduce((sum, r) => sum + (r.months[idx] ?? 0), 0),
    );
    return { projectedTotal, monthTotals };
  }, [rows, months]);

  if (rows.length === 0) {
    return <EmptyState message="데이터가 없습니다" />;
  }

  return (
    <div className="overflow-x-auto border border-gray-200 rounded-xl">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wide text-gray-500 whitespace-nowrap sticky left-0 bg-gray-50 z-10 min-w-[140px]">
              매체사
            </th>
            <th className="px-3 py-3 text-center text-[11px] font-semibold uppercase tracking-wide text-blue-600 whitespace-nowrap min-w-[100px]">
              예상
            </th>
            {monthLabels.map((label, idx) => (
              <th
                key={months[idx]}
                className={cn(
                  "px-3 py-3 text-center text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap min-w-[120px]",
                  idx === 0 ? "text-gray-800" : "text-gray-500",
                )}
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {/* Totals row */}
          <tr className="border-b-2 border-gray-300 bg-gray-50 font-semibold">
            <td className="px-4 py-2.5 text-gray-900 whitespace-nowrap sticky left-0 bg-gray-50 z-10">
              합계
            </td>
            <td className="px-3 py-2.5 text-right text-blue-700 tabular-nums">
              {totals.projectedTotal > 0
                ? formatNumberForDisplay(totals.projectedTotal)
                : "—"}
            </td>
            {totals.monthTotals.map((total, idx) => (
              <td
                key={months[idx]}
                className={cn(
                  "px-3 py-2.5 text-right tabular-nums",
                  idx === 0 ? "text-gray-900" : "text-gray-600",
                )}
              >
                {total > 0 ? formatNumberForDisplay(total) : "—"}
              </td>
            ))}
          </tr>

          {rows.map((row) => (
            <tr
              key={row.client_id}
              className="border-b border-gray-100 hover:bg-gray-50/50"
            >
              <td className="px-4 py-2.5 font-medium text-gray-800 whitespace-nowrap sticky left-0 bg-white z-10">
                {row.client_name}
              </td>
              <td className="px-3 py-2.5 text-right text-blue-600 font-medium tabular-nums">
                {row.projectedVimp
                  ? formatNumberForDisplay(row.projectedVimp)
                  : "—"}
              </td>
              {row.months.map((vimp, idx) => (
                <td
                  key={months[idx]}
                  className={cn(
                    "px-3 py-2.5 text-right tabular-nums",
                    idx === 0 ? "text-gray-800" : "text-gray-500",
                  )}
                >
                  {vimp > 0 ? formatNumberForDisplay(vimp) : "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
