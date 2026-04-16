/**
 * POST /api/external/sync
 *
 * Fetches external data from KL Media and SyncMedia, then upserts to DB.
 * Body: { startDate: string, endDate: string } (YYYY-MM-DD)
 */

import { NextResponse } from "next/server";
import { syncExternalData } from "@/lib/api/externalService";

export async function POST(request: Request) {
  try {
    let body: { startDate?: string; endDate?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 },
      );
    }

    const { startDate, endDate } = body;
    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "startDate and endDate are required (YYYY-MM-DD)" },
        { status: 400 },
      );
    }

    const result = await syncExternalData(startDate, endDate);
    return NextResponse.json({ ok: true, synced: result });
  } catch (err) {
    console.error("[POST /api/external/sync]", err);
    return NextResponse.json(
      { error: "Failed to sync external data" },
      { status: 500 },
    );
  }
}
