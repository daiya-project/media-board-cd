"use client";

import { cn } from "@/lib/utils";
import { getRowSelectionClass } from "@/lib/utils/table-display-utils";
import type { BoardTrendItem } from "@/types/app-db.types";
import type { TrendMetric } from "@/lib/logic/boardLogic";

// ---------------------------------------------------------------------------
// Format helpers
// ---------------------------------------------------------------------------

function fmtValue(value: number, metric: TrendMetric): string {
  if (metric === "mfr") return `${value.toFixed(1)}%`;
  return Math.round(value).toLocaleString("ko-KR");
}

function fmtChangeRate(rate: number, metric: TrendMetric): string {
  const sign = rate >= 0 ? "+" : "";
  if (metric === "mfr") return `${sign}${rate.toFixed(1)}pp`;
  return `${sign}${rate.toFixed(1)}%`;
}

// ---------------------------------------------------------------------------
// TrendList
// ---------------------------------------------------------------------------

interface TrendListProps {
  items: BoardTrendItem[];
  metric: TrendMetric;
  direction: "up" | "down";
  onDirectionChange: (d: "up" | "down") => void;
  selectedServiceId: string | null;
  onServiceSelect: (serviceId: string | null) => void;
}

/**
 * Displays a toggleable UP / DOWN trend list for a chart.
 * Clicking a service selects it to isolate on the chart; clicking again deselects.
 *
 * @param items              - Trend items (up to 10) from calcTrendList()
 * @param metric             - The metric type for value formatting
 * @param direction          - Current direction ("up" | "down")
 * @param onDirectionChange  - Handler to switch direction
 * @param selectedServiceId  - Currently selected service_id, or null
 * @param onServiceSelect    - Handler for service selection toggle
 */
export default function TrendList({
  items,
  metric,
  direction,
  onDirectionChange,
  selectedServiceId,
  onServiceSelect,
}: TrendListProps) {
  const isUp = direction === "up";

  function handleItemClick(serviceId: string) {
    onServiceSelect(selectedServiceId === serviceId ? null : serviceId);
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Direction tab */}
      <div className="flex rounded-lg overflow-hidden border border-gray-200 text-xs font-semibold w-fit">
        <button
          onClick={() => {
            onDirectionChange("up");
            if (direction !== "up") onServiceSelect(null);
          }}
          className={cn(
            "px-3 py-1.5 transition-colors",
            isUp
              ? "bg-red-500 text-white"
              : "bg-white text-gray-500 hover:bg-gray-50",
          )}
        >
          UP ▲
        </button>
        <button
          onClick={() => {
            onDirectionChange("down");
            if (direction !== "down") onServiceSelect(null);
          }}
          className={cn(
            "px-3 py-1.5 transition-colors",
            !isUp
              ? "bg-blue-500 text-white"
              : "bg-white text-gray-500 hover:bg-gray-50",
          )}
        >
          DOWN ▼
        </button>
      </div>

      {/* Items */}
      <div className="space-y-1">
        {items.length === 0 ? (
          <p className="text-xs text-gray-400 py-2">항목 없음</p>
        ) : (
          items.map((item) => {
            const isSelected = selectedServiceId === item.service_id;
            const rateColor = item.changeRate > 0 ? "text-red-500" : "text-blue-500";

            return (
              <button
                key={item.service_id}
                onClick={() => handleItemClick(item.service_id)}
                className={cn(
                  "w-full text-left rounded-lg px-3 py-2 transition-all",
                  getRowSelectionClass(isSelected),
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-semibold text-gray-700 truncate">
                      {item.service_id}. {item.service_name}
                    </div>
                    <div className="text-[10px] text-gray-400 mt-0.5">
                      {fmtValue(item.latestValue, metric)} / {fmtValue(item.previousValue, metric)}
                    </div>
                  </div>
                  <span
                    className={cn(
                      "text-sm font-bold font-mono tabular-nums flex-shrink-0",
                      rateColor,
                    )}
                  >
                    {fmtChangeRate(item.changeRate, metric)}
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
