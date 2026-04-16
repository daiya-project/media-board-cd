/**
 * ChartTooltip — shared tooltip for Recharts charts.
 *
 * Layout: two-column grid — left: color bullet + label, right: formatted value.
 * Pass as the `content` prop of a Recharts <Tooltip /> element via a wrapper.
 *
 * Value formatting:
 *   - string  → rendered as-is (pre-formatted, e.g. "3.45%")
 *   - number  → comma-separated integer via formatNumberForDisplay
 */

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { formatNumberForDisplay } from "@/lib/utils";

export interface ChartTooltipItem {
  /** Bullet / line color (hex or rgb). */
  color: string;
  /** Row label (e.g. "Ad Revenue", "vIMP"). */
  label: string;
  /** Value: number → formatted with formatNumberForDisplay, string → as-is. */
  value: string | number;
  /** Optional Tailwind class applied to the value cell (e.g. text color). */
  valueClassName?: string;
}

export interface ChartTooltipProps {
  /** Rows to display. */
  items: ChartTooltipItem[];
  /** Optional header above the rows (string or React node). */
  title?: ReactNode;
  /** Extra className on the container. */
  className?: string;
}

/**
 * Renders a styled tooltip card for Recharts charts.
 *
 * @param items     - Array of {color, label, value} rows
 * @param title     - Optional header text shown above the rows
 * @param className - Additional container classes
 */
export function ChartTooltip({ items, title, className }: ChartTooltipProps) {
  if (items.length === 0) return null;

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-white px-4 py-3 shadow-md",
        className,
      )}
      role="tooltip"
    >
      {title && (
        <div className="mb-2 text-xs font-medium text-gray-500">{title}</div>
      )}
      <div className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 items-center">
        {items.flatMap((item, i) => [
          <div key={`${i}-legend`} className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: item.color }}
              aria-hidden
            />
            <span className="text-sm text-gray-600">{item.label}</span>
          </div>,
          <div
            key={`${i}-value`}
            className={cn(
              "min-w-[6rem] text-right text-sm font-semibold tabular-nums text-gray-900",
              item.valueClassName,
            )}
          >
            {formatNumberForDisplay(item.value)}
          </div>,
        ])}
      </div>
    </div>
  );
}
