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
  internal?: number;      // 데이블 ↔ 매체사 CPM (S)
  syncmedia?: number;     // 데이블 ↔ syncmedia CPM (vendor_id=2)
  klmedia?: number;       // 데이블 ↔ klmedia CPM (vendor_id=4)
  friendplus?: number;    // 데이블 ↔ friendplus CPM (vendor_id=5, 신규)
  fc?: number;            // Widget FC / Floor CPM (신규, KRW 정수)
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
