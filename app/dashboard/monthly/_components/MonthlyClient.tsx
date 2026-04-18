"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, RefreshCw, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MonthlyBoard } from "@/lib/features/dashboard-monthly/aggregate";
import { MonthlyKpiCardGrid } from "./MonthlyKpiCardGrid";
import { VimpMonthlyChart } from "./VimpMonthlyChart";
import { MfrRevenueDailyChart } from "./MfrRevenueDailyChart";

interface ManagerOption {
  id: number;
  displayName: string;
}

interface Props {
  board: MonthlyBoard;
  latestMonth: string;
  managers: ManagerOption[];
  selectedManagerId: number | null;
}

function shiftMonth(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}`;
}

function formatMonthKr(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  return `${y}년 ${m}월`;
}

export function MonthlyClient({
  board,
  latestMonth,
  managers,
  selectedManagerId,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function navigateMonth(monthKey: string) {
    const next = new URLSearchParams(searchParams);
    if (monthKey === latestMonth) {
      next.delete("month");
    } else {
      next.set("month", monthKey);
    }
    const qs = next.toString();
    startTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    });
  }

  function navigateManager(managerId: number | null) {
    const next = new URLSearchParams(searchParams);
    if (managerId === null) {
      next.delete("owner");
    } else {
      next.set("owner", String(managerId));
    }
    const qs = next.toString();
    startTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    });
  }

  function handleRefresh() {
    startTransition(() => router.refresh());
  }

  const isAtLatest = board.monthKey === latestMonth;
  const selectedManagerName =
    selectedManagerId === null
      ? "팀 전체"
      : managers.find((m) => m.id === selectedManagerId)?.displayName ?? `#${selectedManagerId}`;

  return (
    <div className="space-y-6 p-6">
      {/* Header — manager filter + month selector + refresh */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-gray-800">Monthly</h1>
          <p className="text-xs text-gray-500">
            담당자: <span className="font-semibold text-gray-700">{selectedManagerName}</span>
            {board.vimpGoal !== null && (
              <>
                {" · "}
                월 목표 vIMP{" "}
                <span className="font-semibold text-gray-700 tabular-nums">
                  {board.vimpGoal.toLocaleString("ko-KR")}
                </span>
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* 매니저 필터 */}
          <div className="inline-flex items-center rounded-lg border border-gray-200 bg-white px-3 py-1.5 shadow-sm text-sm">
            <Users className="size-4 text-gray-400 mr-2" />
            <select
              value={selectedManagerId === null ? "" : String(selectedManagerId)}
              onChange={(e) =>
                navigateManager(e.target.value === "" ? null : Number(e.target.value))
              }
              disabled={isPending}
              className="bg-transparent text-gray-700 font-medium focus:outline-none"
            >
              <option value="">팀 전체</option>
              {managers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.displayName}
                </option>
              ))}
            </select>
          </div>

          {/* 월 선택 */}
          <div className="inline-flex items-center rounded-lg border border-gray-200 bg-white shadow-sm">
            <button
              type="button"
              onClick={() => navigateMonth(shiftMonth(board.monthKey, -1))}
              className="flex size-9 items-center justify-center text-gray-600 hover:bg-gray-50 disabled:opacity-40"
              disabled={isPending}
              aria-label="이전 달"
            >
              <ChevronLeft className="size-4" />
            </button>
            <div className="px-4 text-sm font-semibold text-gray-700 tabular-nums">
              {formatMonthKr(board.monthKey)}
            </div>
            <button
              type="button"
              onClick={() => navigateMonth(shiftMonth(board.monthKey, 1))}
              className="flex size-9 items-center justify-center text-gray-600 hover:bg-gray-50 disabled:opacity-40"
              disabled={isPending || isAtLatest}
              aria-label="다음 달"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={isPending}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm transition-colors",
              "hover:bg-gray-50 disabled:opacity-50",
            )}
            aria-label="새로고침"
          >
            <RefreshCw className={cn("size-4", isPending && "animate-spin")} />
            새로고침
          </button>
        </div>
      </header>

      {/* KPI Cards (3) */}
      <MonthlyKpiCardGrid kpis={board.kpis} />

      {/* Chart Section: Monthly (vIMP w/ goal, 50%) + Daily (MFR + Revenue, 50%) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <VimpMonthlyChart
          data={board.monthlyChart}
          monthLabel={board.kpis.monthLabel}
          hasGoal={board.vimpGoal !== null}
        />
        <MfrRevenueDailyChart data={board.dailyChart} monthLabel={board.kpis.monthLabel} />
      </div>
    </div>
  );
}
