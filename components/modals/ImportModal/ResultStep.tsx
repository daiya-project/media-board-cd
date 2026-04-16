"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle, AlertCircle, List } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatNumberForDisplay } from "@/lib/utils/number-utils";
import type { ImportResult } from "@/types/app-db.types";

// ---------------------------------------------------------------------------
// Shared types (exported for LogTableModal + ImportModal main)
// ---------------------------------------------------------------------------

export type ResultType = "completed" | "cancelled" | "error";
export type LogType = "service" | "widget" | "failed";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ResultStepProps {
  resultType: ResultType;
  result: ImportResult | null;
  errorMessage: string | null;
  onClose: () => void;
  onViewLog: (type: LogType) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Result step UI for the import modal.
 * Shows import summary, auto-closes on success after 2s, and log buttons.
 */
export function ResultStep({ resultType, result, errorMessage, onClose, onViewLog }: ResultStepProps) {
  const router = useRouter();

  useEffect(() => {
    if (resultType !== "completed") return;
    if ((result?.imported ?? 0) > 0) router.refresh();
  }, [resultType, result, router]);

  const config = {
    completed: {
      icon: <CheckCircle2 className="w-5 h-5 text-green-600" />,
      label: "Import 완료",
      badge: "bg-green-100 text-green-700 border-green-200",
    },
    cancelled: {
      icon: <XCircle className="w-5 h-5 text-muted-foreground" />,
      label: "취소됨",
      badge: "bg-muted text-muted-foreground border-border",
    },
    error: {
      icon: <AlertCircle className="w-5 h-5 text-red-600" />,
      label: "Import 실패",
      badge: "bg-red-100 text-red-700 border-red-200",
    },
  }[resultType];

  const serviceCount = result?.newServiceLogs?.length ?? 0;
  const widgetCount = result?.newWidgetLogs?.length ?? 0;
  const failedCount = result?.failedDetails?.length ?? 0;
  const hasLogs = serviceCount > 0 || widgetCount > 0 || failedCount > 0;

  return (
    <div className="space-y-4">
      {/* Status banner */}
      <div className={cn("flex items-center gap-2.5 px-3 py-2.5 rounded-lg border", config.badge)}>
        {config.icon}
        <span className="text-sm font-semibold">{config.label}</span>
      </div>

      {/* Stats */}
      {result && (
        <div className="bg-muted/40 rounded-lg divide-y divide-border border border-border overflow-hidden">
          <StatRow label="전체 행" value={result.totalRows} />
          <StatRow label="성공" value={result.imported} valueClass="text-green-600" />
          {result.failed > 0 && (
            <StatRow label="실패" value={result.failed} valueClass="text-red-600" />
          )}
          {result.skipped > 0 && (
            <StatRow label="스킵" value={result.skipped} />
          )}
          {result.servicesCreated > 0 && (
            <StatRow label="서비스 신규 등록" value={result.servicesCreated} valueClass="text-primary" />
          )}
          {result.widgetsCreated > 0 && (
            <StatRow label="위젯 신규 등록" value={result.widgetsCreated} valueClass="text-primary" />
          )}
          {result.dateStart && result.dateEnd && (
            <div className="flex justify-between px-3 py-2 text-sm">
              <span className="text-muted-foreground">날짜 범위</span>
              <span className="font-semibold tabular-nums text-foreground">
                {result.dateStart} ~ {result.dateEnd}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Error message */}
      {resultType === "error" && errorMessage && (
        <div className="p-3 bg-red-50 rounded-lg border border-red-200">
          <p className="text-xs text-red-700 break-words leading-relaxed">{errorMessage}</p>
        </div>
      )}

      {/* Log buttons */}
      {hasLogs && (
        <div className="flex flex-wrap gap-2">
          {serviceCount > 0 && (
            <button
              type="button"
              onClick={() => onViewLog("service")}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-primary/30 text-primary hover:bg-primary/5 transition-colors"
            >
              <List className="w-3 h-3" />
              서비스 신규 {serviceCount}건
            </button>
          )}
          {widgetCount > 0 && (
            <button
              type="button"
              onClick={() => onViewLog("widget")}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-primary/30 text-primary hover:bg-primary/5 transition-colors"
            >
              <List className="w-3 h-3" />
              위젯 신규 {widgetCount}건
            </button>
          )}
          {failedCount > 0 && (
            <button
              type="button"
              onClick={() => onViewLog("failed")}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
            >
              <List className="w-3 h-3" />
              실패 {failedCount}건
            </button>
          )}
        </div>
      )}

      <div className="flex justify-end border-t border-border pt-3">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors"
        >
          닫기
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component
// ---------------------------------------------------------------------------

function StatRow({
  label,
  value,
  valueClass = "text-foreground",
}: {
  label: string;
  value: number;
  valueClass?: string;
}) {
  return (
    <div className="flex justify-between px-3 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-semibold tabular-nums", valueClass)}>
        {formatNumberForDisplay(value)}
      </span>
    </div>
  );
}
