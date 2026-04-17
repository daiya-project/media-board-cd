/**
 * FC value sync 잡 오케스트레이션.
 *
 * 호출자:
 *  - cron.ts (자동, 매일 07:00 KST)
 *  - app/api/fc/sync/route.ts (관리 페이지의 수동 트리거)
 *
 * 흐름:
 *   1. cookie-free Supabase 클라이언트 생성
 *   2. 관리 대상 widget 리스트 (external_mapping.widget_id IS NOT NULL)
 *   3. 각 widget:
 *        - DW snapshot fetch (S/T/FC)
 *        - latest active external_value 조회
 *        - diff → 변경 시 새 row insert (start_date=today)
 */

import { createCronSupabase } from "@/lib/supabase/cron-client";
import { fetchDwSnapshot } from "./redash-fetch";
import { unitPriceChanged, mergeSnapshot } from "./diff";
import type { UnitPriceValue } from "@/types/external";
import type { Json } from "@/types/database.types";

export interface SyncResult {
  widgetsChecked: number;
  widgetsInserted: number;
  failures: number;
  details: Array<{ widget_id: string; changed: boolean; error?: string }>;
  durationMs: number;
}

function toKstDateString(utc: Date): string {
  const kstMs = utc.getTime() + 9 * 60 * 60 * 1000;
  return new Date(kstMs).toISOString().slice(0, 10);
}

export async function runFcValueSyncJob(now: Date = new Date()): Promise<SyncResult> {
  const t0 = Date.now();
  const supabase = createCronSupabase();
  const apiKey = process.env.REDASH_API_KEY;
  if (!apiKey) {
    throw new Error("REDASH_API_KEY 환경변수가 설정되지 않았습니다");
  }
  const today = toKstDateString(now);

  // 관리 대상 widget 리스트
  const { data: mappings, error: mapErr } = await supabase
    .from("external_mapping")
    .select("widget_id")
    .not("widget_id", "is", null);
  if (mapErr) throw mapErr;
  const widgetIds = Array.from(
    new Set((mappings ?? []).map((m) => m.widget_id).filter((id): id is string => !!id)),
  );

  const details: SyncResult["details"] = [];
  let inserted = 0;
  let failures = 0;

  for (const widgetId of widgetIds) {
    try {
      const snap = await fetchDwSnapshot({ widgetId, date: today, apiKey });

      const { data: latestRows, error: latestErr } = await supabase
        .from("external_value")
        .select("*")
        .eq("widget_id", widgetId)
        .is("end_date", null)
        .order("start_date", { ascending: false })
        .limit(1);
      if (latestErr) throw latestErr;
      const latest = latestRows?.[0]?.value as UnitPriceValue | undefined;

      if (!unitPriceChanged(latest ?? {}, snap)) {
        details.push({ widget_id: widgetId, changed: false });
        continue;
      }

      const merged = mergeSnapshot(latest ?? {}, snap);
      const { error: insErr } = await supabase.from("external_value").insert({
        widget_id: widgetId,
        value: merged as Json,
        start_date: today,
        end_date: null,
      });
      if (insErr) throw insErr;
      inserted += 1;
      details.push({ widget_id: widgetId, changed: true });
    } catch (err) {
      failures += 1;
      details.push({
        widget_id: widgetId,
        changed: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return {
    widgetsChecked: widgetIds.length,
    widgetsInserted: inserted,
    failures,
    details,
    durationMs: Date.now() - t0,
  };
}
