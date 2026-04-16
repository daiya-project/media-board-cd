"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface MonthPickerProps {
  selectedMonth: string;
  latestMonth: string;
  onSelect: (month: string) => void;
  onClose: () => void;
}

/**
 * Dropdown month picker for YYYY-MM selection.
 * Allows navigating from 2025 up to the latest data month.
 */
export default function MonthPicker({ selectedMonth, latestMonth, onSelect, onClose }: MonthPickerProps) {
  const [pickerYear, setPickerYear] = useState(selectedMonth.slice(0, 4));
  const latestY = parseInt(latestMonth.slice(0, 4), 10);
  const latestM = parseInt(latestMonth.slice(5, 7), 10);

  const minYear = 2025;
  const maxYear = latestY;

  return (
    <div
      className="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-50 bg-white border border-border rounded-xl shadow-lg p-3 w-56"
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => setPickerYear(String(parseInt(pickerYear, 10) - 1))}
          disabled={parseInt(pickerYear, 10) <= minYear}
          className="p-1 rounded hover:bg-muted disabled:opacity-30"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        <span className="text-sm font-semibold">{pickerYear}</span>
        <button
          onClick={() => setPickerYear(String(parseInt(pickerYear, 10) + 1))}
          disabled={parseInt(pickerYear, 10) >= maxYear}
          className="p-1 rounded hover:bg-muted disabled:opacity-30"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-4 gap-1">
        {Array.from({ length: 12 }, (_, i) => {
          const mm = String(i + 1).padStart(2, "0");
          const monthKey = `${pickerYear}-${mm}`;
          const py = parseInt(pickerYear, 10);
          const isFuture = py > latestY || (py === latestY && (i + 1) > latestM);
          const isSelected = monthKey === selectedMonth;
          return (
            <button
              key={mm}
              disabled={isFuture}
              onClick={() => {
                onSelect(monthKey);
                onClose();
              }}
              className={cn(
                "py-1.5 text-xs rounded-lg font-medium transition-colors",
                isSelected && "bg-blue-600 text-white",
                !isSelected && !isFuture && "hover:bg-muted text-foreground",
                isFuture && "text-muted-foreground/30 cursor-default",
              )}
            >
              {mm}월
            </button>
          );
        })}
      </div>
    </div>
  );
}
