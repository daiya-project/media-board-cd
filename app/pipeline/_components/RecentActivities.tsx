"use client";

import { useMemo } from "react";
import {
  Bell,
  MessageSquareText,
  Phone,
  Users,
  FileText,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { extractHeadingPreview } from "@/lib/utils/blocknote-utils";
import { getStageBadgeClass } from "@/lib/utils/table-display-utils";
import { useModalStore } from "@/stores/useModalStore";
import type { RecentActivity } from "@/types/app-db.types";
import type { ActionStage } from "@/types/app-db.types";

// ---------------------------------------------------------------------------
// Stage icon mapping
// ---------------------------------------------------------------------------

const STAGE_ICON: Record<string, typeof Phone> = {
  contact: Phone,
  meeting: Users,
  propose: FileText,
  done: CheckCircle2,
  memo: MessageSquareText,
};

function StageIcon({ stage }: { stage: ActionStage | null }) {
  const Icon = stage ? STAGE_ICON[stage] ?? MessageSquareText : MessageSquareText;
  const colorMap: Record<string, string> = {
    contact: "text-gray-500 bg-gray-100",
    meeting: "text-blue-500 bg-blue-50",
    propose: "text-red-500 bg-red-50",
    done: "text-green-600 bg-green-50",
    memo: "text-purple-500 bg-purple-50",
  };
  const color = stage ? colorMap[stage] ?? "text-gray-400 bg-gray-50" : "text-gray-400 bg-gray-50";

  return (
    <div className={cn("flex items-center justify-center w-9 h-9 rounded-xl shrink-0", color)}>
      <Icon className="w-4 h-4" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Date grouping helper
// ---------------------------------------------------------------------------

function formatRelativeDate(dateStr: string, todayStr: string): string {
  const today = new Date(todayStr + "T00:00:00");
  const date = new Date(dateStr + "T00:00:00");
  const diffDays = Math.floor(
    (today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (diffDays === 0) return "오늘";
  if (diffDays === 1) return "어제";
  if (diffDays < 7) return `${diffDays}일 전`;

  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${month}월 ${day}일`;
}

function groupByDate(
  activities: RecentActivity[],
  todayDate: string,
): { date: string; label: string; items: RecentActivity[] }[] {
  const map = new Map<string, RecentActivity[]>();

  for (const a of activities) {
    const existing = map.get(a.action_date);
    if (existing) {
      existing.push(a);
    } else {
      map.set(a.action_date, [a]);
    }
  }

  return Array.from(map.entries()).map(([date, items]) => ({
    date,
    label: formatRelativeDate(date, todayDate),
    items,
  }));
}

// ---------------------------------------------------------------------------
// Activity item
// ---------------------------------------------------------------------------

function ActivityItem({ activity }: { activity: RecentActivity }) {
  const openModal = useModalStore((s) => s.open);
  const memoPreview = activity.memo
    ? extractHeadingPreview(activity.memo, 80)
    : null;

  const stageLabel = activity.stage
    ? activity.stage.charAt(0).toUpperCase() + activity.stage.slice(1)
    : null;

  function handleMemoClick() {
    if (!activity.memo) return;
    openModal("memoView", {
      memo: activity.memo,
      clientName: activity.client_name,
    });
  }

  return (
    <div className="group flex gap-3 mx-3 px-3 py-3 hover:bg-gray-50/80 transition-colors rounded-xl">
      <StageIcon stage={activity.stage} />

      <div className="flex-1 min-w-0">
        {/* Header: client name + stage badge */}
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-semibold text-gray-900 truncate">
            {activity.client_name}
          </span>
          {stageLabel && (
            <span className={getStageBadgeClass(activity.stage)}>
              {stageLabel}
            </span>
          )}
          {activity.has_followup && (
            <span className="flex items-center justify-center w-4 h-4 rounded-full bg-red-50">
              <Bell className="w-3 h-3 text-red-500 shrink-0" />
            </span>
          )}
        </div>

        {/* Service / Widget info */}
        {(activity.service_id || activity.widget_id) && (
          <p className="text-[11px] text-gray-400 mb-1 truncate">
            {[activity.service_id, activity.widget_id]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}

        {/* Memo preview */}
        {memoPreview && (
          <button
            onClick={handleMemoClick}
            className="text-xs text-gray-500 hover:text-blue-600 transition-colors text-left truncate max-w-full cursor-pointer"
          >
            {memoPreview}
          </button>
        )}
      </div>

      {/* Time */}
      <span className="text-[11px] text-gray-400 tabular-nums shrink-0 mt-0.5">
        {activity.action_date.slice(5).replace("-", "/")}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface RecentActivitiesProps {
  activities: RecentActivity[];
  /** DB latest data date (YYYY-MM-DD) for relative date display. */
  todayDate: string;
}

/**
 * Recent Activities feed — displays a timeline-style list of actions
 * grouped by date, with stage filtering.
 */
export default function RecentActivities({ activities, todayDate }: RecentActivitiesProps) {
  const grouped = useMemo(() => groupByDate(activities, todayDate), [activities, todayDate]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold text-gray-800">Recent Activities</h2>
          <span className="text-[11px] font-medium text-gray-400 tabular-nums">
            {activities.length}
          </span>
        </div>
      </div>

      {/* Activity list */}
      <div className="flex-1 overflow-y-auto">
        {grouped.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
            활동 기록이 없습니다.
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            {grouped.map((group) => (
              <div key={group.date}>
                {/* Date header */}
                <div className="flex items-center gap-2 px-5 pt-3 pb-1.5">
                  <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                    {group.label}
                  </span>
                  <div className="flex-1 h-px bg-gray-100" />
                  <span className="text-[10px] text-gray-300 tabular-nums">
                    {group.date}
                  </span>
                </div>

                {/* Items */}
                {group.items.map((activity) => (
                  <ActivityItem key={activity.action_id} activity={activity} />
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
