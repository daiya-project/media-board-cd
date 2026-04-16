"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { useModalStore } from "@/stores/useModalStore";

// ---------------------------------------------------------------------------
// Level definitions
// ---------------------------------------------------------------------------

const LEVELS = ["A", "B", "C", "D", "E", "F"] as const;

const LEVEL_ACTIVE_CLASS: Record<string, string> = {
  A: "bg-lime-100 text-lime-700 border-lime-300",
  B: "bg-blue-100 text-blue-700 border-blue-300",
  C: "bg-amber-100 text-amber-700 border-amber-300",
  D: "bg-red-100 text-red-700 border-red-300",
  E: "bg-violet-100 text-violet-700 border-violet-300",
  F: "bg-gray-100 text-gray-600 border-gray-300",
};

// ---------------------------------------------------------------------------
// Month Picker
// ---------------------------------------------------------------------------

interface MonthPickerProps {
  availableMonths: string[]; // YYYY-MM[], descending
  selectedMonth: string;
  onSelect: (month: string) => void;
  onClose: () => void;
}

function MonthPicker({ availableMonths, selectedMonth, onSelect, onClose }: MonthPickerProps) {
  const availableSet = new Set(availableMonths);

  // Find the year range from available months
  const years = Array.from(new Set(availableMonths.map((m) => m.slice(0, 4)))).sort(
    (a, b) => b.localeCompare(a),
  );
  const [pickerYear, setPickerYear] = useState(selectedMonth.slice(0, 4));

  const yearIdx = years.indexOf(pickerYear);

  return (
    <div
      className="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-50 bg-white border border-border rounded-xl shadow-lg p-3 w-56"
      onMouseDown={(e) => e.preventDefault()}
    >
      {/* Year navigation */}
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => years[yearIdx + 1] && setPickerYear(years[yearIdx + 1])}
          disabled={!years[yearIdx + 1]}
          className="p-1 rounded hover:bg-muted disabled:opacity-30"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        <span className="text-sm font-semibold">{pickerYear}</span>
        <button
          onClick={() => years[yearIdx - 1] && setPickerYear(years[yearIdx - 1])}
          disabled={!years[yearIdx - 1]}
          className="p-1 rounded hover:bg-muted disabled:opacity-30"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Month grid */}
      <div className="grid grid-cols-4 gap-1">
        {Array.from({ length: 12 }, (_, i) => {
          const mm = String(i + 1).padStart(2, "0");
          const monthKey = `${pickerYear}-${mm}`;
          const isAvailable = availableSet.has(monthKey);
          const isSelected = monthKey === selectedMonth;
          return (
            <button
              key={mm}
              disabled={!isAvailable}
              onClick={() => {
                onSelect(monthKey);
                onClose();
              }}
              className={cn(
                "py-1.5 text-xs rounded-lg font-medium transition-colors",
                isSelected && "bg-blue-600 text-white",
                !isSelected && isAvailable && "hover:bg-muted text-foreground",
                !isAvailable && "text-muted-foreground/30 cursor-default",
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

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CvrFiltersProps {
  selectedMonth: string;
  availableMonths: string[];
  viewMode: "month" | "year";
  onViewModeChange: (mode: "month" | "year") => void;
  selectedLevels: string[];
  onToggleLevel: (level: string) => void;
  onClearLevels: () => void;
  onGoToMonth: (month: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Filter bar for the CVR section.
 *
 * Controls:
 *   1. Level filter — A B C D E F + All buttons (multi-select)
 *   2. View mode    — 월별 / 연간 segment
 *   3. Month nav    — < YYYY-MM > with month picker on click
 *   4. Import button — opens the existing import modal
 */
export default function CvrFilters({
  selectedMonth,
  availableMonths,
  viewMode,
  onViewModeChange,
  selectedLevels,
  onToggleLevel,
  onClearLevels,
  onGoToMonth,
}: CvrFiltersProps) {
  const openModal = useModalStore((s) => s.open);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Month navigation via arrow buttons
  const currentIdx = availableMonths.indexOf(selectedMonth);
  const prevMonth = availableMonths[currentIdx + 1] ?? null; // older
  const nextMonth = availableMonths[currentIdx - 1] ?? null; // newer

  const isAllSelected = selectedLevels.length === 0;

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-[#f5f7fb] px-4 py-2.5">
      {/* Level filter */}
      <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-1">
        {/* All button */}
        <button
          onClick={onClearLevels}
          className={cn(
            "h-9 min-w-10 rounded-lg border border-transparent px-3 text-xs font-semibold transition-colors",
            isAllSelected
              ? "border border-slate-200 bg-white text-violet-600 shadow-[0_1px_2px_rgba(15,23,42,0.08)]"
              : "text-slate-500 hover:text-slate-700",
          )}
        >
          All
        </button>

        {LEVELS.map((level) => {
          const isActive = selectedLevels.includes(level);
          return (
            <button
              key={level}
              onClick={() => onToggleLevel(level)}
              className={cn(
                "h-9 min-w-9 rounded-lg border text-xs font-bold transition-colors",
                isActive
                  ? LEVEL_ACTIVE_CLASS[level]
                  : "border-transparent text-slate-500 hover:text-slate-700",
              )}
            >
              {level}
            </button>
          );
        })}
      </div>

      {/* Divider */}
      <div className="h-6 w-px bg-slate-300" />

      {/* View mode toggle */}
      <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-1">
        {(["month", "year"] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => onViewModeChange(mode)}
            className={cn(
              "h-9 rounded-lg border border-transparent px-4 text-xs font-semibold transition-colors",
              viewMode === mode
                ? "border border-slate-200 bg-white text-[#2563eb] shadow-[0_1px_2px_rgba(15,23,42,0.08)]"
                : "text-slate-500 hover:text-slate-700",
            )}
          >
            {mode === "month" ? "월별" : "연간"}
          </button>
        ))}
      </div>

      {/* Divider */}
      <div className="h-6 w-px bg-slate-300" />

      {/* Month navigator */}
      <div className="relative flex items-center gap-1">
        <button
          onClick={() => prevMonth && onGoToMonth(prevMonth)}
          disabled={!prevMonth}
          className="p-1.5 rounded-lg hover:bg-slate-200 disabled:opacity-30 transition-colors"
          aria-label="이전 월"
        >
          <ChevronLeft className="w-4 h-4 text-slate-600" />
        </button>

        <button
          onClick={() => setPickerOpen((v) => !v)}
          className="h-9 px-4 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
        >
          {selectedMonth}
        </button>

        <button
          onClick={() => nextMonth && onGoToMonth(nextMonth)}
          disabled={!nextMonth}
          className="p-1.5 rounded-lg hover:bg-slate-200 disabled:opacity-30 transition-colors"
          aria-label="다음 월"
        >
          <ChevronRight className="w-4 h-4 text-slate-600" />
        </button>

        {pickerOpen && (
          <MonthPicker
            availableMonths={availableMonths}
            selectedMonth={selectedMonth}
            onSelect={onGoToMonth}
            onClose={() => setPickerOpen(false)}
          />
        )}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Import button */}
      <button
        onClick={() => openModal("import")}
        className="flex items-center gap-1.5 h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-600 shadow-sm hover:bg-slate-50 transition-colors"
      >
        <Upload className="w-3.5 h-3.5" />
        Import
      </button>
    </div>
  );
}
