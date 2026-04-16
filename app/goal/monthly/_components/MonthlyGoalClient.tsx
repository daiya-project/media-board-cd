"use client";

/**
 * Main client component for the Goal Monthly page.
 *
 * Manages manager tab switching and data re-fetching.
 */

import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import type { MonthlyKpiCard, ClientMonthlyVimpRow } from "@/types/app-db.types";
import type { ManagerRow } from "@/lib/api/managerService";
import type { CumulativeChartPoint } from "@/lib/logic/goalLogic";
import MonthlyKpiCardGrid from "./MonthlyKpiCardGrid";
import CumulativeVimpChart from "./CumulativeVimpChart";
import ClientMonthlyVimpTable from "./ClientMonthlyVimpTable";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Props {
  initialKpiCards: MonthlyKpiCard[];
  initialMonths: string[];
  initialClientRows: ClientMonthlyVimpRow[];
  initialChartPoints: CumulativeChartPoint[];
  initialCurrentMonthKey: string;
  initialMonthGoal: number;
  managers: ManagerRow[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function MonthlyGoalClient({
  initialKpiCards,
  initialMonths,
  initialClientRows,
  initialChartPoints,
  initialCurrentMonthKey,
  initialMonthGoal,
  managers,
}: Props) {
  const [activeManagerId, setActiveManagerId] = useState<number | null>(null);
  const [goalData, setGoalData] = useState({
    kpiCards: initialKpiCards,
    months: initialMonths,
    clientRows: initialClientRows,
    chartPoints: initialChartPoints,
    currentMonthKey: initialCurrentMonthKey,
    monthGoal: initialMonthGoal,
  });
  const [loading, setLoading] = useState(false);

  const { kpiCards, months, clientRows, chartPoints, currentMonthKey, monthGoal } = goalData;

  const handleManagerChange = useCallback(
    async (managerId: number | null) => {
      if (managerId === activeManagerId) return;
      setActiveManagerId(managerId);
      setLoading(true);

      try {
        const params = new URLSearchParams();
        if (managerId !== null) params.set("managerId", String(managerId));

        const res = await fetch(`/api/goal/monthly?${params.toString()}`);
        if (!res.ok) throw new Error("Failed to fetch");

        const data = await res.json();
        setGoalData({
          kpiCards: data.kpiCards,
          months: data.months,
          clientRows: data.clientRows,
          chartPoints: data.chartPoints ?? [],
          currentMonthKey: data.currentMonthKey ?? "",
          monthGoal: data.monthGoal ?? 0,
        });
      } catch (err) {
        console.error("[MonthlyGoalClient] fetch error:", err);
      } finally {
        setLoading(false);
      }
    },
    [activeManagerId],
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">
          월간 vIMP 목표 달성 현황
        </h1>
      </div>

      {/* Manager Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-lg w-fit">
        <button
          onClick={() => handleManagerChange(null)}
          className={cn(
            "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
            activeManagerId === null
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-700",
          )}
        >
          전체
        </button>
        {managers.map((m) => (
          <button
            key={m.id}
            onClick={() => handleManagerChange(m.id)}
            className={cn(
              "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
              activeManagerId === m.id
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700",
            )}
          >
            {m.displayName}
          </button>
        ))}
      </div>

      {/* Content */}
      <div
        className={cn(
          "space-y-6 transition-opacity",
          loading && "opacity-50 pointer-events-none",
        )}
      >
        <MonthlyKpiCardGrid cards={kpiCards} />
        {chartPoints.length > 0 && currentMonthKey && (
          <CumulativeVimpChart
            chartPoints={chartPoints}
            currentMonthKey={currentMonthKey}
            monthGoal={monthGoal}
          />
        )}
        <ClientMonthlyVimpTable months={months} rows={clientRows} />
      </div>
    </div>
  );
}
