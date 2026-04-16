"use client";

import { useState } from "react";
import { Calendar, AlertTriangle, AlertCircle, Database, BarChart2, ChevronLeft, ChevronRight } from "lucide-react";
import { CVR_DB_LINK, CVR_REDASH_LINK } from "@/lib/config";
import { toYearMonth } from "@/lib/utils/date-utils";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

// ---------------------------------------------------------------------------
// MonthPicker
// ---------------------------------------------------------------------------

const MONTHS = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];

interface MonthPickerProps {
  value: string; // YYYY-MM
  onChange: (v: string) => void;
  placeholder?: string;
}

/**
 * Popover-based month picker that replaces the native <input type="month">.
 * Displays a year navigator + 12-month grid.
 */
function MonthPicker({ value, onChange, placeholder = "----년 ---" }: MonthPickerProps) {
  const currentYear = new Date().getFullYear();
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(() => {
    if (value) return parseInt(value.slice(0, 4), 10);
    return currentYear;
  });

  const selectedYear = value ? parseInt(value.slice(0, 4), 10) : null;
  const selectedMonth = value ? parseInt(value.slice(5, 7), 10) : null;

  function handleSelect(month: number) {
    onChange(`${viewYear}-${String(month).padStart(2, "0")}`);
    setOpen(false);
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange("");
  }

  const label = value
    ? `${selectedYear}년 ${selectedMonth}월`
    : placeholder;

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o && value) setViewYear(selectedYear!); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex-1 flex items-center justify-between gap-1.5 px-3 py-1.5 text-sm rounded-md border transition-colors",
            "bg-white border-orange-300 hover:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-400",
            !value && "text-muted-foreground"
          )}
        >
          <span className="truncate">{label}</span>
          <Calendar className="w-3.5 h-3.5 text-orange-400 shrink-0" />
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-[220px] p-0 shadow-lg z-[80]" align="start" sideOffset={6}>
        {/* Year navigation */}
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
          <button
            type="button"
            onClick={() => setViewYear((y) => y - 1)}
            className="p-1 rounded hover:bg-muted transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-muted-foreground" />
          </button>
          <span className="text-sm font-semibold tabular-nums">{viewYear}</span>
          <button
            type="button"
            onClick={() => setViewYear((y) => y + 1)}
            className="p-1 rounded hover:bg-muted transition-colors"
          >
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Month grid */}
        <div className="grid grid-cols-4 gap-1 p-2.5">
          {MONTHS.map((name, i) => {
            const month = i + 1;
            const isSelected = selectedYear === viewYear && selectedMonth === month;
            const isCurrentMonth = viewYear === currentYear && month === new Date().getMonth() + 1;
            return (
              <button
                key={month}
                type="button"
                onClick={() => handleSelect(month)}
                className={cn(
                  "py-1.5 text-xs font-medium rounded-md transition-colors",
                  isSelected
                    ? "bg-orange-500 text-white hover:bg-orange-600"
                    : isCurrentMonth
                    ? "bg-orange-50 text-orange-600 font-semibold hover:bg-orange-100"
                    : "hover:bg-muted text-foreground"
                )}
              >
                {name}
              </button>
            );
          })}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between px-3 py-2 border-t border-border">
          <button
            type="button"
            onClick={handleClear}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            삭제
          </button>
          <button
            type="button"
            onClick={() => {
              setViewYear(currentYear);
              handleSelect(new Date().getMonth() + 1);
            }}
            className="text-xs text-orange-500 font-medium hover:text-orange-600 transition-colors"
          >
            이번 달
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface CvrConfirmStepProps {
  lastDate: string | null;
  isForceUpdate: boolean;
  forceStartMonth: string;
  forceEndMonth: string;
  onForceToggle: () => void;
  onStartChange: (v: string) => void;
  onEndChange: (v: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
  validationError: string | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Confirm step UI for CVR data import.
 * Matches DATA ConfirmStep design with violet color theme.
 * Uses month pickers (YYYY-MM) for force-update date range.
 */
export function CvrConfirmStep({
  lastDate,
  isForceUpdate,
  forceStartMonth,
  forceEndMonth,
  onForceToggle,
  onStartChange,
  onEndChange,
  onCancel,
  onConfirm,
  validationError,
}: CvrConfirmStepProps) {
  return (
    <div className="space-y-3">
      {/* Last imported date — always visible */}
      <div className="flex items-center gap-3 px-3 py-2.5 bg-muted/50 rounded-lg">
        <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
        <span className="text-sm text-muted-foreground flex-1">마지막 데이터 날짜</span>
        <span className="text-sm font-semibold text-foreground tabular-nums">
          {lastDate ? toYearMonth(lastDate) : "없음"}
        </span>
      </div>

      {/* Force update toggle row */}
      <label
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer select-none transition-colors",
          isForceUpdate
            ? "border-orange-300 bg-orange-50/60"
            : "border-border hover:bg-muted/40"
        )}
      >
        <input
          type="checkbox"
          checked={isForceUpdate}
          onChange={onForceToggle}
          className="w-4 h-4 rounded border-border accent-orange-500 shrink-0"
        />
        <span className="text-sm font-medium flex-1">강제 업데이트</span>
        {isForceUpdate && (
          <AlertTriangle className="w-4 h-4 text-orange-500 shrink-0" />
        )}
      </label>

      {/* Force month range picker */}
      {isForceUpdate && (
        <div className="px-3 py-3 bg-orange-50 rounded-lg border border-orange-200 space-y-2.5">
          <p className="text-xs text-orange-700 leading-relaxed">
            선택한 기간의 기존 데이터를 삭제 후 다시 업로드합니다.
          </p>
          <div className="flex items-center gap-2">
            <MonthPicker value={forceStartMonth} onChange={onStartChange} placeholder="시작 월" />
            <span className="text-muted-foreground text-xs font-medium shrink-0">→</span>
            <MonthPicker value={forceEndMonth} onChange={onEndChange} placeholder="종료 월" />
          </div>
        </div>
      )}

      {/* Validation error */}
      {validationError && (
        <div className="flex items-center gap-1.5 text-xs text-red-600">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          {validationError}
        </div>
      )}

      {/* Footer: external links + action buttons */}
      <div className="flex items-center justify-between pt-3 mt-2 border-t border-border">
        <div className="flex items-center gap-1.5">
          <a
            href={CVR_DB_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 w-20 py-1.5 text-xs font-medium rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <Database className="w-3 h-3" />
            DB
          </a>
          <a
            href={CVR_REDASH_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 w-20 py-1.5 text-xs font-medium rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <BarChart2 className="w-3 h-3" />
            Redash
          </a>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors"
          >
            취소
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={cn(
              "px-5 py-2 text-sm font-semibold rounded-lg text-white transition-colors",
              isForceUpdate
                ? "bg-orange-500 hover:bg-orange-600"
                : "bg-violet-600 hover:bg-violet-700"
            )}
          >
            {isForceUpdate ? "강제 업데이트" : "업데이트"}
          </button>
        </div>
      </div>
    </div>
  );
}
