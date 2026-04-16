"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { useModalStore } from "@/stores/useModalStore";
import { useToastStore } from "@/stores/useToastStore";
import { createAction, updateAction, getActionById } from "@/lib/api/actionService";
import type { CascadeSelection } from "@/components/common/CascadeSelector";
import type { ActionStage, BlockNoteContent } from "@/types/app-db.types";
import { ActionFormFields } from "./ActionFormFields";

// Lazy-load BlockNote editor to avoid SSR issues and reduce initial bundle
const MemoEditor = dynamic(() => import("../MemoEditor"), { ssr: false });

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const labelClass = "block text-[12px] font-medium text-gray-500 mb-1";

import { getTodayString } from "@/lib/utils/date-utils";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Modal for creating or editing an action record.
 * Opens when useModalStore.openModal === "recordAction".
 * 
 * Modes:
 * - Create: payload has clientId (optional clientName)
 * - Edit: payload has editActionId
 */
export function RecordActionModal() {
  const { openModal, payload, close } = useModalStore();
  const addToast = useToastStore((s) => s.add);
  const router = useRouter();

  // Form state
  const [cascade, setCascade] = useState<CascadeSelection>({
    clientId: null,
    clientName: null,
    serviceId: null,
    widgetId: null,
  });
  const [stage, setStage] = useState<ActionStage | "">("memo");
  const [actionDate, setActionDate] = useState(getTodayString);
  const [memo, setMemo] = useState<BlockNoteContent | null>(null);
  const [hasFollowup, setHasFollowup] = useState(false);

  // UI state
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOpen = openModal === "recordAction";
  const clientId = payload?.clientId as string | undefined;
  const clientName = payload?.clientName as string | undefined;
  const editActionId = payload?.editActionId as number | undefined;
  const isEditMode = !!editActionId;

  // Load action data when editing
  useEffect(() => {
    if (!isOpen || !editActionId) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    getActionById(editActionId)
      .then((action) => {
        if (cancelled) return;
        setCascade({
          clientId: action.client_id,
          clientName: null,
          serviceId: action.service_id,
          widgetId: action.widget_id,
        });
        setStage(action.stage || "memo");
        setActionDate(action.action_date);
        setMemo(action.memo);
        setHasFollowup(action.has_followup);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const msg =
          err instanceof Error
            ? err.message
            : "액션 정보를 불러올 수 없습니다.";
        setError(msg);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, editActionId]);

  // Reset form when modal opens
  const handleCascadeChange = useCallback((sel: CascadeSelection) => {
    setCascade(sel);
  }, []);

  // Memoize initial key to reset form each time modal opens
  const formKey = useMemo(
    () => (isOpen ? `${clientId || editActionId}-${Date.now()}` : "closed"),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isOpen],
  );

  if (!isOpen) return null;

  const hasPresetClient = !!clientId || isEditMode;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Validation
    const effectiveClientId = clientId ?? cascade.clientId;
    if (!effectiveClientId && !isEditMode) {
      setError("Client를 선택해주세요.");
      return;
    }
    if (!stage) {
      setError("Stage를 선택해주세요.");
      return;
    }
    if (!actionDate) {
      setError("날짜를 입력해주세요.");
      return;
    }

    setSubmitting(true);
    try {
      if (isEditMode && editActionId) {
        // Update existing action
        await updateAction(editActionId, {
          service_id: cascade.serviceId,
          widget_id: cascade.widgetId,
          action_date: actionDate,
          stage: (stage as ActionStage) || null,
          memo: memo,
          has_followup: hasFollowup,
        });
      } else {
        // Create new action
        await createAction({
          client_id: effectiveClientId!,
          service_id: cascade.serviceId,
          widget_id: cascade.widgetId,
          action_date: actionDate,
          stage: (stage as ActionStage) || null,
          memo: memo,
          has_followup: hasFollowup,
        });
      }

      // Reset form state
      setStage("memo");
      setActionDate(getTodayString());
      setMemo(null);
      setHasFollowup(false);
      setError(null);

      addToast({
        type: "success",
        message: isEditMode ? "액션이 수정되었습니다." : "액션이 등록되었습니다.",
      });
      close();
      router.refresh();
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : isEditMode
          ? "액션 수정에 실패했습니다."
          : "액션 등록에 실패했습니다.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  function handleClose() {
    if (submitting) return;
    setStage("");
    setActionDate(getTodayString());
    setMemo(null);
    setHasFollowup(false);
    setError(null);
    setLoading(false);
    close();
  }

  const modalTitle = isEditMode ? "액션 수정" : "액션 등록";
  const submitButtonText = submitting
    ? isEditMode
      ? "수정 중..."
      : "저장 중..."
    : isEditMode
    ? "수정"
    : "저장";

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Modal panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={modalTitle}
        className="fixed inset-0 z-[71] flex items-center justify-center p-4 pointer-events-none"
      >
        <div className="pointer-events-auto bg-white rounded-2xl shadow-2xl border border-border w-full max-w-4xl max-h-[70vh] flex flex-col text-[12px]">
          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-4 pb-3 border-b border-border shrink-0">
            <h2 className="text-sm font-bold text-foreground">{modalTitle}</h2>
            <button
              type="button"
              onClick={handleClose}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="닫기"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-12">
              <p className="text-sm text-gray-500">로딩 중...</p>
            </div>
          )}

          {/* Form — two-column: left fields, right memo (full height) */}
          {!loading && (
            <form
              onSubmit={handleSubmit}
              className="flex gap-6 px-6 py-4"
              key={formKey}
            >
              {/* Left column — form fields */}
              <ActionFormFields
                clientId={clientId}
                clientName={clientName}
                cascade={cascade}
                onCascadeChange={handleCascadeChange}
                lockClient={hasPresetClient}
                stage={stage}
                onStageChange={setStage}
                actionDate={actionDate}
                onDateChange={setActionDate}
                hasFollowup={hasFollowup}
                onFollowupChange={setHasFollowup}
                error={error}
              />

            {/* Right column — Memo editor (stretches to match left column height) */}
            <div className="flex-1 min-w-0 flex flex-col">
              <label className={labelClass}>Memo</label>
              <div className="flex-1 [&>div]:h-full [&_.bn-container]:h-full [&_.bn-editor]:h-full">
                <MemoEditor 
                  onChange={setMemo}
                  initialContent={memo}
                  key={`memo-${formKey}`}
                />
              </div>
            </div>
          </form>
          )}

          {/* Footer */}
          <div className="border-t border-border px-6 py-3 flex justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={handleClose}
              disabled={submitting}
              className="px-3 py-1.5 text-[12px] rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              취소
            </button>
            <button
              type="submit"
              form={undefined}
              onClick={(e) => {
                e.currentTarget
                  .closest("[role='dialog']")
                  ?.querySelector("form")
                  ?.requestSubmit();
              }}
              disabled={submitting}
              className="px-3 py-1.5 text-[12px] rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {submitButtonText}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
