/**
 * FC metrics cache sync 잡.
 *
 * 매일 07:30 KST 실행:
 *   1. 관리대상 widget 리스트
 *   2. 각 widget:
 *      - external_fc_daily 에서 해당 widget 의 max(date) 조회
 *      - computeFcSyncRange 로 백필 범위 결정
 *      - fetchDwFcMetrics 로 메트릭 fetch
 *      - upsert into external_fc_daily
 */

import { createCronSupabase } from "@/lib/supabase/cron-client";
import { fetchDwFcMetrics } from "@/lib/features/fc-value-sync/redash-fetch";
import { computeFcSyncRange, type SyncRange } from "./date-range";
import type { ExternalFcAutoInputs } from "@/types/fc";

export interface MetricsSyncResult {
  widgetsChecked: number;
  widgetsUpserted: number;
  rowsUpserted: number;
  failures: number;
  details: Array<{
    widget_id: string;
    status: "skipped" | "upserted" | "error";
    range?: SyncRange;
    rows?: number;
    error?: string;
  }>;
  durationMs: number;
}

export interface RunMetricsSyncOptions {
  now?: Date;
  override?: SyncRange; // 수동 백필용
  widgetIds?: string[]; // 특정 widget 만
}

export async function runFcMetricsSyncJob(
  opts: RunMetricsSyncOptions = {},
): Promise<MetricsSyncResult> {
  const t0 = Date.now();
  const now = opts.now ?? new Date();
  const supabase = createCronSupabase();

  const apiKey = process.env.REDASH_API_KEY;
  if (!apiKey) throw new Error("REDASH_API_KEY 환경변수가 설정되지 않았습니다");

  // 관리대상 widget 결정
  let widgetIds: string[];
  if (opts.widgetIds?.length) {
    widgetIds = [...new Set(opts.widgetIds)];
  } else {
    const { data: mappings, error } = await supabase
      .from("external_mapping")
      .select("widget_id")
      .not("widget_id", "is", null);
    if (error) throw error;
    widgetIds = Array.from(
      new Set(
        (mappings ?? [])
          .map((m) => m.widget_id)
          .filter((id): id is string => !!id),
      ),
    );
  }

  const details: MetricsSyncResult["details"] = [];
  let upsertedWidgets = 0;
  let upsertedRows = 0;
  let failures = 0;

  for (const widgetId of widgetIds) {
    try {
      const { data: latestRow, error: latestErr } = await supabase
        .from("external_fc_daily")
        .select("date")
        .eq("widget_id", widgetId)
        .order("date", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (latestErr) throw latestErr;

      const decision = computeFcSyncRange(
        latestRow?.date ?? null,
        now,
        opts.override,
      );
      if (decision.skip) {
        details.push({ widget_id: widgetId, status: "skipped" });
        continue;
      }

      const metrics = await fetchDwFcMetrics({
        widgetId,
        startDate: decision.range.start,
        endDate: decision.range.end,
        apiKey,
      });
      if (metrics.length === 0) {
        details.push({
          widget_id: widgetId,
          status: "skipped",
          range: decision.range,
          rows: 0,
        });
        continue;
      }

      const rows = metrics.map((m: ExternalFcAutoInputs) => ({
        widget_id: widgetId,
        date: m.date,
        requests: m.requests,
        passback_imp: m.passback_imp,
        vendor_imp: m.vendor_imp,
        dable_media_cost: m.dable_media_cost,
        dable_revenue: m.dable_revenue,
        pb_media_cost: m.pb_media_cost,
        pb_revenue: m.pb_revenue,
        rpm_dashboard: m.rpm_dashboard,
        vendor_source: m.vendor_source,
      }));
      const { error: upErr } = await supabase
        .from("external_fc_daily")
        .upsert(rows as never, { onConflict: "widget_id,date" });
      if (upErr) throw upErr;

      upsertedWidgets += 1;
      upsertedRows += rows.length;
      details.push({
        widget_id: widgetId,
        status: "upserted",
        range: decision.range,
        rows: rows.length,
      });
    } catch (err) {
      failures += 1;
      details.push({
        widget_id: widgetId,
        status: "error",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return {
    widgetsChecked: widgetIds.length,
    widgetsUpserted: upsertedWidgets,
    rowsUpserted: upsertedRows,
    failures,
    details,
    durationMs: Date.now() - t0,
  };
}
