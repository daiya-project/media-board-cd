"use client";

import { cn } from "@/lib/utils";
import {
  MA_METRICS,
  MA_METRIC_COLORS,
  type MaMetricType,
} from "@/lib/logic/maChartLogic";

interface MaMetricSelectorProps {
  selected: MaMetricType;
  onChange: (metric: MaMetricType) => void;
}

/**
 * Pill-style metric selector (Rev. / vIMP / MFR / vCTR / vRate).
 * Positioned at top-right of the chart card, matching the reference layout.
 */
export default function MaMetricSelector({
  selected,
  onChange,
}: MaMetricSelectorProps) {
  return (
    <div className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 p-0.5 text-xs font-semibold">
      {MA_METRICS.map(({ value, label }) => {
        const isActive = value === selected;
        return (
          <button
            key={value}
            onClick={() => onChange(value)}
            className={cn(
              "rounded-full px-3 py-1.5 transition-colors",
              isActive
                ? "bg-white shadow-sm"
                : "text-gray-500 hover:text-gray-700",
            )}
            style={isActive ? { color: MA_METRIC_COLORS[value] } : undefined}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
