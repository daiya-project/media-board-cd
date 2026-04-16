"use client";

import { useEffect, useRef, useState } from "react";
import { X, UploadCloud, Loader2, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useModalStore } from "@/stores/useModalStore";
import { createMediaClient } from "@/lib/supabase/media-client";
import { getLastImportedDate } from "@/lib/api/importDbOps";
import { getLastCvrImportedDate } from "@/lib/api/cvrImportDbOps";
import { importCvrData } from "@/lib/logic/cvrImportOrchestration";
import type { ImportProgress, ImportResult } from "@/types/app-db.types";
import type { ResultType, LogType } from "./ResultStep";

import { ConfirmStep } from "./ConfirmStep";
import { CvrConfirmStep } from "./CvrConfirmStep";
import { ProgressStep } from "./ProgressStep";
import { ResultStep } from "./ResultStep";
import { LogTableModal } from "./LogTableModal";

// ---------------------------------------------------------------------------
// Types & Constants
// ---------------------------------------------------------------------------

type ModalStep = "confirm" | "progress" | "result";
type ImportType = "data" | "cvr";

const INITIAL_PROGRESS: ImportProgress = {
  total: 0,
  processed: 0,
  success: 0,
  failed: 0,
  skipped: 0,
  servicesCreated: 0,
  widgetsCreated: 0,
  currentDate: null,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Data import modal with three steps: confirm -> progress -> result.
 *
 * Mounts globally in app/layout.tsx; visibility is controlled by
 * useModalStore (openModal === "import").
 *
 * Fetches CSV from Google Sheets and upserts into media.daily
 * entirely on the client using the browser Supabase client.
 */
export function ImportModal() {
  const { openModal, close } = useModalStore();

  // ----- tab state (persists across steps) -----
  const [importType, setImportType] = useState<ImportType>("data");

  // ----- data confirm state -----
  const [lastDate, setLastDate] = useState<string | null>(null);
  const [isForceUpdate, setIsForceUpdate] = useState(false);
  const [forceStartDate, setForceStartDate] = useState("");
  const [forceEndDate, setForceEndDate] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  // ----- cvr confirm state -----
  const [cvrLastDate, setCvrLastDate] = useState<string | null>(null);
  const [cvrIsForceUpdate, setCvrIsForceUpdate] = useState(false);
  const [cvrForceStartMonth, setCvrForceStartMonth] = useState("");
  const [cvrForceEndMonth, setCvrForceEndMonth] = useState("");
  const [cvrValidationError, setCvrValidationError] = useState<string | null>(null);

  // ----- progress state -----
  const [progress, setProgress] = useState<ImportProgress>(INITIAL_PROGRESS);
  const isCancelRef = useRef(false);

  // ----- step / result state -----
  const [step, setStep] = useState<ModalStep>("confirm");
  const [resultType, setResultType] = useState<ResultType | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ----- log popup state -----
  const [activeLog, setActiveLog] = useState<LogType | null>(null);

  // Fetch last dates whenever modal opens; reset step/form state (tab is preserved)
  useEffect(() => {
    if (openModal !== "import") return;

    setStep("confirm");
    setIsForceUpdate(false);
    setForceStartDate("");
    setForceEndDate("");
    setValidationError(null);
    setCvrIsForceUpdate(false);
    setCvrForceStartMonth("");
    setCvrForceEndMonth("");
    setCvrValidationError(null);
    setProgress(INITIAL_PROGRESS);
    setResultType(null);
    setResult(null);
    setErrorMessage(null);
    setActiveLog(null);
    isCancelRef.current = false;

    getLastImportedDate(createMediaClient())
      .then(setLastDate)
      .catch((err) => {
        console.error("[ImportModal] getLastImportedDate error:", err);
        setLastDate(null);
      });

    getLastCvrImportedDate()
      .then(setCvrLastDate)
      .catch((err) => {
        console.error("[ImportModal] getLastCvrImportedDate error:", err);
        setCvrLastDate(null);
      });
  }, [openModal]);

  if (openModal !== "import") return null;

  const handleClose = () => {
    if (step === "progress") return; // block close during import
    close();
  };

  const handleForceToggle = () => {
    setIsForceUpdate((prev) => !prev);
    setValidationError(null);
  };

  // ----- DATA import confirm -----
  const handleDataConfirm = async () => {
    if (isForceUpdate) {
      if (!forceStartDate || !forceEndDate) {
        setValidationError("시작일과 종료일을 모두 선택해주세요.");
        return;
      }
      if (forceStartDate > forceEndDate) {
        setValidationError("시작일은 종료일보다 앞이어야 합니다.");
        return;
      }
    }

    isCancelRef.current = false;
    setProgress(INITIAL_PROGRESS);
    setStep("progress");

    try {
      const reqBody = isForceUpdate
        ? { mode: "force", startDate: forceStartDate, endDate: forceEndDate }
        : { mode: "incremental" };

      const res = await fetch("/api/import/redash", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(reqBody),
      });

      if (!res.ok) {
        const text = await res.text();
        setErrorMessage(text || `HTTP ${res.status}`);
        setResultType("error");
        setStep("result");
        return;
      }
      if (!res.body) {
        setErrorMessage("응답 본문이 비어 있습니다.");
        setResultType("error");
        setStep("result");
        return;
      }

      // NDJSON 라인 단위 파싱
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finalResult: ImportResult | null = null;
      let finalError: { message: string; jobId?: string } | null = null;

      while (true) {
        if (isCancelRef.current) {
          await reader.cancel();
          break;
        }
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? ""; // 마지막 한 줄은 미완성 가능

        for (const line of lines) {
          if (!line.trim()) continue;
          let evt: { type: string } & Record<string, unknown>;
          try {
            evt = JSON.parse(line);
          } catch {
            continue; // 잘못된 라인 무시
          }
          if (evt.type === "progress") {
            // ImportProgress 형식 그대로
            const { type: _t, ...progressFields } = evt;
            setProgress(progressFields as unknown as ImportProgress);
          } else if (evt.type === "result") {
            const { type: _t, ...resultFields } = evt;
            finalResult = resultFields as unknown as ImportResult;
          } else if (evt.type === "error") {
            finalError = {
              message: String(evt.message ?? "알 수 없는 오류"),
              jobId: typeof evt.jobId === "string" ? evt.jobId : undefined,
            };
          }
          // phase 이벤트는 현재 UI 에 영향 없음 (필요 시 phase 별 메시지 추가)
        }
      }

      if (isCancelRef.current) {
        setResultType("cancelled");
        setStep("result");
        return;
      }
      if (finalError) {
        const msg = finalError.jobId
          ? `${finalError.message} (job: ${finalError.jobId})`
          : finalError.message;
        setErrorMessage(msg);
        setResultType("error");
        setStep("result");
        return;
      }
      if (finalResult) {
        setResult(finalResult);
        setResultType(finalResult.success ? "completed" : "error");
        if (!finalResult.success) {
          setErrorMessage(
            finalResult.errors.map((e) => e.message).join("\n") ||
              "알 수 없는 오류가 발생했습니다.",
          );
        }
        setStep("result");
        return;
      }
      // result/error 둘 다 못 받음
      setErrorMessage("스트림이 결과 없이 종료되었습니다.");
      setResultType("error");
      setStep("result");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
      setResultType("error");
      setStep("result");
    }
  };

  const handleCvrForceToggle = () => {
    setCvrIsForceUpdate((prev) => !prev);
    setCvrValidationError(null);
  };

  // ----- CVR import confirm -----
  const handleCvrConfirm = async () => {
    if (cvrIsForceUpdate) {
      if (!cvrForceStartMonth || !cvrForceEndMonth) {
        setCvrValidationError("시작 월과 종료 월을 모두 선택해주세요.");
        return;
      }
      if (cvrForceStartMonth > cvrForceEndMonth) {
        setCvrValidationError("시작 월은 종료 월보다 앞이어야 합니다.");
        return;
      }
    }

    isCancelRef.current = false;
    setProgress(INITIAL_PROGRESS);
    setStep("progress");

    try {
      const importResult = await importCvrData({
        lastDateHint: cvrLastDate,
        onProgress: setProgress,
        onCancel: () => isCancelRef.current,
        forceDateRange: cvrIsForceUpdate
          ? { startMonth: cvrForceStartMonth, endMonth: cvrForceEndMonth }
          : null,
      });

      setResult(importResult);
      setResultType(
        importResult.cancelled ? "cancelled" : importResult.success ? "completed" : "error"
      );
      if (!importResult.success && !importResult.cancelled) {
        setErrorMessage(
          importResult.errors.map((e) => e.message).join("\n") ||
            "알 수 없는 오류가 발생했습니다."
        );
      }
      setStep("result");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
      setResultType("error");
      setStep("result");
    }
  };

  const handleCancelImport = () => {
    isCancelRef.current = true;
  };

  const confirmTitle = importType === "cvr" ? "CVR 업데이트" : "데이터 업데이트";
  const stepTitle: Record<ModalStep, string> = {
    confirm: confirmTitle,
    progress: "Import 진행 중",
    result:
      resultType === "completed"
        ? "Import 완료"
        : resultType === "cancelled"
          ? "Import 취소됨"
          : "Import 실패",
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
        <div className="pointer-events-auto bg-white rounded-2xl shadow-2xl border border-border w-full max-w-md flex flex-col max-h-[70vh]">
          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-4 pb-3 border-b border-border">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "flex items-center justify-center w-8 h-8 rounded-lg",
                  step === "confirm" && importType === "data" && "bg-blue-50",
                  step === "confirm" && importType === "cvr" && "bg-violet-50",
                  step === "progress" && "bg-muted",
                  step === "result" && resultType === "completed" && "bg-green-50",
                  step === "result" && resultType === "cancelled" && "bg-muted",
                  step === "result" && resultType === "error" && "bg-red-50",
                )}
              >
                {step === "confirm" && importType === "data" && <UploadCloud className="w-4 h-4 text-blue-600" />}
                {step === "confirm" && importType === "cvr" && <UploadCloud className="w-4 h-4 text-violet-600" />}
                {step === "progress" && <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />}
                {step === "result" && resultType === "completed" && <CheckCircle className="w-4 h-4 text-green-600" />}
                {step === "result" && resultType === "cancelled" && <XCircle className="w-4 h-4 text-muted-foreground" />}
                {step === "result" && resultType === "error" && <AlertCircle className="w-4 h-4 text-red-600" />}
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

          {/* Tab bar — only shown on confirm step */}
          {step === "confirm" && (
            <div className="flex border-b border-border px-5">
              <button
                type="button"
                onClick={() => setImportType("data")}
                className={cn(
                  "px-4 py-2 text-xs font-semibold border-b-2 -mb-px transition-colors",
                  importType === "data"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                DATA
              </button>
              <button
                type="button"
                onClick={() => setImportType("cvr")}
                className={cn(
                  "px-4 py-2 text-xs font-semibold border-b-2 -mb-px transition-colors",
                  importType === "cvr"
                    ? "border-violet-500 text-violet-600"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                CVR
              </button>
            </div>
          )}

          {/* Step content */}
          <div className="px-6 py-5">
            {step === "confirm" && importType === "data" && (
              <ConfirmStep
                lastDate={lastDate}
                isForceUpdate={isForceUpdate}
                forceStartDate={forceStartDate}
                forceEndDate={forceEndDate}
                onForceToggle={handleForceToggle}
                onStartChange={setForceStartDate}
                onEndChange={setForceEndDate}
                onCancel={handleClose}
                onConfirm={handleDataConfirm}
                validationError={validationError}
              />
            )}
            {step === "confirm" && importType === "cvr" && (
              <CvrConfirmStep
                lastDate={cvrLastDate}
                isForceUpdate={cvrIsForceUpdate}
                forceStartMonth={cvrForceStartMonth}
                forceEndMonth={cvrForceEndMonth}
                onForceToggle={handleCvrForceToggle}
                onStartChange={setCvrForceStartMonth}
                onEndChange={setCvrForceEndMonth}
                onCancel={handleClose}
                onConfirm={handleCvrConfirm}
                validationError={cvrValidationError}
              />
            )}
            {step === "progress" && (
              <ProgressStep
                progress={progress}
                onCancel={handleCancelImport}
              />
            )}
            {step === "result" && resultType && (
              <ResultStep
                resultType={resultType}
                result={result}
                errorMessage={errorMessage}
                onClose={handleClose}
                onViewLog={setActiveLog}
              />
            )}
          </div>
        </div>
      </div>

      {/* Log popup modal */}
      {activeLog && result && (
        <LogTableModal
          type={activeLog}
          result={result}
          onClose={() => setActiveLog(null)}
        />
      )}
    </>
  );
}
