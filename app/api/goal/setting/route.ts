/**
 * API Route: Goal Setting — team/manager monthly vIMP goals.
 *
 * GET  /api/goal/setting?year=2026
 * POST /api/goal/setting  { managerId, monthStart, monthEnd, vimpTarget }
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getTeamGoalsForYear,
  getManagerGoalsForYear,
  upsertMonthlyGoal,
} from "@/lib/api/goalSettingService";
import { getLatestDataDate } from "@/lib/api/dateService";

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const yearParam = sp.get("year");
    let year: number;
    if (yearParam) {
      year = Number(yearParam);
    } else {
      const latestDate = await getLatestDataDate();
      year = latestDate ? Number(latestDate.split("-")[0]) : new Date().getFullYear();
    }

    const [teamGoals, managerGoals] = await Promise.all([
      getTeamGoalsForYear(year),
      getManagerGoalsForYear(year),
    ]);

    return NextResponse.json({ teamGoals, managerGoals });
  } catch (error) {
    console.error("[API /api/goal/setting] GET error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch goal data",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      managerId,
      monthStart,
      monthEnd,
      vimpTarget,
    }: {
      managerId: number | null;
      monthStart: string;
      monthEnd: string;
      vimpTarget: number;
    } = body;

    if (!monthStart || !monthEnd || vimpTarget === undefined) {
      return NextResponse.json(
        { error: "Missing required fields: monthStart, monthEnd, vimpTarget" },
        { status: 400 },
      );
    }

    await upsertMonthlyGoal(managerId, monthStart, monthEnd, vimpTarget);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API /api/goal/setting] POST error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to save goal",
      },
      { status: 500 },
    );
  }
}
