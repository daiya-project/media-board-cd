"use client";

import { Slider } from "@/components/ui/slider";
import type { PeriodType } from "@/lib/logic/boardLogic";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

/**
 * Slider configuration per period type.
 * min/max define the range of periods shown; label formats the current value.
 */
export const PERIOD_SLIDER_CONFIG: Record<
  PeriodType,
  { min: number; max: number; label: (n: number) => string }
> = {
  daily:   { min: 7,  max: 90,  label: (n) => `${n}일` },
  weekly:  { min: 4,  max: 52,  label: (n) => `${n}주` },
  monthly: { min: 2,  max: 12,  label: (n) => `${n}개월` },
};

// ---------------------------------------------------------------------------
// PeriodRangeSlider
// ---------------------------------------------------------------------------

interface PeriodRangeSliderProps {
  periodType: PeriodType;
  value: number;
  onChange: (n: number) => void;
  /**
   * Override the slider max (e.g. while data is loading).
   * Clamped to [config.min, config.max].
   */
  maxOverride?: number;
  sliderClassName?: string;
}

/**
 * Slider that controls how many periods (days / weeks / months) are displayed.
 * Reads min/max/label from PERIOD_SLIDER_CONFIG based on the current periodType.
 *
 * @param periodType      - Active period type (determines range and label format)
 * @param value           - Current slider value
 * @param onChange        - Callback when slider is moved
 * @param maxOverride     - Caps max (e.g. while streaming data loads)
 * @param sliderClassName - Additional class for the Slider element (default: "w-32")
 */
export default function PeriodRangeSlider({
  periodType,
  value,
  onChange,
  maxOverride,
  sliderClassName = "w-32",
}: PeriodRangeSliderProps) {
  const { min, max, label } = PERIOD_SLIDER_CONFIG[periodType];
  const effectiveMax =
    maxOverride != null ? Math.max(min, Math.min(max, maxOverride)) : max;

  return (
    <div className="flex items-center gap-2">
      <Slider
        min={min}
        max={effectiveMax}
        step={1}
        value={[Math.min(value, effectiveMax)]}
        onValueChange={([v]) => onChange(v)}
        className={sliderClassName}
      />
      <span className="text-xs font-semibold text-gray-700 w-10 tabular-nums">
        {label(value)}
      </span>
    </div>
  );
}
