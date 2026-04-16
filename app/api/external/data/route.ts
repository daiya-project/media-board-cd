/**
 * POST /api/external/data
 *
 * Returns external daily data + mappings + internal daily for a date range.
 * Body: { startDate: string, endDate: string }
 */

import { NextResponse } from "next/server";
import {
  getExternalDaily,
  getExternalMappings,
  getExternalValues,
  getInternalDailyForWidgets,
} from "@/lib/api/externalService";

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

    const [externalRows, mappings, unitPrices] = await Promise.all([
      getExternalDaily(startDate, endDate),
      getExternalMappings(),
      getExternalValues(),
    ]);

    // Extract mapped widget_ids and fetch internal daily data
    const widgetIds = [
      ...new Set(mappings.map((m) => m.widget_id).filter((id): id is string => id != null)),
    ];
    const internalRows = await getInternalDailyForWidgets(widgetIds, startDate, endDate);

    return NextResponse.json({ externalRows, mappings, unitPrices, internalRows });
  } catch (err) {
    console.error("[POST /api/external/data]", err);
    return NextResponse.json(
      { error: "Failed to fetch external data" },
      { status: 500 },
    );
  }
}
