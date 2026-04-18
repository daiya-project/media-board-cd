/**
 * Dashboard — Monthly 섹션.
 *
 * KPI 카드 (vIMP / 매출 / MFR) + Monthly vIMP 차트 (월 목표 라인 포함) + Daily MFR×Revenue 차트.
 * URL params:
 *  - ?month=YYYY-MM (생략 시 latest 월)
 *  - ?manager=N    (생략 시 팀 전체)
 */

import { Suspense } from "react";
import {
  PageSkeleton,
  CardRowSkeleton,
  ChartSkeleton,
} from "@/components/common/PageSkeleton";
import { ErrorFallback } from "@/components/common/ErrorFallback";
import { fetchMonthlyBoard } from "@/lib/features/dashboard-monthly/monthly-board-reader";
import { getAllManagers } from "@/lib/api/managerService";
import { MonthlyClient } from "./_components/MonthlyClient";

export const dynamic = "force-dynamic";

function MonthlySkeleton() {
  return (
    <PageSkeleton>
      <CardRowSkeleton count={3} />
      <ChartSkeleton />
    </PageSkeleton>
  );
}

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function todayKstMonthKey(): string {
  const utc = new Date();
  const kst = new Date(utc.getTime() + 9 * 60 * 60 * 1000);
  return `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(2, "0")}`;
}

async function MonthlySection({
  monthKey,
  managerId,
}: {
  monthKey?: string;
  managerId: number | null;
}) {
  try {
    const [board, managers] = await Promise.all([
      fetchMonthlyBoard({ monthKey, managerId }),
      getAllManagers(),
    ]);
    return (
      <MonthlyClient
        board={board}
        latestMonth={todayKstMonthKey()}
        managers={managers.map((m) => ({ id: m.id, displayName: m.displayName }))}
        selectedManagerId={managerId}
      />
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[dashboard/monthly] data fetch failed", { error: msg });
    return <ErrorFallback className="flex-col h-full p-6" />;
  }
}

export default async function MonthlyPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const monthParam = typeof params.month === "string" ? params.month : undefined;
  const monthKey = monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : undefined;
  const managerParam = typeof params.manager === "string" ? params.manager : undefined;
  const managerId =
    managerParam && /^\d+$/.test(managerParam) ? Number(managerParam) : null;

  return (
    <div className="flex flex-col h-full max-w-[1920px] mx-auto">
      <Suspense fallback={<MonthlySkeleton />}>
        <MonthlySection monthKey={monthKey} managerId={managerId} />
      </Suspense>
    </div>
  );
}
