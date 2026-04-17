/**
 * `/external/fc` 페이지 서버 컴포넌트 payload 조립.
 *
 * 구성:
 *  1. 관리 대상 widget 리스트 (external_mapping 기준)
 *  2. 선택된 widget 의 기간(월) 일자별 DW 메트릭 → ExternalFcAutoInputs[]
 *     (media.external_total_daily 캐시에서 읽음 — fc-metrics-sync cron 이 매일 07:30 KST upsert)
 *  3. 선택된 widget 의 external_value 전체 이력
 *  4. latestDate + monthStart/End (월 범위)
 */

import { getLatestDataDate } from "@/lib/api/dateService";
import {
  getExternalMappings,
  getExternalValues,
} from "@/lib/api/externalService";
import { createMediaClient } from "@/lib/supabase/media-server";
import { DEFAULT_FC_CONSTANTS } from "@/lib/logic/external-fc-defaults";
import { toYearMonth, getLastDayOfMonth } from "@/lib/utils/date-utils";
import type { ExternalFcAutoInputs, ExternalFcPagePayload } from "@/types/fc";
import type { ExternalSource } from "@/types/external";
import type { Database } from "@/types/database.types";

type ExternalFcDailyRow = Database["media"]["Tables"]["external_total_daily"]["Row"];

/** widget 피커 options — external_mapping.widget_id IS NOT NULL 에서 추출. */
export async function listManagedWidgets(): Promise<
  ExternalFcPagePayload["widgets"]
> {
  const mappings = await getExternalMappings();
  const uniq = new Map<
    string,
    { label: string; source: ExternalSource | null }
  >();
  for (const m of mappings) {
    if (!m.widget_id) continue;
    if (uniq.has(m.widget_id)) continue;
    uniq.set(m.widget_id, {
      label: m.label ?? m.external_key,
      source: m.source,
    });
  }
  return Array.from(uniq.entries()).map(([widget_id, info]) => ({
    widget_id,
    label: info.label,
    source: info.source,
  }));
}

/** 선택된 widget 의 external_value 이력 전량. */
async function getValuesForWidget(
  widgetId: string,
): Promise<ExternalFcPagePayload["unitPrices"]> {
  const all = await getExternalValues();
  return all.filter((v) => v.widget_id === widgetId);
}

/** media.external_total_daily 캐시에서 기간 내 일자별 메트릭 조회. */
async function readFcMetricsFromCache(opts: {
  widgetId: string;
  startDate: string;
  endDate: string;
}): Promise<ExternalFcAutoInputs[]> {
  const supabase = await createMediaClient();
  const { data, error } = await supabase
    .from("external_total_daily")
    .select("*")
    .eq("widget_id", opts.widgetId)
    .gte("date", opts.startDate)
    .lte("date", opts.endDate)
    .order("date", { ascending: true });
  if (error) {
    console.error("[externalFcService] cache read failed:", error);
    return [];
  }
  return ((data ?? []) as ExternalFcDailyRow[]).map((r) => ({
    date: r.date,
    requests: r.requests ?? 0,
    passback_imp: r.passback_imp ?? 0,
    vendor_imp: r.vendor_imp ?? 0,
    dable_media_cost: Number(r.dable_media_cost ?? 0),
    dable_revenue: Number(r.dable_revenue ?? 0),
    pb_media_cost: Number(r.pb_media_cost ?? 0),
    pb_revenue: Number(r.pb_revenue ?? 0),
    rpm_dashboard: Number(r.rpm_dashboard ?? 0),
    vendor_source: (r.vendor_source ?? null) as ExternalFcAutoInputs["vendor_source"],
  }));
}

export interface GetExternalFcPayloadArgs {
  widgetId: string | null;
  monthYm?: string; // "YYYY-MM". 기본 = latestDate 기준.
}

export async function getExternalFcPayload(
  args: GetExternalFcPayloadArgs,
): Promise<ExternalFcPagePayload> {
  const latestDate = await getLatestDataDate();
  if (!latestDate) {
    throw new Error("latestDate 를 찾을 수 없습니다 (media.v_dates 비어있음)");
  }

  const ym = args.monthYm ?? toYearMonth(latestDate);
  const monthStart = `${ym}-01`;
  const monthEnd = getLastDayOfMonth(ym);
  const effectiveEnd = monthEnd > latestDate ? latestDate : monthEnd;

  const widgets = await listManagedWidgets();

  let autoInputs: ExternalFcPagePayload["autoInputs"] = [];
  let unitPrices: ExternalFcPagePayload["unitPrices"] = [];

  if (args.widgetId) {
    const [metrics, prices] = await Promise.all([
      readFcMetricsFromCache({
        widgetId: args.widgetId,
        startDate: monthStart,
        endDate: effectiveEnd,
      }),
      getValuesForWidget(args.widgetId),
    ]);
    autoInputs = metrics;
    unitPrices = prices;
  }

  return {
    widgetId: args.widgetId,
    widgets,
    autoInputs,
    unitPrices,
    constants: DEFAULT_FC_CONSTANTS,
    latestDate,
    monthStart,
    monthEnd: effectiveEnd,
  };
}
