/**
 * FC (lineDSP passback) 리포트 전용 타입.
 *
 * `ExternalFcInputs` 수동 입력은 설계 변경으로 제거됐다.
 * 모든 원천 값은 DW auto-input 또는 `UnitPriceValue` (external_value JSONB) 에서 온다.
 */

import type {
  ExternalSource,
  ExternalValueRow,
} from "@/types/external";

/** Widget 단위 FC 상수 (전역 기본값만 사용, DB 테이블 없음). */
export interface ExternalFcConstants {
  rpm_obi_ratio: number;
  server_cost_rate: number;
  apc_rate: number;
  fn_media_weight: number;
  fn_ad_weight: number;
  ad_revenue_rate: number;
  pb_server_discount: number;
}

/** Passback vendor slug — `UnitPriceValue` 의 키와 1:1. */
export type PassbackVendorSlug = "syncmedia" | "klmedia" | "friendplus";

/** DW 에서 fetch 해온 날짜별 원천 지표 — deriveFcRow 의 입력. */
export interface ExternalFcAutoInputs {
  date: string;                 // YYYY-MM-DD
  requests: number;             // D (1.10 impressions)
  passback_imp: number;         // G (DAILY_PASSBACK_STATS.impressions, vendor 2/4/5 합)
  vendor_imp: number;           // J (external_daily.imp)
  dable_media_cost: number;     // a (1.1 media_fee_dsp1)
  dable_revenue: number;        // b (1.10 dsp1+dsp2)
  pb_media_cost: number;        // c (1.1 media_fee_dsp3)
  pb_revenue: number;           // d (DAILY_PASSBACK_STATS.org_cost_spent_krw)
  rpm_dashboard: number;        // M
  vendor_source: PassbackVendorSlug | null;  // 주요 vendor (imp 최대)
}

/** 엑셀 33컬럼 재현. 각 필드는 deriveFcRow() 의 결과. */
export interface ExternalFcRow {
  // 식별
  date: string;
  widget_id: string;

  // 입력
  fc_amount: number | null;           // B (UnitPriceValue.fc, for date)
  requests: number;                   // D
  dable_response: number;             // E (= D - G)
  passback_requests: number;          // G
  dable_passback_imp: number;         // I (현재 항상 0)
  vendor_imp: number;                 // J
  rpm_dashboard: number;              // M

  // 계산: 비율
  response_rate: number;              // F
  passback_rate: number;              // H
  lost_imp: number;                   // K
  rpm_obi: number;                    // L

  // MFR 3종 (DW 기반 자동)
  total_mfr: number;                  // N
  dable_mfr: number;                  // O
  vendor_mfr: number;                 // P

  // 데이블 블록
  dable_fn_revenue: number;           // U
  dable_media_cost: number;           // V
  dable_apc: number;                  // W
  dable_server_cost: number;          // X
  dable_media_revenue: number;        // Y
  dable_ad_revenue: number;           // Z
  dable_cpm: number;                  // AA
  dable_mfr_ref: number;              // AB (= O)
  dable_margin: number;               // R

  // 패스백 블록
  pb_fn_revenue: number;              // AC
  pb_media_cost: number;              // AD
  pb_server_cost: number;             // AE
  pb_media_revenue: number;           // AF
  pb_ad_revenue: number;              // AG
  vendor_margin: number;              // S_margin

  // 종합
  contribution_margin: number;        // Q
  total_rpm_margin: number;           // T_margin
}

/** `/external/fc` 페이지 서버→클라이언트 payload. */
export interface ExternalFcPagePayload {
  widgetId: string | null;
  widgets: Array<{
    widget_id: string;
    label: string;
    source: ExternalSource | null;    // external_mapping.source (참고용)
    service_name?: string;
    widget_name?: string;
  }>;
  autoInputs: ExternalFcAutoInputs[]; // 선택된 widget 의 기간 내 일자별
  unitPrices: ExternalValueRow[];     // 선택된 widget 의 전체 이력
  constants: ExternalFcConstants;     // DEFAULT_FC_CONSTANTS
  latestDate: string;                 // YYYY-MM-DD
  monthStart: string;                 // YYYY-MM-DD
  monthEnd: string;                   // YYYY-MM-DD
}
