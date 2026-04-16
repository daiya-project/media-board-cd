/**
 * API route for MA Charts Phase 3 service-level full data.
 *
 * POST /api/charts/ma/full-data
 * Body: { dates: string[] }
 * Response: DailyServiceRow[]
 *
 * Decouples Phase 3 from the RSC stream so navigation is never blocked.
 */

import { NextResponse } from "next/server";
import { getServiceData } from "@/lib/api/boardService";

export async function POST(request: Request) {
  const body = await request.json();
  const dates: string[] = body?.dates;

  if (!Array.isArray(dates) || dates.length === 0) {
    return NextResponse.json(
      { error: "dates array is required" },
      { status: 400 },
    );
  }

  try {
    const data = await getServiceData(dates, null);
    return NextResponse.json(data);
  } catch (err) {
    console.error("[POST /api/charts/ma/full-data]", err);
    return NextResponse.json(
      { error: "Failed to fetch MA chart full data" },
      { status: 500 },
    );
  }
}
