/**
 * FC 리포트 계산용 기본 상수.
 * 엑셀 원본 시트의 하드코딩 값과 동일.
 */
import type { ExternalFcConstants } from "@/types/fc";

export const DEFAULT_FC_CONSTANTS: ExternalFcConstants = {
  rpm_obi_ratio: 0.34,
  server_cost_rate: 0.047,
  apc_rate: 0.017,
  fn_media_weight: 0.75,
  fn_ad_weight: 0.25,
  ad_revenue_rate: 0.95,
  pb_server_discount: 0.1,
};
