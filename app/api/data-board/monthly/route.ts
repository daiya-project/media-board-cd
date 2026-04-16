/**
 * API route for Data-Board Monthly Phase 3 data.
 *
 * POST /api/data-board/monthly
 * Body: { allMonths: string[] }
 * Response: MonthlyRawRow[]
 *
 * Decouples Phase 3 from the RSC stream so navigation is never blocked.
 */

import { NextResponse } from "next/server";
import { getMonthlyFullData } from "@/lib/api/dataBoardService";

export async function POST(request: Request) {
  try {
    let body: { allMonths?: string[] };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 },
      );
    }
    const allMonths: string[] | undefined = body?.allMonths;

    if (!Array.isArray(allMonths) || allMonths.length === 0) {
      return NextResponse.json(
        { error: "allMonths array is required" },
        { status: 400 },
      );
    }

    const data = await getMonthlyFullData(allMonths);
    return NextResponse.json(data);
  } catch (err) {
    console.error("[POST /api/data-board/monthly]", err);
    return NextResponse.json(
      { error: "Failed to fetch monthly full data" },
      { status: 500 },
    );
  }
}
