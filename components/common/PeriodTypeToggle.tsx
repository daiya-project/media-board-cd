"use client";

import { cn } from "@/lib/utils";
import type { PeriodType } from "@/lib/logic/boardLogic";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export const PERIOD_OPTIONS: { value: PeriodType; label: string }[] = [
  { value: "monthly", label: "월" },
  { value: "weekly", label: "주" },
  { value: "daily", label: "일" },
];

// ---------------------------------------------------------------------------
// Variants
// ---------------------------------------------------------------------------

/**
 * "default" — white card background (Dashboard, Charts).
 * "dense"   — dark filter bar background (DataFilters).
 */
type Variant = "default" | "dense";

const CONTAINER_CLS: Record<Variant, string> = {
  default: "flex items-center gap-0.5 bg-gray-100 rounded-lg p-1",
  dense:
    "flex items-center gap-1 rounded-xl bg-[#e7ecf3] p-1",
};

const BUTTON_BASE_CLS: Record<Variant, string> = {
  default:
    "px-3.5 py-1.5 text-sm font-medium rounded-md transition-colors",
  dense:
    "h-9 min-w-10 rounded-lg border border-transparent px-3 text-xs font-semibold transition-colors",
};

const BUTTON_ACTIVE_CLS: Record<Variant, string> = {
  default: "bg-white shadow-sm text-gray-900",
  dense:
    "border-slate-200 bg-white text-[#2563eb] shadow-[0_1px_2px_rgba(15,23,42,0.08)]",
};

const BUTTON_INACTIVE_CLS: Record<Variant, string> = {
  default: "text-gray-500 hover:text-gray-700",
  dense: "text-slate-500 hover:text-slate-700",
};

// ---------------------------------------------------------------------------
// PeriodTypeToggle
// ---------------------------------------------------------------------------

interface PeriodTypeToggleProps {
  value: PeriodType;
  onChange: (type: PeriodType) => void;
  variant?: Variant;
  className?: string;
}

/**
 * 월 / 주 / 일 period type toggle.
 *
 * @param value    - Currently selected period type
 * @param onChange - Callback when a period type is selected
 * @param variant  - "default" (gray pill) or "dense" (blue-tinted pill for filter bars)
 */
export default function PeriodTypeToggle({
  value,
  onChange,
  variant = "default",
  className,
}: PeriodTypeToggleProps) {
  return (
    <div className={cn(CONTAINER_CLS[variant], className)}>
      {PERIOD_OPTIONS.map(({ value: v, label }) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={cn(
            BUTTON_BASE_CLS[variant],
            value === v
              ? BUTTON_ACTIVE_CLS[variant]
              : BUTTON_INACTIVE_CLS[variant],
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
