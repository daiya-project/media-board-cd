"use client";

import { Eye, Banknote, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatNumberForDisplay } from "@/lib/utils/number-utils";
import type { ExternalSummary, SourceSummary } from "@/lib/logic/external-logic";

const SOURCE_LABELS: Record<string, string> = {
  klmedia: "KL",
  syncmedia: "Sync",
};

const kpiCards = [
  { key: "imp", label: "총 노출수", icon: Eye, color: "indigo", valueKey: "imp" as const },
  { key: "revenue", label: "총 매출", icon: Banknote, color: "emerald", valueKey: "revenue" as const },
  { key: "count", label: "지면 수", icon: LayoutGrid, color: "violet", valueKey: "labelCount" as const },
] as const;

const colorMap: Record<string, { bg: string; text: string }> = {
  indigo: { bg: "bg-indigo-50", text: "text-indigo-500" },
  emerald: { bg: "bg-emerald-50", text: "text-emerald-500" },
  violet: { bg: "bg-violet-50", text: "text-violet-500" },
};

/**
 * Summary KPI cards for external report page.
 * Each card shows total value on the left and per-source breakdown on the right.
 */
export default function SummaryCards({
  totalImp,
  totalRevenue,
  widgetCount,
  bySource,
}: ExternalSummary) {
  const totals: Record<string, string> = {
    imp: formatNumberForDisplay(totalImp),
    revenue: `₩${formatNumberForDisplay(totalRevenue)}`,
    count: String(widgetCount),
  };

  const sources = Object.entries(bySource);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {kpiCards.map((card) => {
        const Icon = card.icon;
        const colors = colorMap[card.color];
        return (
          <div
            key={card.key}
            className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between">
              {/* Left: icon + label + total */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <div className={cn("flex items-center justify-center w-8 h-8 rounded-lg", colors.bg)}>
                    <Icon className={cn("w-4 h-4", colors.text)} />
                  </div>
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    {card.label}
                  </span>
                </div>
                <span className="text-2xl font-extrabold text-gray-900 tabular-nums">
                  {totals[card.key]}
                </span>
              </div>

              {/* Right: per-source breakdown */}
              {sources.length > 0 && (
                <div className="flex flex-col gap-1.5 items-end">
                  {sources.map(([source, data]: [string, SourceSummary]) => (
                    <div key={source} className="flex items-center gap-2">
                      <span
                        className={cn(
                          "inline-block px-1.5 py-0.5 rounded text-[0.6rem] font-bold border",
                          source === "klmedia"
                            ? "bg-sky-50 text-sky-700 border-sky-200"
                            : "bg-purple-50 text-purple-700 border-purple-200",
                        )}
                      >
                        {SOURCE_LABELS[source] ?? source}
                      </span>
                      <span className="text-xs text-gray-600 tabular-nums font-medium">
                        {card.key === "revenue"
                          ? `₩${formatNumberForDisplay(data[card.valueKey])}`
                          : formatNumberForDisplay(data[card.valueKey])}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
