"use client";

/**
 * Inline-editable 12-month goal setting table.
 *
 * Rows: 12 months (Jan–Dec)
 * Columns: Team Goal | Total | Gap | Manager1 | Manager2 | ...
 *
 * Double-click a cell to edit, Enter to save, Escape to cancel.
 */

import { useState, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { formatNumberForDisplay } from "@/lib/utils/number-utils";
import { useToastStore } from "@/stores/useToastStore";
import type { GoalRow } from "@/types/app-db.types";
import type { ManagerRow } from "@/lib/api/managerService";
import { calcGap } from "@/lib/logic/goalLogic";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Props {
  year: number;
  teamGoals: GoalRow[];
  managerGoals: GoalRow[];
  managers: ManagerRow[];
}

interface CellKey {
  month: number; // 1-12
  managerId: number | null; // null = team
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getLastDayOfMonth(year: number, month: number): string {
  const lastDay = new Date(year, month, 0).getDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
}

function getMonthStart(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

function buildGoalMap(
  goals: GoalRow[],
): Map<string, number> {
  const map = new Map<string, number>();
  for (const g of goals) {
    // key = "managerId|month" where managerId = "null" for team
    const monthNum = Number(g.date_start.split("-")[1]);
    const key = `${g.manager_id ?? "null"}|${monthNum}`;
    map.set(key, g.vimp_target);
  }
  return map;
}

/** 1–12 month indices, pre-computed to avoid re-creation on each render. */
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function GoalSettingTable({
  year,
  teamGoals,
  managerGoals,
  managers,
}: Props) {
  const [goalMap, setGoalMap] = useState(() =>
    buildGoalMap([...teamGoals, ...managerGoals]),
  );
  const [editingCell, setEditingCell] = useState<CellKey | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const addToast = useToastStore((s) => s.add);

  const getGoal = useCallback(
    (managerId: number | null, month: number): number => {
      return goalMap.get(`${managerId ?? "null"}|${month}`) ?? 0;
    },
    [goalMap],
  );

  const getManagerTotal = useCallback(
    (month: number): number => {
      let total = 0;
      for (const m of managers) {
        total += getGoal(m.id, month);
      }
      return total;
    },
    [managers, getGoal],
  );

  // Start editing
  const handleDoubleClick = useCallback(
    (managerId: number | null, month: number) => {
      const current = getGoal(managerId, month);
      setEditingCell({ month, managerId });
      setEditValue(current > 0 ? String(current) : "");
      setTimeout(() => inputRef.current?.focus(), 0);
    },
    [getGoal],
  );

  // Save cell
  const handleSave = useCallback(async () => {
    if (!editingCell || saving) return;

    const value = Number(editValue) || 0;
    const { managerId, month } = editingCell;

    setSaving(true);
    try {
      const monthStart = getMonthStart(year, month);
      const monthEnd = getLastDayOfMonth(year, month);

      const res = await fetch("/api/goal/setting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          managerId,
          monthStart,
          monthEnd,
          vimpTarget: value,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Save failed");
      }

      // Update local state
      setGoalMap((prev) => {
        const next = new Map(prev);
        next.set(`${managerId ?? "null"}|${month}`, value);
        return next;
      });
    } catch (err) {
      console.error("[GoalSettingTable] save error:", err);
      addToast({ type: "error", message: "목표 저장에 실패했습니다." });
    } finally {
      setSaving(false);
      setEditingCell(null);
    }
  }, [editingCell, editValue, saving, year]);

  // Cancel editing
  const handleCancel = useCallback(() => {
    setEditingCell(null);
  }, []);

  // Handle key events
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSave();
      } else if (e.key === "Escape") {
        handleCancel();
      }
    },
    [handleSave, handleCancel],
  );

  const isEditing = (managerId: number | null, month: number) =>
    editingCell?.managerId === managerId && editingCell?.month === month;

  const months = MONTHS;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">
          {year}년 월간 vIMP 목표 설정
        </h1>
      </div>

      <div className="overflow-x-auto border border-gray-200 rounded-xl">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wide text-gray-500 whitespace-nowrap sticky left-0 bg-gray-50 z-10">
                월
              </th>
              <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wide text-blue-600 whitespace-nowrap min-w-[120px]">
                Team Goal
              </th>
              <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wide text-gray-500 whitespace-nowrap min-w-[120px]">
                Total
              </th>
              <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wide text-gray-500 whitespace-nowrap min-w-[100px]">
                Gap
              </th>
              {managers.map((m) => (
                <th
                  key={m.id}
                  className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wide text-gray-500 whitespace-nowrap min-w-[120px]"
                >
                  {m.displayName}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {months.map((month) => {
              const teamGoal = getGoal(null, month);
              const managerTotal = getManagerTotal(month);
              const rawGap = calcGap(teamGoal, managerTotal);
              const gap = Math.abs(rawGap) <= 101 ? 0 : rawGap;

              return (
                <tr
                  key={month}
                  className="border-b border-gray-100 hover:bg-gray-50/50"
                >
                  {/* Month label */}
                  <td className="px-4 py-2.5 text-center font-medium text-gray-700 sticky left-0 bg-white z-10 whitespace-nowrap">
                    {year}년 {String(month).padStart(2, "0")}월
                  </td>

                  {/* Team Goal (editable) */}
                  <td
                    className="px-4 py-2.5 text-right tabular-nums cursor-pointer"
                    onDoubleClick={() => handleDoubleClick(null, month)}
                  >
                    {isEditing(null, month) ? (
                      <input
                        ref={inputRef}
                        type="number"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onBlur={handleSave}
                        disabled={saving}
                        className="w-full text-right bg-blue-50 border border-blue-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                      />
                    ) : (
                      <span className="text-blue-600 font-medium tabular-nums">
                        {teamGoal > 0 ? formatNumberForDisplay(teamGoal) : "—"}
                      </span>
                    )}
                  </td>

                  {/* Total (computed) */}
                  <td className="px-4 py-2.5 text-right tabular-nums text-gray-600">
                    {managerTotal > 0
                      ? formatNumberForDisplay(managerTotal)
                      : "—"}
                  </td>

                  {/* Gap (computed) */}
                  <td
                    className={cn(
                      "px-4 py-2.5 text-right tabular-nums font-medium",
                      gap > 0
                        ? "text-red-500"
                        : gap < 0
                          ? "text-amber-500"
                          : "text-gray-400",
                    )}
                  >
                    {teamGoal > 0 || managerTotal > 0
                      ? formatNumberForDisplay(gap)
                      : "—"}
                  </td>

                  {/* Manager columns (editable) */}
                  {managers.map((m) => {
                    const value = getGoal(m.id, month);
                    return (
                      <td
                        key={m.id}
                        className="px-4 py-2.5 text-right tabular-nums cursor-pointer"
                        onDoubleClick={() => handleDoubleClick(m.id, month)}
                      >
                        {isEditing(m.id, month) ? (
                          <input
                            ref={inputRef}
                            type="number"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            onBlur={handleSave}
                            disabled={saving}
                            className="w-full text-right bg-blue-50 border border-blue-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                          />
                        ) : (
                          <span className="text-gray-700">
                            {value > 0
                              ? formatNumberForDisplay(value)
                              : "—"}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400">
        셀을 더블클릭하여 편집 · Enter로 저장 · Esc로 취소
      </p>
    </div>
  );
}
