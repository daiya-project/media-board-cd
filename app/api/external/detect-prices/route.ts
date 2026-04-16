/**
 * POST /api/external/detect-prices
 *
 * Detects CPM unit price changes from external daily data (revenue / imp * 1000)
 * and upserts detected periods into media.external_value.
 *
 * Body: { startDate: string, endDate: string, dryRun?: boolean }
 *   - dryRun=true: returns detected periods without inserting
 *   - dryRun=false (default): detects and inserts
 *
 * Response: { periods: DetectedCpmPeriod[], upserted: number }
 */

import { NextResponse } from "next/server";
import {
  getExternalDaily,
  getExternalMappings,
  upsertExternalValues,
} from "@/lib/api/externalService";
import {
  detectCpmPeriods,
  cpmPeriodsToValueRows,
} from "@/lib/logic/external-logic";

export async function POST(request: Request) {
  try {
    let body: { startDate?: string; endDate?: string; dryRun?: boolean };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 },
      );
    }

    const { startDate, endDate, dryRun = false } = body;
    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "startDate and endDate are required (YYYY-MM-DD)" },
        { status: 400 },
      );
    }

    // Fetch external daily data + mappings
    const [externalRows, mappings] = await Promise.all([
      getExternalDaily(startDate, endDate),
      getExternalMappings(),
    ]);

    // Detect CPM periods
    const periods = detectCpmPeriods(externalRows, mappings);

    let upserted = 0;
    if (!dryRun) {
      const valueRows = cpmPeriodsToValueRows(periods);
      upserted = await upsertExternalValues(valueRows);
    }

    return NextResponse.json({ periods, upserted });
  } catch (err) {
    console.error("[POST /api/external/detect-prices]", err);
    return NextResponse.json(
      { error: "Failed to detect prices" },
      { status: 500 },
    );
  }
}
