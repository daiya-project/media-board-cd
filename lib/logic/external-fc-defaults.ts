/**
 * Default per-widget FC report constants, used when no row exists in
 * media.external_fc_config for a widget.
 */
import type { ExternalFcConfig } from "@/types/external";

export const DEFAULT_FC_CONFIG: Omit<ExternalFcConfig, "widget_id" | "note"> = {
  rpm_obi_ratio: 0.34,
  server_cost_rate: 0.047,
  apc_rate: 0.017,
  fn_media_weight: 0.75,
  fn_ad_weight: 0.25,
  ad_revenue_rate: 0.95,
  pb_server_discount: 0.1,
};
