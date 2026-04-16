/**
 * API route for Dashboard Phase 3 service-level data.
 *
 * POST /api/dashboard/service-data
 * Body: { dates: string[], clientIds: string[] | null }
 * Response: DailyServiceRow[]
 *
 * Decouples Phase 3 from the RSC stream so navigation is never blocked.
 */

import { NextResponse } from "next/server";
import { getServiceData } from "@/lib/api/boardService";

export async function POST(request: Request) {
  let body: { dates?: string[]; clientIds?: string[] | null };
  try {
    const text = await request.text();
    body = text ? JSON.parse(text) : {};
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }
  const dates: string[] = body?.dates ?? [];
  const clientIds: string[] | null = body?.clientIds ?? null;

  if (!Array.isArray(dates) || dates.length === 0) {
    return NextResponse.json(
      { error: "dates array is required" },
      { status: 400 },
    );
  }

  try {
    const data = await getServiceData(dates, clientIds);
    return NextResponse.json(data);
  } catch (err) {
    console.error("[POST /api/dashboard/service-data]", err);
    return NextResponse.json(
      { error: "Failed to fetch service data" },
      { status: 500 },
    );
  }
}
