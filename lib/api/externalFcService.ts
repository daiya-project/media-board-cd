/**
 * `/external/fc` 페이지 서버 컴포넌트 payload 조립.
 *
 * 구성:
 *  1. 관리 대상 widget 리스트 (external_mapping 기준)
 *  2. 선택된 widget 의 기간(월) 일자별 DW 메트릭 → ExternalFcAutoInputs[]
 *  3. 선택된 widget 의 external_value 전체 이력
 *  4. latestDate + monthStart/End (월 범위)
 */

import { getLatestDataDate } from "@/lib/api/dateService";
import {
  getExternalMappings,
  getExternalValues,
} from "@/lib/api/externalService";
import { fetchDwFcMetrics } from "@/lib/features/fc-value-sync/redash-fetch";
import { DEFAULT_FC_CONSTANTS } from "@/lib/logic/external-fc-defaults";
import { toYearMonth, getLastDayOfMonth } from "@/lib/utils/date-utils";
import type { ExternalFcPagePayload } from "@/types/fc";
import type { ExternalSource } from "@/types/external";

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
    const apiKey = process.env.REDASH_API_KEY;
    if (!apiKey) {
      throw new Error("REDASH_API_KEY 환경변수가 설정되지 않았습니다");
    }
    const [metrics, prices] = await Promise.all([
      fetchDwFcMetrics({
        widgetId: args.widgetId,
        startDate: monthStart,
        endDate: effectiveEnd,
        apiKey,
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
