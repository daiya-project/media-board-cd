"use client";

import { useState } from "react";
import { Calendar, AlertTriangle, AlertCircle, Database, BarChart2, ChevronLeft, ChevronRight } from "lucide-react";
import { DB_LINK, REDASH_LINK } from "@/lib/config";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

// ---------------------------------------------------------------------------
// DatePicker
// ---------------------------------------------------------------------------

const MONTHS = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

interface DatePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (v: string) => void;
  placeholder?: string;
}

/**
 * Popover-based date picker that replaces the native <input type="date">.
 * Displays a month/year navigator + day grid.
 */
function DatePicker({ value, onChange, placeholder = "날짜 선택" }: DatePickerProps) {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(() =>
    value ? parseInt(value.slice(0, 4), 10) : today.getFullYear()
  );
  const [viewMonth, setViewMonth] = useState(() =>
    value ? parseInt(value.slice(5, 7), 10) - 1 : today.getMonth()
  );

  const selectedDate = value || null;

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  }

  function handleSelect(day: number) {
    const mm = String(viewMonth + 1).padStart(2, "0");
    const dd = String(day).padStart(2, "0");
    onChange(`${viewYear}-${mm}-${dd}`);
    setOpen(false);
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange("");
  }

  // Build calendar grid — always 6 rows (42 cells) to keep height fixed
  const firstDow = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length < 42) cells.push(null);

  const label = value
    ? `${parseInt(value.slice(0, 4))}년 ${parseInt(value.slice(5, 7))}월 ${parseInt(value.slice(8, 10))}일`
    : placeholder;

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o && value) {
          setViewYear(parseInt(value.slice(0, 4), 10));
          setViewMonth(parseInt(value.slice(5, 7), 10) - 1);
        }
      }}
    >
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

      <PopoverContent
        className="w-[240px] p-0 shadow-lg z-[80] min-h-[280px]"
        align="start"
        sideOffset={6}
        avoidCollisions={false}
      >
        {/* Month/year navigation */}
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-border shrink-0">
          <button type="button" onClick={prevMonth} className="p-1 rounded hover:bg-muted transition-colors">
            <ChevronLeft className="w-4 h-4 text-muted-foreground" />
          </button>
          <span className="text-sm font-semibold tabular-nums">
            {viewYear}년 {MONTHS[viewMonth]}
          </span>
          <button type="button" onClick={nextMonth} className="p-1 rounded hover:bg-muted transition-colors">
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 px-2 pt-2 shrink-0">
          {WEEKDAYS.map((d, i) => (
            <div
              key={d}
              className={cn(
                "text-center text-[10px] font-medium pb-1",
                i === 0 ? "text-red-400" : i === 6 ? "text-blue-400" : "text-muted-foreground"
              )}
            >
              {d}
            </div>
          ))}
        </div>

        {/* Day grid — fixed height (6 rows × h-7) so popover never resizes */}
        <div className="grid grid-cols-7 gap-y-0.5 px-2 pb-2 h-[180px] shrink-0">
          {cells.map((day, idx) => {
            if (!day) {
              return <div key={`empty-${idx}`} className="h-7 min-w-0" aria-hidden="true" />;
            }
            const mm = String(viewMonth + 1).padStart(2, "0");
            const dd = String(day).padStart(2, "0");
            const dateStr = `${viewYear}-${mm}-${dd}`;
            const isSelected = dateStr === selectedDate;
            const isToday = dateStr === todayStr;
            const dow = (firstDow + day - 1) % 7;
            return (
              <button
                key={`${viewYear}-${viewMonth}-${day}`}
                type="button"
                onClick={() => handleSelect(day)}
                className={cn(
                  "h-7 w-full min-w-0 text-xs font-medium rounded-md transition-colors",
                  isSelected
                    ? "bg-orange-500 text-white hover:bg-orange-600"
                    : isToday
                    ? "bg-orange-50 text-orange-600 font-semibold hover:bg-orange-100"
                    : dow === 0
                    ? "text-red-400 hover:bg-muted"
                    : dow === 6
                    ? "text-blue-400 hover:bg-muted"
                    : "text-foreground hover:bg-muted"
                )}
              >
                {day}
              </button>
            );
          })}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between px-3 py-2 border-t border-border shrink-0">
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
              const t = new Date();
              setViewYear(t.getFullYear());
              setViewMonth(t.getMonth());
              handleSelect(t.getDate());
            }}
            className="text-xs text-orange-500 font-medium hover:text-orange-600 transition-colors"
          >
            오늘
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ConfirmStepProps {
  lastDate: string | null;
  isForceUpdate: boolean;
  forceStartDate: string;
  forceEndDate: string;
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
 * Confirm step UI for the import modal.
 * Shows last imported date, force-update option, and external links.
 */
export function ConfirmStep({
  lastDate,
  isForceUpdate,
  forceStartDate,
  forceEndDate,
  onForceToggle,
  onStartChange,
  onEndChange,
  onCancel,
  onConfirm,
  validationError,
}: ConfirmStepProps) {
  return (
    <div className="space-y-3">
      {/* Last imported date */}
      {lastDate && (
        <div className="flex items-center gap-3 px-3 py-2.5 bg-muted/50 rounded-lg">
          <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
          <span className="text-sm text-muted-foreground flex-1">마지막 데이터 날짜</span>
          <span className="text-sm font-semibold text-foreground tabular-nums">{lastDate}</span>
        </div>
      )}

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

      {/* Force date range picker */}
      {isForceUpdate && (
        <div className="px-3 py-3 bg-orange-50 rounded-lg border border-orange-200 space-y-2.5">
          <p className="text-xs text-orange-700 leading-relaxed">
            선택한 기간의 기존 데이터를 삭제 후 다시 업로드합니다.
          </p>
          <div className="flex items-center gap-2">
            <DatePicker value={forceStartDate} onChange={onStartChange} placeholder="시작일" />
            <span className="text-muted-foreground text-xs font-medium shrink-0">→</span>
            <DatePicker value={forceEndDate} onChange={onEndChange} placeholder="종료일" />
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
            href={DB_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 w-20 py-1.5 text-xs font-medium rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <Database className="w-3 h-3" />
            DB
          </a>
          <a
            href={REDASH_LINK}
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
                : "bg-primary hover:bg-primary/90"
            )}
          >
            {isForceUpdate ? "강제 업데이트" : "업데이트"}
          </button>
        </div>
      </div>
    </div>
  );
}
