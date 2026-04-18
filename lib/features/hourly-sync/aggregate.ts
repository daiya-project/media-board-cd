/**
 * hourly-sync aggregate — Trino row → media.hourly_snapshot upsert row 변환.
 *
 * SQL 이 이미 (date_kst, hour_kst) 단위로 KR_native 매체 합산을 마쳤으므로
 * 1:1 변환 + 파생 비율 계산 + 미래 시간 skip 만 수행.
 *
 * 파생 공식 (모두 ratio of sums — sum of ratios 금지):
 *  - mfr_pct       = media_fee_krw / revenue_krw × 100
 *  - dable_margin  = revenue_krw - media_fee_krw
 *  - vctr_pct      = clicks / vimp × 100
 *  - cpc           = revenue_krw / clicks
 *  - erpm          = revenue_krw × 1000 / vimp
 *  - fill_rate_pct = ad_response_items / ad_request_items × 100
 *
 * 미래 시간 skip — revenue_self_dsp == 0 AND vimp == 0 AND impressions == 0 일 때
 * cron 이 매시 돌면서 unfilled 시간 빈 row 가 누적되는 것 방지.
 */

import type { TrinoHourlyRow } from "./redash-fetch";

export interface HourlySnapshotUpsertRow {
  date_kst: string;
  hour_kst: number;
  revenue_self_dsp_krw: number;
  revenue_passback_krw: number;
  revenue_krw: number;
  media_fee_self_dsp_krw: number;
  media_fee_passback_krw: number;
  media_fee_krw: number;
  mfr_pct: number | null;
  dable_margin_krw: number;
  impressions: number;
  vimp: number;
  clicks: number;
  passback_imp: number;
  vctr_pct: number | null;
  cpc: number | null;
  erpm: number | null;
  ad_request_items: number | null;
  ad_response_items: number | null;
  fill_rate_pct: number | null;
  cutoff_kst_hour: number | null;
}

function roundTo(n: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(n * factor) / factor;
}

function transformRow(row: TrinoHourlyRow): HourlySnapshotUpsertRow | null {
  const revenue = row.revenue_krw;
  const mediaFee = row.media_fee_krw;
  const vimp = row.vimp;
  const clicks = row.clicks;
  const adReq = row.ad_request_items ?? 0;
  const adResp = row.ad_response_items ?? 0;

  // 미래 시간 padding 행 skip
  if (
    row.revenue_self_dsp_krw === 0 &&
    vimp === 0 &&
    row.impressions === 0
  ) {
    return null;
  }

  return {
    date_kst: row.date_kst,
    hour_kst: row.hour_kst,
    revenue_self_dsp_krw: row.revenue_self_dsp_krw,
    revenue_passback_krw: row.revenue_passback_krw,
    revenue_krw: revenue,
    media_fee_self_dsp_krw: row.media_fee_self_dsp_krw,
    media_fee_passback_krw: row.media_fee_passback_krw,
    media_fee_krw: mediaFee,
    mfr_pct: revenue > 0 ? roundTo((mediaFee * 100) / revenue, 2) : null,
    dable_margin_krw: revenue - mediaFee,
    impressions: row.impressions,
    vimp,
    clicks,
    passback_imp: row.passback_imp,
    vctr_pct: vimp > 0 ? roundTo((clicks * 100) / vimp, 4) : null,
    cpc: clicks > 0 ? roundTo(revenue / clicks, 2) : null,
    erpm: vimp > 0 ? roundTo((revenue * 1000) / vimp, 2) : null,
    ad_request_items: row.ad_request_items,
    ad_response_items: row.ad_response_items,
    fill_rate_pct: adReq > 0 ? roundTo((adResp * 100) / adReq, 2) : null,
    cutoff_kst_hour: row.cutoff_kst_hour,
  };
}

/** Trino 결과 row[] → upsert row[]. 미래 시간 자동 skip. */
export function buildUpsertRows(
  trinoRows: TrinoHourlyRow[],
): HourlySnapshotUpsertRow[] {
  const out: HourlySnapshotUpsertRow[] = [];
  for (const r of trinoRows) {
    const row = transformRow(r);
    if (row) out.push(row);
  }
  return out;
}
