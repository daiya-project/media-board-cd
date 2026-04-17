/**
 * FC 리포트 행 도출. 엑셀 `FC관리` 시트의 33컬럼 1:1 재현.
 *
 * 변경점 (2026-04-17):
 *  - `ExternalFcInputs` 수동 입력 제거. MFR 3종(N/O/P)은 DW auto input 에서 자동 계산.
 *  - `fc_amount` 는 `UnitPriceValue.fc` (for date) 에서 읽어 표시 (계산 미사용).
 *
 * 공식 상세는 spec §4 참조.
 */

import type {
  ExternalFcAutoInputs,
  ExternalFcConstants,
  ExternalFcRow,
  PassbackVendorSlug,
} from "@/types/fc";
import type { ExternalValueRow, UnitPriceValue } from "@/types/external";
import { findUnitPriceForDate } from "./external-unit-price";

function safeDiv(n: number, d: number): number {
  return d === 0 ? 0 : n / d;
}

function pickVendorPrice(
  price: UnitPriceValue,
  slug: PassbackVendorSlug | null,
): number {
  if (!slug) return 0;
  return price[slug] ?? 0;
}

export function deriveFcRow(
  auto: ExternalFcAutoInputs,
  prices: ExternalValueRow[],
  constants: ExternalFcConstants,
  widgetId: string,
): ExternalFcRow {
  const pricesSorted = [...prices].sort((a, b) =>
    a.start_date.localeCompare(b.start_date),
  );
  const price = findUnitPriceForDate(pricesSorted, auto.date);

  const S = price.internal ?? 0;
  const T = pickVendorPrice(price, auto.vendor_source);
  const FC = price.fc ?? null;

  const D = auto.requests;
  const G = auto.passback_imp;
  const E = Math.max(D - G, 0);
  const I = 0;                              // spec §4: 현재 항상 0
  const J = auto.vendor_imp;
  const M = auto.rpm_dashboard;

  // 비율
  const F = safeDiv(E, D);
  const H = safeDiv(G, D);
  const K = G - J - I;
  const L = safeDiv(M, constants.rpm_obi_ratio);

  // MFR 3종 (자동)
  const O = safeDiv(auto.dable_media_cost, auto.dable_revenue);
  const P = safeDiv(auto.pb_media_cost, auto.pb_revenue);
  const N = safeDiv(
    auto.dable_media_cost + auto.pb_media_cost,
    auto.dable_revenue + auto.pb_revenue,
  );

  // 데이블 블록
  const AB = O;
  const AA = AB === 0 ? 0 : safeDiv(S, AB);
  const Y = (E / 1000) * AA;
  const Z = Y * constants.ad_revenue_rate;
  const X = Y * constants.server_cost_rate;
  const W = Z * constants.apc_rate;
  const V = (E / 1000) * S;
  const U =
    Y * constants.fn_media_weight + Z * constants.fn_ad_weight;
  const R = U - (V + W + X);

  // 패스백 블록
  const AF = (G / 1000) * T;
  const AG = AF;
  const AE = AF * constants.server_cost_rate * constants.pb_server_discount;
  const AD = (G / 1000) * S;
  const AC =
    AF * constants.fn_media_weight + AG * constants.fn_ad_weight;
  const Smargin = AC - (AD + AE);

  // 종합
  const Q = R + Smargin;
  const T_margin = safeDiv(Q, D) * 1000;

  return {
    date: auto.date,
    widget_id: widgetId,

    fc_amount: FC,
    requests: D,
    dable_response: E,
    passback_requests: G,
    dable_passback_imp: I,
    vendor_imp: J,
    rpm_dashboard: M,

    response_rate: F,
    passback_rate: H,
    lost_imp: K,
    rpm_obi: L,

    total_mfr: N,
    dable_mfr: O,
    vendor_mfr: P,

    dable_fn_revenue: U,
    dable_media_cost: V,
    dable_apc: W,
    dable_server_cost: X,
    dable_media_revenue: Y,
    dable_ad_revenue: Z,
    dable_cpm: AA,
    dable_mfr_ref: AB,
    dable_margin: R,

    pb_fn_revenue: AC,
    pb_media_cost: AD,
    pb_server_cost: AE,
    pb_media_revenue: AF,
    pb_ad_revenue: AG,
    vendor_margin: Smargin,

    contribution_margin: Q,
    total_rpm_margin: T_margin,
  };
}

export function deriveFcRows(
  autoInputs: ExternalFcAutoInputs[],
  prices: ExternalValueRow[],
  constants: ExternalFcConstants,
  widgetId: string,
): ExternalFcRow[] {
  return autoInputs
    .map((auto) => deriveFcRow(auto, prices, constants, widgetId))
    .sort((a, b) => b.date.localeCompare(a.date));
}
