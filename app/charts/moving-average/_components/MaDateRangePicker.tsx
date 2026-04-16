"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { MA_DATE_RANGES, type MaDateRange } from "@/lib/logic/maChartLogic";

interface MaDateRangePickerProps {
  selected: MaDateRange;
  customRange: { from: string; to: string } | null;
  onChange: (range: MaDateRange) => void;
  onCustomChange: (range: { from: string; to: string } | null) => void;
}

/**
 * Date range selector: 15d | 30d | 90d | ETC pill buttons.
 * ETC opens a popover with from/to date inputs.
 */
export default function MaDateRangePicker({
  selected,
  customRange,
  onChange,
  onCustomChange,
}: MaDateRangePickerProps) {
  const [showPopover, setShowPopover] = useState(false);
  const [tempFrom, setTempFrom] = useState(customRange?.from ?? "");
  const [tempTo, setTempTo] = useState(customRange?.to ?? "");
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close popover on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        setShowPopover(false);
      }
    }
    if (showPopover) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [showPopover]);

  function handlePreset(range: MaDateRange) {
    if (range === "custom") {
      setTempFrom(customRange?.from ?? "");
      setTempTo(customRange?.to ?? "");
      setShowPopover(true);
    } else {
      setShowPopover(false);
      onCustomChange(null);
      onChange(range);
    }
  }

  function handleConfirm() {
    if (tempFrom && tempTo && tempFrom <= tempTo) {
      onCustomChange({ from: tempFrom, to: tempTo });
      onChange("custom");
      setShowPopover(false);
    }
  }

  return (
    <div className="relative inline-flex items-center">
      <div className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 p-0.5 text-xs font-semibold">
        {MA_DATE_RANGES.map(({ value, label }) => {
          const isActive = value === selected;
          return (
            <button
              key={value}
              onClick={() => handlePreset(value)}
              className={cn(
                "rounded-full px-2.5 py-1 transition-colors min-w-[32px]",
                isActive
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700",
              )}
            >
              {label}
            </button>
          );
        })}
      </div>

      {showPopover && (
        <div
          ref={popoverRef}
          className="absolute top-full left-0 z-50 mt-2 rounded-lg border border-gray-200 bg-white p-3 shadow-lg"
        >
          <div className="flex items-center gap-2 text-xs">
            <input
              type="date"
              value={tempFrom}
              onChange={(e) => setTempFrom(e.target.value)}
              className="rounded border border-gray-300 px-2 py-1"
            />
            <span className="text-gray-400">~</span>
            <input
              type="date"
              value={tempTo}
              onChange={(e) => setTempTo(e.target.value)}
              className="rounded border border-gray-300 px-2 py-1"
            />
            <button
              onClick={handleConfirm}
              disabled={!tempFrom || !tempTo || tempFrom > tempTo}
              className="rounded bg-blue-600 px-3 py-1 text-white disabled:opacity-40"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
