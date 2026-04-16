"use client";

import { useState } from "react";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const MONTHS = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

interface DatePickerProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  /** DB latest date — used to highlight "today" instead of system clock. */
  latestDate?: string;
}

/**
 * Calendar date picker with popover.
 * Uses DB latest date for "today" highlight (not system Date).
 */
export default function DatePicker({
  value,
  onChange,
  placeholder = "날짜 선택",
  latestDate,
}: DatePickerProps) {
  // Use DB latest date for "today" highlight — never system clock
  const todayStr = latestDate ?? "";

  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(() => {
    if (value) return parseInt(value.slice(0, 4), 10);
    if (latestDate) return parseInt(latestDate.slice(0, 4), 10);
    return 2026; // static fallback — avoid new Date()
  });
  const [viewMonth, setViewMonth] = useState(() => {
    if (value) return parseInt(value.slice(5, 7), 10) - 1;
    if (latestDate) return parseInt(latestDate.slice(5, 7), 10) - 1;
    return 0;
  });

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
            "bg-white border-blue-300 hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400",
            !value && "text-muted-foreground",
          )}
        >
          <span className="truncate">{label}</span>
          <Calendar className="w-3.5 h-3.5 text-blue-400 shrink-0" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        className="w-[240px] p-0 shadow-lg z-[80] min-h-[280px]"
        align="start"
        sideOffset={6}
        avoidCollisions={false}
      >
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

        <div className="grid grid-cols-7 px-2 pt-2 shrink-0">
          {WEEKDAYS.map((d, i) => (
            <div
              key={d}
              className={cn(
                "text-center text-[10px] font-medium pb-1",
                i === 0 ? "text-red-400" : i === 6 ? "text-blue-400" : "text-muted-foreground",
              )}
            >
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-y-0.5 px-2 pb-2 h-[180px] shrink-0">
          {cells.map((day, idx) => {
            if (!day) return <div key={`empty-${idx}`} className="h-7 min-w-0" aria-hidden="true" />;
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
                    ? "bg-blue-500 text-white hover:bg-blue-600"
                    : isToday
                      ? "bg-blue-50 text-blue-600 font-semibold hover:bg-blue-100"
                      : dow === 0
                        ? "text-red-400 hover:bg-muted"
                        : dow === 6
                          ? "text-blue-400 hover:bg-muted"
                          : "text-foreground hover:bg-muted",
                )}
              >
                {day}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
