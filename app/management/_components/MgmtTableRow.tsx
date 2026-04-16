"use client";

import { Bell, BellOff, Clock, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getTierBadgeClass,
  getStageBadgeClass,
  getOwnerBadgeClass,
  getFollowupButtonClass,
  getContactStatusStyle,
  TABLE_TD_CLASS,
} from "@/lib/utils/table-display-utils";
import type { MgmtTableRow as MgmtRow, BlockNoteContent } from "@/types/app-db.types";
import { useModalStore } from "@/stores/useModalStore";
import { extractHeadingPreview } from "@/lib/utils/blocknote-utils";

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  // YYYY-MM-DD → MM월 DD일
  const parts = dateStr.split("-");
  if (parts.length === 3) return `${parts[1]}월 ${parts[2]}일`;
  return dateStr;
}

function capitalizeFirst(s: string | null): string {
  if (!s) return "";
  return s[0].toUpperCase() + s.slice(1);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface Props {
  row: MgmtRow;
}

/**
 * Single row in the MGMT management table.
 * Renders tier badge, stage badge, follow-up indicator, and inline action buttons.
 */
export default function MgmtTableRow({ row }: Props) {
  const { open } = useModalStore();

  const tierBadgeClass = getTierBadgeClass(row.tier);

  const statusStyle = getContactStatusStyle(row.contactStatus);

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors group">
      {/* Contact Status */}
      <td className={cn(TABLE_TD_CLASS, "text-center")} style={{ width: 60, minWidth: 60, maxWidth: 60 }}>
        {row.contactStatus && row.contactStatus !== "excluded" ? (
          <span
            className={cn("inline-block w-2.5 h-2.5 rounded-full", statusStyle.dot)}
            title={row.contactStatus}
          />
        ) : (
          <span className="text-xs text-gray-300">-</span>
        )}
      </td>

      {/* DATE */}
      <td className={cn(TABLE_TD_CLASS, "text-center")} style={{ width: 100, minWidth: 100, maxWidth: 100 }}>
        <span className="text-xs text-gray-600 tabular-nums">
          {formatDate(row.lastDate)}
        </span>
      </td>

      {/* 매중도 (Tier) */}
      <td className={cn(TABLE_TD_CLASS, "text-center")} style={{ width: 80, minWidth: 80, maxWidth: 80 }}>
        {row.tier ? (
          <span className={tierBadgeClass}>{row.tier}</span>
        ) : (
          <span className="text-xs text-gray-300">-</span>
        )}
      </td>

      {/* CLIENT */}
      <td
        className={cn(TABLE_TD_CLASS, "relative")}
        style={{ width: 250, minWidth: 250, maxWidth: 250 }}
      >
        <button
          type="button"
          onClick={() => open("clientOverview", { clientId: row.client_id })}
          className="w-full pr-8 text-xs text-left overflow-hidden text-ellipsis whitespace-nowrap text-gray-800 hover:text-blue-600 transition-colors cursor-pointer"
          title={row.client_name}
        >
          <span className="text-gray-500 mr-1 tabular-nums">{row.client_id}.</span>
          {row.client_name}
        </button>
      </td>

      {/* History count */}
      <td className={cn(TABLE_TD_CLASS, "text-center")} style={{ width: 80, minWidth: 80, maxWidth: 80 }}>
        {row.actionCount > 0 ? (
          <button
            type="button"
            onClick={() => open("actionHistory", { clientId: row.client_id, clientName: row.client_name })}
            className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded bg-gray-100 text-gray-600 text-xs font-mono hover:bg-blue-100 hover:text-blue-700 transition-colors cursor-pointer"
          >
            {row.actionCount}
          </button>
        ) : (
          <span className="text-xs text-gray-300">0</span>
        )}
      </td>

      {/* Follow-up */}
      <td className={cn(TABLE_TD_CLASS, "text-center")} style={{ width: 80, minWidth: 80, maxWidth: 80 }}>
        {row.followupCount > 0 ? (
          <button
            type="button"
            onClick={() => open("followup", { clientId: row.client_id })}
            title={`팔로업 ${row.followupCount}건`}
            className={getFollowupButtonClass(true)}
          >
            <Bell className="w-3.5 h-3.5" />
          </button>
        ) : (
          <span className={getFollowupButtonClass(false)}>
            <BellOff className="w-3.5 h-3.5" />
          </span>
        )}
      </td>

      {/* 담당자 (Owner) */}
      <td className={cn(TABLE_TD_CLASS, "text-center")} style={{ width: 100, minWidth: 100, maxWidth: 100 }}>
        {row.managerName ? (
          <span className={getOwnerBadgeClass(row.manager_id)}>
            {row.managerName}
          </span>
        ) : (
          <span className="text-xs text-gray-300">-</span>
        )}
      </td>

      {/* STAGE */}
      <td
        className={cn(TABLE_TD_CLASS, "relative text-center")}
        style={{ width: 120, minWidth: 120, maxWidth: 120 }}
      >
        <span className={getStageBadgeClass(row.currentStage)}>
          {capitalizeFirst(row.currentStage) || "-"}
        </span>
        <button
          type="button"
          onClick={() => open("recordAction", { clientId: row.client_id, clientName: row.client_name })}
          title="액션 추가"
          className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-blue-600"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </td>

      {/* MEMO */}
      <td className={cn(TABLE_TD_CLASS, "text-left")} style={{ width: 300, minWidth: 300, maxWidth: 300 }}>
        {row.lastMemo ? (() => {
          const preview = extractHeadingPreview(row.lastMemo, 60);
          return preview ? (
            <button
              type="button"
              onClick={() => open("memoView", { memo: row.lastMemo })}
              className={cn(
                "text-xs text-left w-full overflow-hidden text-ellipsis whitespace-nowrap",
                "text-gray-600 hover:text-blue-600 hover:underline transition-colors cursor-pointer",
              )}
              title={preview}
            >
              {preview}
            </button>
          ) : (
            <span className="text-xs text-gray-300">-</span>
          );
        })() : (
          <span className="text-xs text-gray-300">-</span>
        )}
      </td>

      {/* NAME */}
      <td className={cn(TABLE_TD_CLASS, "text-left")} style={{ width: 150, minWidth: 150, maxWidth: 150 }}>
        <span className="text-xs text-gray-700">{row.contact_name ?? "-"}</span>
      </td>

      {/* PHONE */}
      <td className={cn(TABLE_TD_CLASS, "text-left")} style={{ width: 150, minWidth: 150, maxWidth: 150 }}>
        <span className="text-xs text-gray-700">{row.contact_phone ?? "-"}</span>
      </td>

      {/* E-MAIL */}
      <td className={cn(TABLE_TD_CLASS, "text-left")} style={{ width: 200, minWidth: 200, maxWidth: 200 }}>
        <span className="text-xs text-gray-700">{row.contact_email ?? "-"}</span>
      </td>

      {/* D-Day (days remaining) */}
      <td className={cn(TABLE_TD_CLASS, "text-center")} style={{ width: 80, minWidth: 80, maxWidth: 80 }}>
        {row.daysRemaining !== null ? (
          <span
            className={cn(
              "text-xs font-medium tabular-nums",
              row.daysRemaining < 0 && "text-red-600 font-bold",
              row.daysRemaining >= 0 && row.daysRemaining <= 7 && "text-amber-600",
              row.daysRemaining > 7 && row.daysRemaining <= 30 && "text-blue-500",
              row.daysRemaining > 30 && "text-gray-400",
            )}
          >
            {row.daysRemaining < 0 ? `${row.daysRemaining}일` : `${row.daysRemaining}일`}
          </span>
        ) : (
          <span className="text-xs text-gray-300">-</span>
        )}
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Skeleton row (loading placeholder)
// ---------------------------------------------------------------------------

export function MgmtTableRowSkeleton() {
  return (
    <tr className="border-b border-gray-100">
      {Array.from({ length: 13 }).map((_, i) => (
        <td key={i} className={TABLE_TD_CLASS}>
          <div className="h-3 bg-muted rounded animate-pulse" />
        </td>
      ))}
    </tr>
  );
}

// ---------------------------------------------------------------------------
// History sub-row (inline action history expand)
// ---------------------------------------------------------------------------

interface HistoryRowProps {
  actionDate: string;
  stage: string | null;
  memo: BlockNoteContent | null;
  hasFollowup: boolean;
}

export function MgmtHistorySubRow({
  actionDate,
  stage,
  memo,
  hasFollowup,
}: HistoryRowProps) {
  return (
    <tr className="bg-gray-50 border-b border-gray-100 animate-[slideDown_0.2s_ease-out]">
      <td className="py-1.5 px-4 text-center">
        <span className="text-[0.7rem] font-mono text-gray-500">
          {formatDate(actionDate)}
        </span>
      </td>
      <td className="py-1.5 px-4" />
      <td className="py-1.5 px-4" />
      <td className="py-1.5 px-4" />
      <td className="py-1.5 px-4 text-center">
        {hasFollowup && (
          <Clock className="w-3 h-3 text-red-500 inline" />
        )}
      </td>
      <td className="py-1.5 px-4" />
      <td className="py-1.5 px-4 text-center">
        <span className={cn(getStageBadgeClass(stage), "text-[0.7rem]")}>
          {capitalizeFirst(stage)}
        </span>
      </td>
      <td colSpan={4} className="py-1.5 px-4">
        <span className="text-[0.7rem] text-gray-500 line-clamp-1">{extractHeadingPreview(memo, 60)}</span>
      </td>
    </tr>
  );
}
