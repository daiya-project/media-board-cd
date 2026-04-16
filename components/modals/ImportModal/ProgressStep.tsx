"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatNumberForDisplay } from "@/lib/utils/number-utils";
import type { ImportProgress } from "@/types/app-db.types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ProgressStepProps {
  progress: ImportProgress;
  onCancel: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Progress step UI for the import modal.
 * Displays a progress bar and real-time counters.
 */
export function ProgressStep({ progress, onCancel }: ProgressStepProps) {
  const percent =
    progress.total > 0
      ? Math.round((progress.processed / progress.total) * 100)
      : 0;

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-foreground flex items-center gap-1.5">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
            처리 중...
          </span>
          <span className="text-sm font-bold tabular-nums text-primary">{percent}%</span>
        </div>
        <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
          <div
            className="bg-primary h-full rounded-full transition-all duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-1.5 tabular-nums">
          {formatNumberForDisplay(progress.processed)} / {formatNumberForDisplay(progress.total)} 행
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-2">
        <StatCell label="성공" value={progress.success} color="green" />
        <StatCell label="실패" value={progress.failed} color="red" />
        <StatCell label="스킵" value={progress.skipped} color="muted" />
      </div>

      {/* Extra info */}
      {(progress.servicesCreated > 0 || progress.widgetsCreated > 0 || progress.currentDate) && (
        <div className="text-xs space-y-1 text-muted-foreground border-t border-border pt-3">
          {progress.servicesCreated > 0 && (
            <div className="flex justify-between">
              <span>서비스 신규 등록</span>
              <span className="font-semibold text-primary tabular-nums">
                {formatNumberForDisplay(progress.servicesCreated)}
              </span>
            </div>
          )}
          {progress.widgetsCreated > 0 && (
            <div className="flex justify-between">
              <span>위젯 신규 등록</span>
              <span className="font-semibold text-primary tabular-nums">
                {formatNumberForDisplay(progress.widgetsCreated)}
              </span>
            </div>
          )}
          {progress.currentDate && (
            <div className="flex justify-between">
              <span>현재 날짜</span>
              <span className="font-semibold tabular-nums">{progress.currentDate}</span>
            </div>
          )}
        </div>
      )}

      <div className="flex justify-end border-t border-border pt-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors"
        >
          취소
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component
// ---------------------------------------------------------------------------

interface StatCellProps {
  label: string;
  value: number;
  color: "green" | "red" | "muted";
}

function StatCell({ label, value, color }: StatCellProps) {
  const valueClass = {
    green: "text-green-600",
    red: "text-red-600",
    muted: "text-muted-foreground",
  }[color];

  return (
    <div className="flex flex-col items-center gap-0.5 p-2.5 bg-muted/50 rounded-lg">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn("text-base font-bold tabular-nums", valueClass)}>
        {formatNumberForDisplay(value)}
      </span>
    </div>
  );
}
