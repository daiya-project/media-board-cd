/**
 * API route for Data-Board Weekly Phase 3 widget-level data.
 *
 * POST /api/data-board/weekly
 * Body: { allWeeks: { year: number; weekNumber: number; label: string }[] }
 * Response: WeeklyRawRow[]
 *
 * Decouples Phase 3 from the RSC stream so navigation is never blocked.
 */

import { NextResponse } from "next/server";
import { getWeeklyFullData } from "@/lib/api/dataBoardService";

export async function POST(request: Request) {
  try {
    let body: { allWeeks?: { year: number; weekNumber: number; label: string }[] };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 },
      );
    }
    const allWeeks = body?.allWeeks;

    if (!Array.isArray(allWeeks) || allWeeks.length === 0) {
      return NextResponse.json(
        { error: "allWeeks array is required" },
        { status: 400 },
      );
    }

    const data = await getWeeklyFullData(allWeeks);
    return NextResponse.json(data);
  } catch (err) {
    console.error("[POST /api/data-board/weekly]", err);
    return NextResponse.json(
      { error: "Failed to fetch weekly full data" },
      { status: 500 },
    );
  }
}
