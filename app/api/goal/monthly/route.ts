/**
 * API Route: Goal Monthly — KPI cards + client monthly vimp table + chart.
 *
 * GET /api/goal/monthly?managerId=1
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getMonthlyKpiCards,
  getClientMonthlyVimp,
  getCumulativeChartData,
} from "@/lib/api/goalMonthlyService";
import { getTeamGoalsForYear, getManagerGoalsForYear } from "@/lib/api/goalSettingService";
import { getLatestDataDate } from "@/lib/api/dateService";
import { parseYearMonth, toYearMonth } from "@/lib/utils/date-utils";

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const managerIdRaw = sp.get("managerId");
    const managerId = managerIdRaw ? Number(managerIdRaw) : null;

    // Use DB latest data date (not system clock) for year/month
    const latestDate = await getLatestDataDate();
    if (!latestDate) {
      return NextResponse.json({ error: "No data dates found" }, { status: 500 });
    }
    const [year, currentMonth] = parseYearMonth(toYearMonth(latestDate));

    const goalPromise = managerId
      ? getManagerGoalsForYear(year)
      : getTeamGoalsForYear(year);

    const [kpiCards, clientVimp, goals] = await Promise.all([
      getMonthlyKpiCards(managerId),
      getClientMonthlyVimp(managerId),
      goalPromise,
    ]);

    // Find goal for current month
    const monthGoal = goals.find((g) => {
      const m = Number(g.date_start.split("-")[1]);
      return managerId
        ? g.manager_id === managerId && m === currentMonth
        : g.manager_id === null && m === currentMonth;
    });

    const chartData = await getCumulativeChartData(
      managerId,
      monthGoal?.vimp_target ?? 0,
    );

    return NextResponse.json({
      kpiCards,
      months: clientVimp.months,
      clientRows: clientVimp.rows,
      chartPoints: chartData.chartPoints,
      currentMonthKey: chartData.currentMonthKey,
      monthGoal: monthGoal?.vimp_target ?? 0,
    });
  } catch (error) {
    console.error("[API /api/goal/monthly] GET error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch monthly goal data",
      },
      { status: 500 },
    );
  }
}
