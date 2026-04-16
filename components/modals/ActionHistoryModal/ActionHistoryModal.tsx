"use client";

import { useState, useEffect, useMemo } from "react";
import { X, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useModalStore } from "@/stores/useModalStore";
import { getActionsByClient } from "@/lib/api/actionService";
import type { BlockNoteContent, ActionStage } from "@/types/app-db.types";
import { ErrorFallback } from "@/components/common/ErrorFallback";
import { HistoryTable } from "./HistoryTable";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ActionRow {
  action_id: number;
  action_date: string;
  stage: ActionStage | null;
  service_id: string | null;
  widget_id: string | null;
  memo: BlockNoteContent | null;
  has_followup: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Modal displaying action history for a specific client.
 * Opens when useModalStore.openModal === "actionHistory".
 */
export function ActionHistoryModal() {
  const router = useRouter();
  const { openModal, payload, close } = useModalStore();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actions, setActions] = useState<ActionRow[]>([]);
  const [showMajorOnly, setShowMajorOnly] = useState(false);

  const isOpen = openModal === "actionHistory";
  const clientId = payload?.clientId as string | undefined;
  const clientName = payload?.clientName as string | undefined;

  // Filter actions (major = has_followup OR stage=propose)
  const filteredActions = useMemo(() => {
    if (!showMajorOnly) return actions;
    return actions.filter(
      (a) => a.has_followup === true || a.stage === "propose"
    );
  }, [actions, showMajorOnly]);

  // Fetch actions when modal opens
  useEffect(() => {
    if (!isOpen || !clientId) return;

    setLoading(true);
    setError(null);
    setActions([]);
    setShowMajorOnly(false);

    getActionsByClient(clientId)
      .then((data) => {
        setActions(data);
        setLoading(false);
      })
      .catch((err: unknown) => {
        const msg =
          err instanceof Error ? err.message : "데이터를 불러올 수 없습니다.";
        setError(msg);
        setLoading(false);
      });
  }, [isOpen, clientId]);

  if (!isOpen) return null;

  const title = clientName
    ? `${clientId}. ${clientName} - Action History`
    : `${clientId} - Action History`;

  function handleClose() {
    close();
  }

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
        aria-label="Action History"
        className="fixed inset-0 z-[71] flex items-center justify-center p-4 pointer-events-none"
      >
        <div className="pointer-events-auto bg-white rounded-2xl shadow-2xl border border-border w-full max-w-5xl flex flex-col max-h-[85vh]">
          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-4 pb-3 shrink-0 border-b border-border">
            <h2 className="text-sm font-bold text-foreground">{title}</h2>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showMajorOnly}
                  onChange={(e) => setShowMajorOnly(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-xs font-medium text-gray-700">
                  주요 액션만 보기
                </span>
              </label>
              <button
                type="button"
                onClick={handleClose}
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="닫기"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {loading && (
              <div className="text-center py-12 text-gray-400">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3" />
                <p className="text-sm">로딩 중...</p>
              </div>
            )}
            {error && (
              <ErrorFallback
                className="py-12"
                message="데이터를 불러오는데 실패했습니다"
                detail={error}
              />
            )}
            {!loading && !error && (
              <HistoryTable
                actions={filteredActions}
                showMajorOnly={showMajorOnly}
                setActions={setActions}
                onActionDeleted={() => router.refresh()}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
}
