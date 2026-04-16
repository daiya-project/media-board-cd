"use client";

import { X } from "lucide-react";
import type { ImportResult } from "@/types/app-db.types";
import type { LogType } from "./ResultStep";
import { EmptyState } from "@/components/common/EmptyState";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface LogTableModalProps {
  type: LogType;
  result: ImportResult;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Popup modal table showing service/widget/failed import logs.
 * Rendered on top of the main ImportModal.
 */
export function LogTableModal({ type, result, onClose }: LogTableModalProps) {
  const titles: Record<LogType, string> = {
    service: "서비스 신규 등록 목록",
    widget: "위젯 신규 등록 목록",
    failed: "업데이트 실패 목록",
  };

  const serviceRows = result.newServiceLogs ?? [];
  const widgetRows = result.newWidgetLogs ?? [];
  const failedRows = result.failedDetails ?? [];

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titles[type]}
        className="fixed inset-0 z-[71] flex items-center justify-center p-4 pointer-events-none"
      >
        <div className="pointer-events-auto bg-white rounded-2xl shadow-2xl border border-border w-full max-w-3xl max-h-[70vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-4 pb-3 flex-none">
            <h3 className="text-base font-bold text-foreground">{titles[type]}</h3>
            <button
              type="button"
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="닫기"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="border-t border-border flex-none" />

          {/* Table */}
          <div className="overflow-auto flex-1">
            {type === "service" && (
              serviceRows.length === 0 ? (
                <EmptyState className="py-8" />
              ) : (
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      {["날짜", "Client ID", "Client Name", "Service ID", "Service Name"].map((h) => (
                        <th key={h} className="text-left px-3 py-2 font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {serviceRows.map((row, i) => (
                      <tr key={i} className="border-t border-border hover:bg-muted/30">
                        <td className="px-3 py-2 whitespace-nowrap">{row.date ?? "—"}</td>
                        <td className="px-3 py-2 whitespace-nowrap font-mono">{row.client_id}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{row.client_name ?? "—"}</td>
                        <td className="px-3 py-2 whitespace-nowrap font-mono">{row.service_id}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{row.service_name ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            )}

            {type === "widget" && (
              widgetRows.length === 0 ? (
                <EmptyState className="py-8" />
              ) : (
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      {["날짜", "Client ID", "Client Name", "Service ID", "Service Name", "Widget ID", "Widget Name"].map((h) => (
                        <th key={h} className="text-left px-3 py-2 font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {widgetRows.map((row, i) => (
                      <tr key={i} className="border-t border-border hover:bg-muted/30">
                        <td className="px-3 py-2 whitespace-nowrap">{row.date ?? "—"}</td>
                        <td className="px-3 py-2 whitespace-nowrap font-mono">{row.client_id}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{row.client_name ?? "—"}</td>
                        <td className="px-3 py-2 whitespace-nowrap font-mono">{row.service_id}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{row.service_name ?? "—"}</td>
                        <td className="px-3 py-2 whitespace-nowrap font-mono">{row.widget_id}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{row.widget_name ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            )}

            {type === "failed" && (
              failedRows.length === 0 ? (
                <EmptyState className="py-8" />
              ) : (
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      {["날짜", "Client ID", "Client Name", "Service ID", "Service Name", "Widget ID", "Widget Name", "실패 사유"].map((h) => (
                        <th key={h} className="text-left px-3 py-2 font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {failedRows.map((row, i) => (
                      <tr key={i} className="border-t border-border hover:bg-red-50/40">
                        <td className="px-3 py-2 whitespace-nowrap">{row.date ?? "—"}</td>
                        <td className="px-3 py-2 whitespace-nowrap font-mono">{row.client_id ?? "—"}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{row.client_name ?? "—"}</td>
                        <td className="px-3 py-2 whitespace-nowrap font-mono">{row.service_id ?? "—"}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{row.service_name ?? "—"}</td>
                        <td className="px-3 py-2 whitespace-nowrap font-mono">{row.widget_id ?? "—"}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{row.widget_name ?? "—"}</td>
                        <td className="px-3 py-2 text-red-600 break-all max-w-[200px]">{row.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-border flex-none px-5 py-3 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-sm font-medium rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
