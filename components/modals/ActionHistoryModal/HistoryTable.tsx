"use client";

import { useState } from "react";
import { Bell, Loader2, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useModalStore } from "@/stores/useModalStore";
import { useToastStore } from "@/stores/useToastStore";
import { softDeleteAction } from "@/lib/api/actionService";
import { getStageBadgeClass } from "@/lib/utils/table-display-utils";
import { extractHeadingPreview } from "@/lib/utils/blocknote-utils";
import { EmptyState } from "@/components/common/EmptyState";
import type { ActionRow } from "./ActionHistoryModal";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function capitalizeFirst(s: string | null): string {
  if (!s) return "";
  return s[0].toUpperCase() + s.slice(1);
}

function formatDateShort(dateStr: string | null): string {
  if (!dateStr) return "-";
  return dateStr; // Already YYYY-MM-DD format
}

// ---------------------------------------------------------------------------
// HistoryTable
// ---------------------------------------------------------------------------

interface HistoryTableProps {
  actions: ActionRow[];
  showMajorOnly: boolean;
  setActions: React.Dispatch<React.SetStateAction<ActionRow[]>>;
  onActionDeleted: () => void;
}

/**
 * Table displaying action history rows with edit/delete controls.
 */
export function HistoryTable({ actions, showMajorOnly, setActions, onActionDeleted }: HistoryTableProps) {
  const { open, close } = useModalStore();
  const addToast = useToastStore((s) => s.add);
  const [deletingActionId, setDeletingActionId] = useState<number | null>(null);

  function handleEdit(actionId: number) {
    close(); // Close action history modal
    open("recordAction", { editActionId: actionId });
  }

  function handleViewMemo(memo: ActionRow["memo"]) {
    open("memoView", { memo });
  }

  async function handleDelete(actionId: number) {
    if (!confirm("해당 세일즈 액션을 삭제하시겠습니까?")) {
      return;
    }

    setDeletingActionId(actionId);
    try {
      await softDeleteAction(actionId);
      // Remove from local state
      setActions((prev) => prev.filter((a) => a.action_id !== actionId));
      addToast({ type: "success", message: "액션이 삭제되었습니다." });
      // Notify parent to refresh MGMT table
      onActionDeleted();
    } catch {
      addToast({ type: "error", message: "액션 삭제에 실패했습니다." });
    } finally {
      setDeletingActionId(null);
    }
  }

  if (actions.length === 0) {
    return (
      <EmptyState
        className="py-12"
        message={showMajorOnly
          ? "주요 액션이 없습니다 (F/up 또는 Propose 상태)"
          : "등록된 액션이 없습니다"}
      />
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs" style={{ minWidth: 800 }}>
          <colgroup>
            <col style={{ width: 100 }} />
            <col style={{ width: 140 }} />
            <col style={{ width: 100 }} />
            <col style={{ width: 120 }} />
            <col style={{ width: "auto" }} />
            <col style={{ width: 60 }} />
            <col style={{ width: 60 }} />
            <col style={{ width: 60 }} />
          </colgroup>
          <thead>
            <tr className="bg-gray-50/50 border-b border-gray-100">
              <th className="px-3 py-2 text-center font-bold text-gray-500 uppercase tracking-wide">
                날짜
              </th>
              <th className="px-3 py-2 text-center font-bold text-gray-500 uppercase tracking-wide">
                Stage
              </th>
              <th className="px-3 py-2 text-center font-bold text-gray-500 uppercase tracking-wide">
                Service
              </th>
              <th className="px-3 py-2 text-center font-bold text-gray-500 uppercase tracking-wide">
                Widget
              </th>
              <th className="px-3 py-2 text-center font-bold text-gray-500 uppercase tracking-wide">
                Memo
              </th>
              <th className="px-3 py-2 text-center font-bold text-gray-500 uppercase tracking-wide">
                F/up
              </th>
              <th className="px-3 py-2 text-center font-bold text-gray-500 uppercase tracking-wide">
                수정
              </th>
              <th className="px-3 py-2 text-center font-bold text-gray-500 uppercase tracking-wide">
                삭제
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {actions.map((action, index) => (
              <ActionRowItem
                key={action.action_id}
                action={action}
                index={index}
                onEdit={handleEdit}
                onViewMemo={handleViewMemo}
                onDelete={handleDelete}
                isDeleting={deletingActionId === action.action_id}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ActionRowItem
// ---------------------------------------------------------------------------

interface ActionRowItemProps {
  action: ActionRow;
  index: number;
  onEdit: (actionId: number) => void;
  onViewMemo: (memo: ActionRow["memo"]) => void;
  onDelete: (actionId: number) => void;
  isDeleting: boolean;
}

function ActionRowItem({ action, index, onEdit, onViewMemo, onDelete, isDeleting }: ActionRowItemProps) {
  const bgClass = index % 2 === 0 ? "bg-white" : "bg-gray-50/30";
  const stageBadgeClass = getStageBadgeClass(action.stage);
  const stageText = capitalizeFirst(action.stage);

  const memoPreview = extractHeadingPreview(action.memo, 60);

  return (
    <tr className={cn(bgClass, "hover:bg-blue-50/50 transition-colors")}>
      {/* 날짜 */}
      <td className="px-3 py-2.5 text-center text-xs text-gray-600">
        {formatDateShort(action.action_date)}
      </td>

      {/* Stage */}
      <td className="px-3 py-2.5 text-center">
        <div className="inline-flex items-center gap-1">
          {action.stage ? (
            <span className={stageBadgeClass}>{stageText}</span>
          ) : (
            <span className="text-gray-400 text-xs">-</span>
          )}
        </div>
      </td>

      {/* Service */}
      <td className="px-3 py-2.5 text-center">
        {action.service_id ? (
          <span className="text-xs text-gray-600">{action.service_id}</span>
        ) : (
          <span className="text-gray-400 text-xs">-</span>
        )}
      </td>

      {/* Widget */}
      <td className="px-3 py-2.5 text-center">
        {action.widget_id ? (
          <span className="text-xs text-gray-600">{action.widget_id}</span>
        ) : (
          <span className="text-gray-400 text-xs">-</span>
        )}
      </td>

      {/* Memo */}
      <td className="px-3 py-2.5 text-center">
        {memoPreview ? (
          <button
            type="button"
            onClick={() => onViewMemo(action.memo)}
            className="text-xs text-gray-700 hover:text-blue-600 hover:underline transition-colors cursor-pointer"
            title={memoPreview}
          >
            {memoPreview}
          </button>
        ) : (
          <span className="text-gray-400 text-xs">-</span>
        )}
      </td>

      {/* F/up */}
      <td className="px-3 py-2.5 text-center">
        {action.has_followup ? (
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-100 text-red-600">
            <Bell className="w-3.5 h-3.5" />
          </span>
        ) : (
          <span className="text-gray-300 text-xs">-</span>
        )}
      </td>

      {/* 수정 */}
      <td className="px-3 py-2.5 text-center">
        <button
          type="button"
          onClick={() => onEdit(action.action_id)}
          className="inline-flex items-center justify-center w-6 h-6 rounded hover:bg-gray-200 text-gray-400 hover:text-blue-600 transition-colors"
          title="액션 수정"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
      </td>

      {/* 삭제 */}
      <td className="px-3 py-2.5 text-center">
        <button
          type="button"
          onClick={() => onDelete(action.action_id)}
          disabled={isDeleting}
          className="inline-flex items-center justify-center w-6 h-6 rounded hover:bg-red-100 text-gray-400 hover:text-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="액션 삭제"
        >
          {isDeleting ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Trash2 className="w-3.5 h-3.5" />
          )}
        </button>
      </td>
    </tr>
  );
}
