/**
 * Types for external ad network settlement data.
 *
 * Sources: KL Media (klmedia), SyncMedia (syncmedia)
 */

// ---------------------------------------------------------------------------
// API Response Types (raw from external APIs)
// ---------------------------------------------------------------------------

/** Raw row from KL Media report API. */
export interface KlMediaRawRow {
  log_date: string;
  media_name: string;
  page_name: string;
  option: string;
  query_cnt: number;
  click_cnt: number;
  ctr: number;
  cost: number;
}

/** KL Media API response wrapper. */
export interface KlMediaResponse {
  message: string;
  report: KlMediaRawRow[];
}

/** Raw row from SyncMedia (3DPOP) report API (all values are strings). */
export interface SyncMediaRawRow {
  company_uid: string;
  media_name: string;       // URL-encoded
  chk_date: string;
  sum_loadstart: string;    // number as string
  sum_click: string;        // number as string, often empty
  amount_sales: string;     // number as string
}

// ---------------------------------------------------------------------------
// DB Types
// ---------------------------------------------------------------------------

export type ExternalSource = "klmedia" | "syncmedia";

/** JSONB value shape for unit price CPM entries (KRW integer). */
export interface UnitPriceValue {
  internal?: number;
  syncmedia?: number;
  klmedia?: number;
}

/** Row from media.external_value table. */
export interface ExternalValueRow {
  id: number;
  widget_id: string;
  value: UnitPriceValue;
  start_date: string;           // YYYY-MM-DD
  end_date: string | null;      // YYYY-MM-DD or null (currently active)
  created_at: string;
}

/** Row from media.external_daily table. */
export interface ExternalDailyRow {
  id: number;
  source: ExternalSource;
  date: string;                          // YYYY-MM-DD
  external_service_name: string;
  external_widget_name: string;          // '' for SyncMedia (no widget-level detail)
  share_type: string | null;
  imp: number;
  click: number;
  revenue: number;
  fetched_at: string;
}

/** Row from media.external_mapping table. */
export interface ExternalMappingRow {
  id: number;
  source: ExternalSource;
  external_key: string;
  widget_id: string | null;
  label: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Combined View Types
// ---------------------------------------------------------------------------

/** A single metric group (internal, external, or total). */
export interface MetricGroup {
  imp: number;
  revenue: number;
  ctr: number;
}

/** Combined row for the report table. */
export interface ExternalCombinedRow {
  date: string;                          // YYYY-MM-DD
  label: string;                         // Display name (from mapping or external name)
  source: ExternalSource;
  widget_id: string | null;              // Internal widget_id (if mapped)
  internal: MetricGroup;
  external: MetricGroup;
  total: MetricGroup;
  unitPrice?: UnitPriceValue;            // Matched CPM from external_unit_price
}

// ---------------------------------------------------------------------------
// Payload Types
// ---------------------------------------------------------------------------

/** Phase 2 payload passed from Server Component to Client. */
export interface ExternalPagePayload {
  externalRows: ExternalDailyRow[];
  mappings: ExternalMappingRow[];
  unitPrices: ExternalValueRow[];
  internalRows: import("@/types/app-db.types").DailyRawRow[];
  latestDate: string;                    // YYYY-MM-DD (from media.v_dates)
}

// ---------------------------------------------------------------------------
// FC Report Types
// ---------------------------------------------------------------------------

/** Widget-level FC report constants. */
export interface ExternalFcConfig {
  widget_id: string;
  rpm_obi_ratio: number;
  server_cost_rate: number;
  apc_rate: number;
  fn_media_weight: number;
  fn_ad_weight: number;
  ad_revenue_rate: number;
  pb_server_discount: number;
  note: string | null;
}

/** Manual daily inputs (B, N, O, P). */
export interface ExternalFcInputs {
  widget_id: string;
  date: string;               // YYYY-MM-DD
  fc_amount: number | null;   // B
  total_mfr: number | null;   // N
  dable_mfr: number | null;   // O
  vendor_mfr: number | null;  // P
}

/** Auto-fetched daily data from DW + internal + external API. */
export interface ExternalFcAutoInputs {
  date: string;
  requests: number;            // D
  imp_dsp1_2: number;          // E (approx)
  imp_dsp3_passback: number;   // I
  vendor_imp: number;          // J (from external_daily)
  rpm_dashboard: number;       // M (from v_daily)
}

/** Fully derived FC row (all 32 columns). */
export interface ExternalFcRow {
  // Manual inputs
  date: string;                     // C
  fc_amount: number | null;         // B
  total_mfr: number | null;         // N
  dable_mfr: number | null;         // O
  vendor_mfr: number | null;        // P

  // Auto inputs
  requests: number;                 // D
  dable_response: number;           // E (= imp_dsp1_2)
  response_rate: number;            // F (= E/D)
  passback_requests: number;        // G (= D - E)
  passback_rate: number;            // H (= G/D)
  dable_passback_imp: number;       // I
  vendor_imp: number;               // J
  rpm_dashboard: number;            // M

  // Computed
  lost_imp: number;                 // K
  rpm_obi: number;                  // L
  contribution_margin: number;      // Q
  dable_margin: number;             // R
  vendor_margin: number;            // S
  total_rpm_margin: number;         // T
  dable_fn_revenue: number;         // U
  dable_media_cost: number;         // V
  dable_apc: number;                // W
  dable_server_cost: number;        // X
  dable_media_revenue: number;      // Y
  dable_ad_revenue: number;         // Z
  dable_cpm: number;                // AA
  dable_mfr_ref: number;            // AB (= O)
  pb_fn_revenue: number;            // AC
  pb_media_cost: number;            // AD
  pb_server_cost: number;           // AE
  pb_media_revenue: number;         // AF
  pb_ad_revenue: number;            // AG
}

/** Page payload from server → client. */
export interface ExternalFcPagePayload {
  widgetId: string | null;
  widgets: Array<{ widget_id: string; label: string; source: ExternalSource }>;
  config: ExternalFcConfig;
  inputs: ExternalFcInputs[];
  autoInputs: ExternalFcAutoInputs[];
  unitPrices: ExternalValueRow[];
  latestDate: string;
  monthStart: string;
  monthEnd: string;
}
