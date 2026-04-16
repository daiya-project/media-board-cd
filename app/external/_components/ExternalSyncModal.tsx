"use client";

import { useState, useCallback } from "react";
import {
  X,
  RefreshCw,
  Loader2,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import DatePicker from "./DatePicker";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ModalStep = "confirm" | "progress" | "result";

interface SyncResult {
  klmedia: number;
  syncMedia: number;
}

interface ExternalSyncModalProps {
  open: boolean;
  onClose: () => void;
  onSyncComplete: () => void;
  defaultStartDate: string;
  defaultEndDate: string;
  /** DB latest date — passed to DatePicker for "today" highlight. */
  latestDate: string;
}

// ---------------------------------------------------------------------------
// ExternalSyncModal
// ---------------------------------------------------------------------------

/**
 * Sync modal for external data (KL Media / SyncMedia).
 * Follows ImportModal pattern: confirm → progress → result steps.
 */
export default function ExternalSyncModal({
  open,
  onClose,
  onSyncComplete,
  defaultStartDate,
  defaultEndDate,
  latestDate,
}: ExternalSyncModalProps) {
  const [step, setStep] = useState<ModalStep>("confirm");
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(defaultEndDate);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Reset state when modal opens
  const handleClose = useCallback(() => {
    if (step === "progress") return;
    setStep("confirm");
    setStartDate(defaultStartDate);
    setEndDate(defaultEndDate);
    setValidationError(null);
    setSyncResult(null);
    setErrorMessage(null);
    onClose();
  }, [step, defaultStartDate, defaultEndDate, onClose]);

  const handleSync = useCallback(async () => {
    if (!startDate || !endDate) {
      setValidationError("시작일과 종료일을 모두 선택해주세요.");
      return;
    }
    if (startDate > endDate) {
      setValidationError("시작일은 종료일보다 앞이어야 합니다.");
      return;
    }

    setValidationError(null);
    setStep("progress");

    try {
      const res = await fetch("/api/external/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate, endDate }),
      });
      if (!res.ok) throw new Error("Sync failed");

      const json = await res.json();
      setSyncResult(json.synced);
      setStep("result");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
      setStep("result");
    }
  }, [startDate, endDate]);

  const handleDone = useCallback(() => {
    if (syncResult) {
      onSyncComplete();
    }
    handleClose();
  }, [syncResult, onSyncComplete, handleClose]);

  if (!open) return null;

  const stepTitle: Record<ModalStep, string> = {
    confirm: "외부 데이터 동기화",
    progress: "동기화 진행 중",
    result: errorMessage ? "동기화 실패" : "동기화 완료",
  };

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Modal panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={stepTitle[step]}
        className="fixed inset-0 z-[71] flex items-center justify-center p-4 pointer-events-none"
      >
        <div className="pointer-events-auto bg-white rounded-2xl shadow-2xl border border-border w-full max-w-md flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-4 pb-3 border-b border-border">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "flex items-center justify-center w-8 h-8 rounded-lg",
                  step === "confirm" && "bg-blue-50",
                  step === "progress" && "bg-muted",
                  step === "result" && !errorMessage && "bg-green-50",
                  step === "result" && errorMessage && "bg-red-50",
                )}
              >
                {step === "confirm" && <RefreshCw className="w-4 h-4 text-blue-600" />}
                {step === "progress" && <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />}
                {step === "result" && !errorMessage && <CheckCircle className="w-4 h-4 text-green-600" />}
                {step === "result" && errorMessage && <AlertCircle className="w-4 h-4 text-red-600" />}
              </div>
              <h2 className="text-base font-semibold text-foreground">
                {stepTitle[step]}
              </h2>
            </div>
            {step !== "progress" && (
              <button
                type="button"
                onClick={handleClose}
                className="flex items-center justify-center w-7 h-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                aria-label="닫기"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Step content */}
          <div className="px-6 py-5">
            {/* Confirm step */}
            {step === "confirm" && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  KL Media와 SyncMedia에서 외부 정산 데이터를 가져옵니다.
                </p>

                {/* Date range picker */}
                <div className="px-3 py-3 bg-blue-50/60 rounded-lg border border-blue-200 space-y-2.5">
                  <p className="text-xs text-blue-700 font-medium">동기화 기간</p>
                  <div className="flex items-center gap-2">
                    <DatePicker value={startDate} onChange={setStartDate} placeholder="시작일" latestDate={latestDate} />
                    <span className="text-muted-foreground text-xs font-medium shrink-0">→</span>
                    <DatePicker value={endDate} onChange={setEndDate} placeholder="종료일" latestDate={latestDate} />
                  </div>
                </div>

                {/* Validation error */}
                {validationError && (
                  <div className="flex items-center gap-1.5 text-xs text-red-600">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    {validationError}
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex justify-end gap-2 pt-3 border-t border-border">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="px-4 py-2 text-sm font-medium rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={handleSync}
                    className="px-5 py-2 text-sm font-semibold rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition-colors"
                  >
                    동기화
                  </button>
                </div>
              </div>
            )}

            {/* Progress step */}
            {step === "progress" && (
              <div className="flex flex-col items-center gap-4 py-6">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                <div className="text-center space-y-1">
                  <p className="text-sm font-medium text-foreground">데이터를 동기화하고 있습니다...</p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {startDate} ~ {endDate}
                  </p>
                </div>
              </div>
            )}

            {/* Result step */}
            {step === "result" && (
              <div className="space-y-3">
                {errorMessage ? (
                  <div className="px-3 py-3 bg-red-50 rounded-lg border border-red-200">
                    <p className="text-sm text-red-700">{errorMessage}</p>
                  </div>
                ) : syncResult && (
                  <>
                    <p className="text-sm text-muted-foreground">
                      외부 데이터가 성공적으로 동기화되었습니다.
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex flex-col items-center gap-0.5 p-3 bg-sky-50 rounded-lg border border-sky-100">
                        <span className="text-xs text-sky-600 font-medium">KL Media</span>
                        <span className="text-lg font-bold text-sky-700 tabular-nums">
                          {syncResult.klmedia}건
                        </span>
                      </div>
                      <div className="flex flex-col items-center gap-0.5 p-3 bg-purple-50 rounded-lg border border-purple-100">
                        <span className="text-xs text-purple-600 font-medium">SyncMedia</span>
                        <span className="text-lg font-bold text-purple-700 tabular-nums">
                          {syncResult.syncMedia}건
                        </span>
                      </div>
                    </div>
                  </>
                )}

                <div className="flex justify-end pt-3 border-t border-border">
                  <button
                    type="button"
                    onClick={handleDone}
                    className={cn(
                      "px-5 py-2 text-sm font-semibold rounded-lg text-white transition-colors",
                      errorMessage
                        ? "bg-gray-600 hover:bg-gray-700"
                        : "bg-blue-600 hover:bg-blue-700",
                    )}
                  >
                    확인
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
