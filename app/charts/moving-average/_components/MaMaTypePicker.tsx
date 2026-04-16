"use client";

import { cn } from "@/lib/utils";
import { MA_WINDOWS, type MaWindow } from "@/lib/logic/maChartLogic";

interface MaMaTypePickerProps {
  selected: MaWindow;
  onChange: (w: MaWindow) => void;
}

/**
 * MA period selector: "MA" label + 5 | 10 | 15 | 30 | 60 pill buttons.
 */
export default function MaMaTypePicker({
  selected,
  onChange,
}: MaMaTypePickerProps) {
  return (
    <div className="inline-flex items-center gap-1.5">
      <span className="text-xs font-semibold text-gray-500">MA</span>
      <div className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 p-0.5 text-xs font-semibold">
        {MA_WINDOWS.map((w) => {
          const isActive = w === selected;
          return (
            <button
              key={w}
              onClick={() => onChange(w)}
              className={cn(
                "rounded-full px-2.5 py-1 transition-colors min-w-[32px]",
                isActive
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700",
              )}
            >
              {w}
            </button>
          );
        })}
      </div>
    </div>
  );
}
