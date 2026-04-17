"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { Search, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ExternalFcPagePayload } from "@/types/fc";

interface Props {
  widgets: ExternalFcPagePayload["widgets"];
  selectedId: string | null;
  onSelect: (widgetId: string) => void;
}

export default function WidgetPicker({ widgets, selectedId, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = widgets.find((w) => w.widget_id === selectedId) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return widgets;
    return widgets.filter(
      (w) =>
        w.widget_id.toLowerCase().includes(q) ||
        w.label.toLowerCase().includes(q),
    );
  }, [widgets, query]);

  // 드롭다운 외부 클릭 시 닫기
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={rootRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="h-10 px-4 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 flex items-center gap-2 min-w-[280px]"
      >
        <span className="truncate">
          {selected ? `${selected.label} (${selected.widget_id})` : "위젯 선택"}
        </span>
        <ChevronDown className="w-4 h-4 text-slate-400 ml-auto" />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-[420px] bg-white border border-slate-200 rounded-lg shadow-lg z-10">
          <div className="p-2 border-b border-slate-100 flex items-center gap-2">
            <Search className="w-4 h-4 text-slate-400" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="widget_id 또는 이름 검색..."
              className="flex-1 text-sm outline-none bg-transparent"
            />
            {query && (
              <button onClick={() => setQuery("")}>
                <X className="w-3 h-3 text-slate-400" />
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="p-4 text-xs text-slate-400 text-center">
                결과 없음
              </div>
            ) : (
              filtered.map((w) => (
                <button
                  key={w.widget_id}
                  onClick={() => {
                    onSelect(w.widget_id);
                    setOpen(false);
                  }}
                  className={cn(
                    "w-full text-left px-3 py-2 text-xs hover:bg-slate-50 border-b border-slate-100",
                    w.widget_id === selectedId && "bg-blue-50",
                  )}
                >
                  <div className="font-medium text-slate-700">{w.label}</div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    {w.widget_id}
                    {w.source && <span className="ml-2">· {w.source}</span>}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
