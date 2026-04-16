/**
 * API route for lazy-loading widget-level daily data.
 *
 * POST /api/charts/widget-data
 * Body: { dates: string[] }
 * Response: DailyRawRow[]
 *
 * Used by the Moving Average chart when switching to widget mode.
 * Fires one query per date in parallel for optimal index usage.
 */

import { NextResponse } from "next/server";
import { createMediaClient } from "@/lib/supabase/media-server";
import { mapBaseMetrics, mapClientService, mapWidget } from "@/lib/api/rowMappers";
import { BATCH_SIZE } from "@/lib/config";
import type { DailyRawRow } from "@/types/app-db.types";

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

    const supabase = await createMediaClient();

    const COLS =
      "date, client_id, client_name, service_id, service_name, " +
      "widget_id, widget_name, cost_spent, ad_revenue, imp, vimp, cnt_click";

    async function fetchDate(date: string): Promise<DailyRawRow[]> {
      const rows: DailyRawRow[] = [];
      let offset = 0;

      while (true) {
        const { data, error } = await supabase
          .from("v_daily")
          .select(COLS)
          .eq("date", date)
          .order("client_id", { ascending: true })
          .range(offset, offset + BATCH_SIZE - 1);

        if (error) throw error;
        if (!data || data.length === 0) break;

        for (const row of data) {
          const r = row as Record<string, unknown>;
          rows.push({
            date: r.date as string,
            ...mapClientService(r),
            ...mapWidget(r),
            ...mapBaseMetrics(r),
          });
        }

        if (data.length < BATCH_SIZE) break;
        offset += BATCH_SIZE;
      }

      return rows;
    }

    const results = await Promise.all(dates.map(fetchDate));
    return NextResponse.json(results.flat());
  } catch (err) {
    console.error("[POST /api/charts/widget-data]", err);
    return NextResponse.json(
      { error: "Failed to fetch widget data" },
      { status: 500 },
    );
  }
}
