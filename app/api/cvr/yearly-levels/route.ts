/**
 * API route for CVR Phase 2 — yearly level history.
 *
 * POST /api/cvr/yearly-levels
 * Body: { month: string }  (YYYY-MM)
 * Response: CvrYearlyLevels
 *
 * Lazy-loaded when the user switches to the yearly view.
 */

import { NextResponse } from "next/server";
import { getCvrYearlyLevels } from "@/lib/api/cvrService";

export async function POST(request: Request) {
  try {
    let body: { month?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 },
      );
    }
    const month: string | undefined = body?.month;

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json(
        { error: "month (YYYY-MM) is required" },
        { status: 400 },
      );
    }

    const data = await getCvrYearlyLevels(month);
    return NextResponse.json(data);
  } catch (err) {
    console.error("[POST /api/cvr/yearly-levels]", err);
    return NextResponse.json(
      { error: "Failed to fetch yearly levels" },
      { status: 500 },
    );
  }
}
