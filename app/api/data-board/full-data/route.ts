/**
 * API route for Data-Board Phase 3 widget-level data.
 *
 * POST /api/data-board/full-data
 * Body: { dates: string[] }
 * Response: DailyRawRow[]
 *
 * Decouples Phase 3 from the RSC stream so navigation is never blocked.
 */

import { NextResponse } from "next/server";
import { getDataBoardFullData } from "@/lib/api/dataBoardService";

export async function POST(request: Request) {
  try {
    let body: { dates?: string[] };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 },
      );
    }
    const dates: string[] | undefined = body?.dates;

    if (!Array.isArray(dates) || dates.length === 0) {
      return NextResponse.json(
        { error: "dates array is required" },
        { status: 400 },
      );
    }

    const data = await getDataBoardFullData(dates);
    return NextResponse.json(data);
  } catch (err) {
    console.error("[POST /api/data-board/full-data]", err);
    return NextResponse.json(
      { error: "Failed to fetch daily full data" },
      { status: 500 },
    );
  }
}
