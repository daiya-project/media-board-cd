/**
 * FC report formulas — mirrors _planning/external.xlsx FC관리 sheet.
 *
 * All computed columns (K, L, Q, R, S, T, U, V, W, X, Y, Z, AA, AB, AC, AD, AE, AF, AG)
 * are derived from manual inputs (B, N, O, P), auto inputs (D, E, I, J, M), and
 * per-widget constants from external_fc_config + unit prices from external_value.
 */

import type {
  ExternalFcConfig,
  ExternalFcInputs,
  ExternalFcAutoInputs,
  ExternalFcRow,
  ExternalValueRow,
  ExternalSource,
} from "@/types/external";
import { findUnitPriceForDate } from "./external-unit-price";

/** Safe division: returns 0 when denominator is 0. */
function safeDiv(n: number, d: number): number {
  return d === 0 ? 0 : n / d;
}

/**
 * Derives a single FC row from inputs, unit prices, and config.
 *
 * @param inputs  - manual daily inputs (B, N, O, P); null values treated as 0 for math
 * @param auto    - DW/internal auto inputs (D, E, I, J, M)
 * @param prices  - sorted external_value rows for this widget
 * @param config  - widget-level constants
 * @param source  - vendor source (syncmedia/klmedia) — determines T lookup
 */
export function deriveFcRow(
  inputs: ExternalFcInputs,
  auto: ExternalFcAutoInputs,
  prices: ExternalValueRow[],
  config: ExternalFcConfig,
  source: ExternalSource,
): ExternalFcRow {
  const price = findUnitPriceForDate(prices, inputs.date);
  const S = price.internal ?? 0;           // 데이블 단가
  const T = price[source] ?? 0;            // 업체 단가

  const D = auto.requests;
  const E = auto.imp_dsp1_2;
  const I = auto.imp_dsp3_passback;
  const J = auto.vendor_imp;
  const M = auto.rpm_dashboard;

  const O = inputs.dable_mfr ?? 0;

  // Basic
  const F = safeDiv(E, D);
  const G = Math.max(D - E, 0);
  const H = safeDiv(G, D);
  const K = G - J - I;
  const L = safeDiv(M, config.rpm_obi_ratio);

  // Dable block
  const AB = O;
  const AA = O === 0 ? 0 : safeDiv(S, AB);
  const Y = (E / 1000) * AA;
  const Z = Y * config.ad_revenue_rate;
  const X = Y * config.server_cost_rate;
  const W = Z * config.apc_rate;
  const V = (E / 1000) * S;
  const U = Y * config.fn_media_weight + Z * config.fn_ad_weight;
  const R = U - (V + W + X);

  // Passback (PB) block
  const AF = (G / 1000) * T;
  const AG = AF;
  const AE = AF * config.server_cost_rate * config.pb_server_discount;
  const AD = (G / 1000) * S;
  const AC = AF * config.fn_media_weight + AG * config.fn_ad_weight;
  const Smargin = AC - (AD + AE);

  const Q = R + Smargin;
  const Tmargin = safeDiv(Q, D) * 1000;

  return {
    date: inputs.date,
    fc_amount: inputs.fc_amount,
    total_mfr: inputs.total_mfr,
    dable_mfr: inputs.dable_mfr,
    vendor_mfr: inputs.vendor_mfr,

    requests: D,
    dable_response: E,
    response_rate: F,
    passback_requests: G,
    passback_rate: H,
    dable_passback_imp: I,
    vendor_imp: J,
    rpm_dashboard: M,

    lost_imp: K,
    rpm_obi: L,
    contribution_margin: Q,
    dable_margin: R,
    vendor_margin: Smargin,
    total_rpm_margin: Tmargin,
    dable_fn_revenue: U,
    dable_media_cost: V,
    dable_apc: W,
    dable_server_cost: X,
    dable_media_revenue: Y,
    dable_ad_revenue: Z,
    dable_cpm: AA,
    dable_mfr_ref: AB,
    pb_fn_revenue: AC,
    pb_media_cost: AD,
    pb_server_cost: AE,
    pb_media_revenue: AF,
    pb_ad_revenue: AG,
  };
}

/**
 * Derives all FC rows for a date range. Manual inputs may be missing for
 * dates that have auto data but no inputs yet — those rows are still produced
 * with null manual fields and MFR treated as 0.
 */
export function deriveFcRows(
  autoInputs: ExternalFcAutoInputs[],
  inputs: ExternalFcInputs[],
  prices: ExternalValueRow[],
  config: ExternalFcConfig,
  source: ExternalSource,
  widgetId: string,
): ExternalFcRow[] {
  const inputsByDate = new Map(inputs.map((i) => [i.date, i]));
  const pricesSorted = [...prices].sort((a, b) =>
    a.start_date.localeCompare(b.start_date),
  );

  return autoInputs
    .map((auto) => {
      const manual: ExternalFcInputs =
        inputsByDate.get(auto.date) ?? {
          widget_id: widgetId,
          date: auto.date,
          fc_amount: null,
          total_mfr: null,
          dable_mfr: null,
          vendor_mfr: null,
        };
      return deriveFcRow(manual, auto, pricesSorted, config, source);
    })
    .sort((a, b) => b.date.localeCompare(a.date)); // DESC by date
}
