/**
 * Goal Monthly page (Server Component).
 *
 * Displays monthly vIMP achievement dashboard with:
 *   - Manager tab filter
 *   - 4 KPI cards (2mo ago, 1mo ago, current actual, current projected)
 *   - Cumulative vIMP chart with projection and goal lines
 *   - Client monthly vIMP table (13 months)
 *
 * force-dynamic: required because Supabase SSR client reads cookies.
 */

import { Suspense } from "react";
import {
  getMonthlyKpiCards,
  getClientMonthlyVimp,
  getCumulativeChartData,
} from "@/lib/api/goalMonthlyService";
import { getTeamGoalsForYear } from "@/lib/api/goalSettingService";
import { getLatestDataDate } from "@/lib/api/dateService";
import { parseYearMonth, toYearMonth } from "@/lib/utils/date-utils";
import { getAllManagers } from "@/lib/api/managerService";
import {
  PageSkeleton,
  CardRowSkeleton,
  TableSkeleton,
} from "@/components/common/PageSkeleton";
import { ErrorFallback } from "@/components/common/ErrorFallback";
import MonthlyGoalClient from "./_components/MonthlyGoalClient";

export const dynamic = "force-dynamic";

export default async function GoalMonthlyPage() {
  // Use DB latest data date (not system clock) for year/month
  const latestDate = await getLatestDataDate();
  if (!latestDate) {
    return (
      <ErrorFallback className="flex-col h-full max-w-[1920px] mx-auto" />
    );
  }
  const [year, currentMonth] = parseYearMonth(toYearMonth(latestDate));

  const result = await Promise.all([
    getMonthlyKpiCards(),
    getClientMonthlyVimp(),
    getAllManagers(),
    getTeamGoalsForYear(year),
  ]).catch((err: unknown) => {
    console.error("[GoalMonthlyPage] data fetch error:", err);
    return null;
  });

  if (!result) {
    return (
      <ErrorFallback className="flex-col h-full max-w-[1920px] mx-auto" />
    );
  }

  const [kpiCards, clientVimp, managers, teamGoals] = result;
  const monthGoal =
    teamGoals.find((g) => {
      const m = Number(g.date_start.split("-")[1]);
      return g.manager_id === null && m === currentMonth;
    })?.vimp_target ?? 0;

  // Fetch chart data with goal
  const chartData = await getCumulativeChartData(null, monthGoal).catch(
    () => null,
  );

  return (
    <div className="flex flex-col h-full max-w-[1920px] mx-auto">
      <Suspense
        fallback={
          <PageSkeleton>
            <CardRowSkeleton count={4} />
            <TableSkeleton cols={14} rows={15} />
          </PageSkeleton>
        }
      >
        <MonthlyGoalClient
          initialKpiCards={kpiCards}
          initialMonths={clientVimp.months}
          initialClientRows={clientVimp.rows}
          initialChartPoints={chartData?.chartPoints ?? []}
          initialCurrentMonthKey={chartData?.currentMonthKey ?? ""}
          initialMonthGoal={monthGoal}
          managers={managers}
        />
      </Suspense>
    </div>
  );
}
