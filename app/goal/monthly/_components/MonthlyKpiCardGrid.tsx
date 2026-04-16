"use client";

/**
 * 4-card KPI grid for the Goal Monthly page.
 *
 * Cards: 2mo ago | 1mo ago | current (actual) | current (projected)
 */

import { cn } from "@/lib/utils";
import { formatNumberForDisplay } from "@/lib/utils/number-utils";
import type { MonthlyKpiCard } from "@/types/app-db.types";

interface Props {
  cards: MonthlyKpiCard[];
}

export default function MonthlyKpiCardGrid({ cards }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div
          key={`${card.monthKey}-${card.isProjected}`}
          className={cn(
            "rounded-xl border p-4 space-y-2 shadow-sm hover:shadow-md transition-shadow",
            card.isProjected
              ? "border-blue-200 bg-blue-50/50"
              : "border-gray-200 bg-white",
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              {card.monthLabel}
            </span>
            {card.isProjected && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded-md">
                예상
              </span>
            )}
          </div>

          {/* vIMP value */}
          <p className="text-2xl font-extrabold text-gray-900 tabular-nums">
            {formatNumberForDisplay(card.vimp)}
          </p>

          {/* Change rate */}
          {card.vimpChangeRate !== null && (
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  "text-xs font-medium",
                  card.vimpChangeRate > 0
                    ? "text-green-600"
                    : card.vimpChangeRate < 0
                      ? "text-red-500"
                      : "text-gray-400",
                )}
              >
                {card.vimpChangeRate > 0 ? "+" : ""}
                {card.vimpChangeRate.toFixed(1)}%
              </span>
              <span className="text-[10px] text-gray-400">전월 대비</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
