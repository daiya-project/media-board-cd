/**
 * App-level type definitions for the media schema.
 *
 * Manually maintained until `npm run update-types` is run with `--schema media`.
 * These types mirror the SQL schema in supabase/migrations/*.sql.
 */

// ---------------------------------------------------------------------------
// media.client
// ---------------------------------------------------------------------------

export interface MediaClient {
  client_id: string;
  client_name: string;
  tier: "상" | "중" | "하" | "기타" | null;
  manager_id: number | null;
  manager_id_second: number | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** Lightweight client metadata for client-side tier/owner filtering. */
export interface ClientMeta {
  client_id: string;
  tier: string | null;
  manager_id: number | null;
}

// ---------------------------------------------------------------------------
// media.action
// ---------------------------------------------------------------------------

export type ActionStage = "contact" | "meeting" | "propose" | "done" | "memo";

/**
 * BlockNote rich-text content stored as JSONB in memo column.
 * Each element represents a BlockNote block (paragraph, heading, list, etc.).
 */
export type BlockNoteContent = Record<string, unknown>[];

export interface MediaAction {
  action_id: number;
  client_id: string;
  service_id: string | null;
  widget_id: string | null;
  action_date: string; // YYYY-MM-DD
  stage: ActionStage | null;
  memo: BlockNoteContent | null; // BlockNote JSONB block array
  has_followup: boolean;
  is_deleted: boolean; // Soft-delete flag
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// media.ref_manager (view over shared.manager)
// ---------------------------------------------------------------------------

export interface MediaManager {
  id: number;
  name: string;
  team: string | null;
  display_order: number | null;
}

// ---------------------------------------------------------------------------
// MGMT section — aggregated table row
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// DATA section — Raw daily data row (from media.v_daily view)
// ---------------------------------------------------------------------------

/** Raw row returned from the media.v_daily view. */
export interface DailyRawRow {
  date: string; // YYYY-MM-DD
  /** Always string in the app layer. DB column type is TEXT. */
  client_id: string;
  client_name: string;
  /** Always string in the app layer. DB column type is TEXT. */
  service_id: string;
  service_name: string;
  widget_id: string | null;
  widget_name: string | null;
  /** Advertiser spend (cost_spent in daily). DB type: BIGINT (int8, no decimals). */
  cost_spent: number;
  /** Publisher revenue (pub_profit aliased as ad_revenue in v_daily). DB type: BIGINT (int8). */
  ad_revenue: number;
  imp: number;
  vimp: number;
  cnt_click: number;
}

/** Raw row returned from the media.v_weekly materialized view. */
export interface WeeklyRawRow {
  year: number;
  week_number: number;
  date_start: string; // YYYY-MM-DD (Monday)
  date_end: string; // YYYY-MM-DD (Sunday)
  display_label: string; // e.g. "2025.01.06 주차"
  client_id: string;
  client_name: string;
  service_id: string;
  service_name: string;
  widget_id: string | null;
  widget_name: string | null;
  cost_spent: number;
  ad_revenue: number;
  imp: number;
  vimp: number;
  cnt_click: number;
}

/** Raw row returned from the media.v_monthly materialized view. */
export interface MonthlyRawRow {
  year_month: string; // YYYY-MM
  client_id: string;
  client_name: string;
  service_id: string;
  service_name: string;
  widget_id: string | null;
  widget_name: string | null;
  cost_spent: number;
  ad_revenue: number;
  imp: number;
  vimp: number;
  cnt_click: number;
}

/** Server → client payload for the DATA Weekly page. */
export interface WeeklyPayload {
  /** All available weeks from v_weekly, newest first. */
  allWeeks: { year: number; weekNumber: number; label: string }[];
  /** Raw weekly rows for initial display. */
  rawData: WeeklyRawRow[];
  /** Holiday + weekend dates (YYYY-MM-DD[]). */
  holidays: string[];
  /** Client tier/manager_id lookup for client-side filtering. */
  clientMeta: ClientMeta[];
}

/** Server → client payload for the DATA Monthly page. */
export interface MonthlyPayload {
  /** All available months from v_monthly, newest first (YYYY-MM[]). */
  allMonths: string[];
  /** Raw monthly rows for initial display. */
  rawData: MonthlyRawRow[];
  /** Client tier/manager_id lookup for client-side filtering. */
  clientMeta: ClientMeta[];
}

/** Grouping granularity for the DATA table. */
export type DataFilterType = "client" | "service" | "widget";

/** 7 metric types available in the DATA table. */
export type DataMetricType =
  | "adrevenue"
  | "pubprofit"
  | "mfr"
  | "imp"
  | "vimp"
  | "vrate"
  | "vctr";

/**
 * Raw numeric components per date slot.
 * Preserved for ratio-type recalculation after grouping (mfr, vrate, vctr).
 */
export interface RawDateComponents {
  cost_spent: number;
  ad_revenue: number;
  imp: number;
  vimp: number;
  cnt_click: number;
}

/** A single row after grouping raw data by C/S/W granularity. */
export interface DataBoardGroupedRow {
  client_id: string;
  client_name: string;
  service_id: string;
  service_name: string;
  widget_id: string | null;
  widget_name: string | null;
  /** Per-date computed metric value. Key = YYYY-MM-DD. */
  dateValues: Map<string, number>;
  /** Per-date aggregated raw components for ratio recalculation. Key = YYYY-MM-DD. */
  rawDates: Map<string, RawDateComponents>;
}

/**
 * Serializable server → client payload for the DATA section.
 * Maps are not serializable, so raw arrays are sent and Maps are built client-side.
 *
 * Phase 1 (quick): service-level data for initial 14 days.
 * Phase 2 (full):  widget-level data for all 90 days, replaces Phase 1.
 * filterType is managed client-side — server always returns the same views.
 */
export interface DataBoardPayload {
  /** Last 90 distinct dates, newest first (YYYY-MM-DD[]). */
  allDates: string[];
  /** Raw daily rows (Phase 1: service-level 14 days). */
  rawData: DailyRawRow[];
  /** Holiday + weekend dates (YYYY-MM-DD[]). Set<string> built client-side. */
  holidays: string[];
  /** Client tier/manager_id lookup for client-side filtering. */
  clientMeta: ClientMeta[];
}

// ---------------------------------------------------------------------------
// CVR section
// ---------------------------------------------------------------------------

/** Raw row returned from media.cvr table. */
export interface CvrRawRow {
  date: string;               // YYYY-MM-DD (= YYYY-MM-01 for monthly aggregate)
  client_id: string;
  service_id: string;
  service_name: string | null;
  service_type: string | null;
  level: string | null;       // A~F, computed at import time
  revenue: number | null;
  vimp: number | null;
  rpm: number | null;
  vctr_pct: number | null;
  cpc: number | null;
  click: number | null;
  campaign_count: number | null;
  normalized_cvr_pct: number | null;
  invalid_revenue_ratio_pct: number | null;
  contribution_margin_rate_pct: number | null;
}

/** Sortable field identifiers for the CVR table. */
export type CvrSortField =
  | "client"
  | "service"
  | "vimp"
  | "level"
  | "prevLevel"
  | "cmr"
  | "cvr"
  | "serviceType"
  | "revenue"
  | "rpm"
  | "vctr"
  | "cpc"
  | "invalidRate"
  | "campaign";

/**
 * Phase 1 payload — monthly view data only.
 * Fetched server-side on initial page load (fast, no yearly history).
 */
export interface CvrMonthlyPayload {
  /** Selected month (YYYY-MM). */
  selectedMonth: string;
  /** All months with data, descending (YYYY-MM[]). */
  availableMonths: string[];
  /** All rows for the selected month. */
  rows: CvrRawRow[];
  /** {service_id: level} for the previous month (for prevLevel column). */
  prevLevels: Record<string, string | null>;
  /** Client tier/manager_id lookup for client-side filtering. */
  clientMeta: ClientMeta[];
}

/**
 * Phase 2 payload — 13-month level history for yearly view.
 * Lazy-loaded client-side when the user switches to yearly view.
 */
export type CvrYearlyLevels = Array<{ month: string; levels: Record<string, string | null> }>;

/**
 * Full CVR payload (union of Phase 1 + Phase 2).
 * @deprecated Use CvrMonthlyPayload + CvrYearlyLevels separately for phased loading.
 */
export interface CvrPayload {
  /** Selected month (YYYY-MM). */
  selectedMonth: string;
  /** All months with data, descending (YYYY-MM[]). */
  availableMonths: string[];
  /** All rows for the selected month. */
  rows: CvrRawRow[];
  /** {service_id: level} for the previous month (for prevLevel column). */
  prevLevels: Record<string, string | null>;
  /**
   * Past 13 months of level data for yearly view.
   * Ordered by month ascending (oldest first).
   */
  pastMonthLevels: Array<{ month: string; levels: Record<string, string | null> }>;
  /** Client tier/manager_id lookup for client-side filtering. */
  clientMeta: ClientMeta[];
}

// ---------------------------------------------------------------------------
// Import feature — CSV parsing, progress tracking, results
// ---------------------------------------------------------------------------

/**
 * Parsed row from the Google Sheets CSV export.
 *
 * ID fields (client_id, service_id) are ALWAYS string — even though the
 * underlying DB columns are INTEGER. This matches the project-wide rule:
 * all IDs are treated as string throughout the app layer.
 * Supabase accepts string values for integer columns without issue.
 */
export interface ParsedCSVRow {
  date: string | null;
  /** CSV column: client_id or media_id. Always string per project ID rule. */
  client_id: string | null;
  /** CSV column: service_id. Always string per project ID rule. */
  service_id: string | null;
  /** CSV column: service_name. Used for auto-registration of missing services. */
  service_name: string | null;
  widget_id: string | null;
  widget_name: string | null;
  cost_spent: number;
  pub_profit: number;
  imp: number;
  vimp: number;
  /** Renamed from reference 'click' → matches media.daily.cnt_click. */
  cnt_click: number;
  /** Renamed from reference 'service_cv' → matches media.daily.cnt_cv. */
  cnt_cv: number;
}

/** Real-time progress state reported during CSV import. */
export interface ImportProgress {
  total: number;
  processed: number;
  success: number;
  failed: number;
  skipped: number;
  servicesCreated: number;
  widgetsCreated: number;
  currentDate: string | null;
}

/** Final result returned after importCSVData() completes. */
export interface ImportResult {
  success: boolean;
  totalRows: number;
  imported: number;
  failed: number;
  skipped: number;
  servicesCreated: number;
  widgetsCreated: number;
  /** Earliest date in the imported data range (YYYY-MM-DD). */
  dateStart: string | null;
  /** Latest date in the imported data range (YYYY-MM-DD). */
  dateEnd: string | null;
  /** True if the import was cancelled by the user. */
  cancelled?: boolean;
  errors: Array<{ row: number; message: string }>;
  /** Newly registered services during this import. */
  newServiceLogs: Array<{
    date: string | null;
    client_id: string;
    client_name: string | null;
    service_id: string;
    service_name: string | null;
  }>;
  /** Newly registered widgets during this import. */
  newWidgetLogs: Array<{
    date: string | null;
    client_id: string;
    client_name: string | null;
    service_id: string;
    service_name: string | null;
    widget_id: string;
    widget_name: string | null;
  }>;
  /** Detail information for failed rows (validation failures and upsert errors). */
  failedDetails: Array<{
    date: string | null;
    client_id: string | null;
    client_name: string | null;
    service_id: string | null;
    service_name: string | null;
    widget_id: string | null;
    widget_name: string | null;
    reason: string;
  }>;
}

/** Options accepted by importCSVData() orchestrator. */
export interface ImportCSVDataOptions {
  csvText: string;
  onProgress?: (progress: ImportProgress) => void;
  /** Return true to request cancellation. */
  onCancel?: () => boolean;
  batchSize?: number;
  forceDateRange?: { startDate: string; endDate: string } | null;
  lastDateHint?: string | null;
}

// ---------------------------------------------------------------------------
// Board (Dashboard) section
// ---------------------------------------------------------------------------

/** Single row from the media.ref_week view (reflects shared.week). */
export interface RefWeekRow {
  id: number;
  year: number;
  week_number: number;
  /** Week start date (YYYY-MM-DD, inclusive). */
  date_start: string;
  /** Week end date (YYYY-MM-DD, inclusive). */
  date_end: string;
  /** Pre-formatted display label, e.g. "2/1~2/7". */
  display_label: string;
}

/** Row from media.v_daily_total — global daily totals (one row per date). */
export interface DailyTotalRow {
  date: string;
  cost_spent: number;
  ad_revenue: number;
  imp: number;
  vimp: number;
  cnt_click: number;
}

/** Row from media.v_daily_by_service — service-level daily aggregation. */
export interface DailyServiceRow {
  date: string;
  client_id: string;
  client_name: string;
  service_id: string;
  service_name: string;
  cost_spent: number;
  ad_revenue: number;
  imp: number;
  vimp: number;
  cnt_click: number;
}

/**
 * Serializable server → client payload for the Board section.
 * Uses pre-aggregated views instead of raw widget-level rows.
 */
export interface BoardPayload {
  /** Last 90 distinct dates, newest first (YYYY-MM-DD[]). */
  allDates: string[];
  /** Global daily totals from v_daily_total (90 rows). */
  totalData: DailyTotalRow[];
  /** Service-level daily data from v_daily_by_service (~18k rows). */
  serviceData: DailyServiceRow[];
  /** ref_week entries covering the allDates range, newest-first. */
  weeks: RefWeekRow[];
}

/**
 * Fast subset of BoardPayload — contains everything except serviceData.
 * Resolved in ~300ms; used for streaming so KPI cards render immediately
 * while serviceData loads separately.
 */
export interface BoardQuickPayload {
  /** Last 90 distinct dates, newest first (YYYY-MM-DD[]). */
  allDates: string[];
  /** Global daily totals from v_daily_total (90 rows). */
  totalData: DailyTotalRow[];
  /** ref_week entries covering the allDates range, newest-first. */
  weeks: RefWeekRow[];
  /**
   * Resolved client_id list when global filters (search/tier/owner) are active;
   * null when no filters are applied.
   * Passed to getBoardServiceData() to fetch filtered service data.
   */
  clientIds: string[] | null;
}

/** Summary metric for a single KPI card. */
export interface BoardSummaryMetric {
  latestValue: number;
  previousValue: number;
  /** Percent change (ratio metrics) or percentage point difference (MFR). */
  changeRate: number;
}

/** All three KPI card metrics. */
export interface BoardSummary {
  adRevenue: BoardSummaryMetric;
  vimp: BoardSummaryMetric;
  mfr: BoardSummaryMetric;
}

/** Aggregated daily data point for chart rendering. */
export interface BoardChartPoint {
  date: string;
  costSpent: number;
  adRevenue: number;
  vimp: number;
  /** MFR = (adRevenue / costSpent) * 100 */
  mfr: number;
}

/** Single service entry in the trend list (Up or Down). */
export interface BoardTrendItem {
  service_id: string;
  service_name: string;
  client_id: string;
  client_name: string;
  latestValue: number;
  previousValue: number;
  /** Percent change rate. */
  changeRate: number;
}

// ---------------------------------------------------------------------------
// MGMT section — aggregated table row
// ---------------------------------------------------------------------------

/**
 * Aggregated row type used in the MGMT management table.
 * Built from media.client + media.action + media.ref_manager.
 */
export interface MgmtTableRow {
  client_id: string;
  client_name: string;
  tier: "상" | "중" | "하" | "기타" | null;
  manager_id: number | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  /** Most recent action_date for this client (YYYY-MM-DD), or null if no actions */
  lastDate: string | null;
  /** Total number of actions recorded for this client */
  actionCount: number;
  /** Number of actions with has_followup = true */
  followupCount: number;
  /** Stage from the most recent action, or null */
  currentStage: ActionStage | null;
  /** BlockNote memo content from the most recent action, or null */
  lastMemo: BlockNoteContent | null;
  /** Display name of the primary account manager */
  managerName: string | null;
  /** Contact cycle status based on tier rules */
  contactStatus: ContactStatus | null;
  /** Days remaining until contact is due (negative = overdue) */
  daysRemaining: number | null;
}

// ---------------------------------------------------------------------------
// Client Detail (for ClientOverviewSheet) — services + widgets + contracts
// ---------------------------------------------------------------------------

/**
 * Single contract record from media.widget_contract.
 */
export interface WidgetContractRow {
  id: number; // SERIAL PK
  widget_id: string;
  contract_type: string | null;
  contract_value: number | null;
  date_start: string | null; // YYYY-MM-DD
  date_end: string | null; // YYYY-MM-DD
}

/**
 * Widget with contract information for the client overview sheet.
 * Combines widget master data with contract terms and active status.
 */
export interface WidgetWithContract {
  widget_id: string;
  widget_name: string | null;
  // Current/active contract (for primary display row)
  contract_type: string | null; // RS, CPM, MCPM, CPC, HYBRID, etc.
  contract_value: number | null; // Percentage (RS) or KRW amount (CPM/CPC)
  start_date: string | null; // YYYY-MM-DD
  end_date: string | null; // YYYY-MM-DD
  is_active: boolean; // True if widget has data in last 30 days
  // Full contract history (for expand view)
  contracts: WidgetContractRow[];
}

/**
 * Service with grouped widgets for the client overview sheet.
 */
export interface ServiceWithWidgets {
  service_id: string;
  service_name: string;
  widgets: WidgetWithContract[];
  activeWidgetCount: number;
}

/**
 * Full client detail with services, widgets, and contracts.
 * Used by ClientOverviewSheet modal.
 */
export interface ClientDetailFull {
  client_id: string;
  client_name: string;
  tier: "상" | "중" | "하" | "기타" | null;
  manager_id: number | null;
  manager_name: string | null; // Display name of primary manager
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  services: ServiceWithWidgets[];
  totalServices: number;
  totalWidgets: number;
  activeWidgets: number;
}

// ---------------------------------------------------------------------------
// Goal section — monthly vIMP goals
// ---------------------------------------------------------------------------

/** Row from media.goal table. */
export interface GoalRow {
  id: number;
  manager_id: number | null;
  goal_type: string;
  date_start: string;
  date_end: string;
  vimp_target: number;
  memo?: string | null;
}

/** KPI card data for the Goal Monthly page. */
export interface MonthlyKpiCard {
  monthKey: string; // "YYYY-MM"
  monthLabel: string; // "3월"
  vimp: number; // actual vIMP
  vimpChange: number | null; // change vs previous month
  vimpChangeRate: number | null; // change rate (%)
  totalClients: number;
  activeClients: number;
  isProjected: boolean; // true for projected card
}

// ---------------------------------------------------------------------------
// Contact cycle management
// ---------------------------------------------------------------------------

/** Row from media.contact_rule table. */
export interface ContactRule {
  id: number;
  tier: string;
  rule_day: number;
  required_stages: string[];
  is_active: boolean;
}

/** Contact status classification. */
export type ContactStatus = "overdue" | "urgent" | "upcoming" | "ok" | "excluded";

/** Computed contact status row for a client. */
export interface ContactStatusRow {
  client_id: string;
  client_name: string;
  tier: "상" | "중" | "하" | "기타" | null;
  manager_id: number | null;
  manager_name: string | null;
  rule_day: number;
  last_action_date: string | null;
  last_stage: string | null;
  days_elapsed: number | null;
  days_remaining: number | null;
  contact_status: ContactStatus;
}

// ---------------------------------------------------------------------------
// Pipeline section — recent activity feed
// ---------------------------------------------------------------------------

/** Recent activity entry for the Pipeline page activity feed. */
export interface RecentActivity {
  action_id: number;
  client_id: string;
  client_name: string;
  service_id: string | null;
  widget_id: string | null;
  action_date: string; // YYYY-MM-DD
  stage: ActionStage | null;
  memo: BlockNoteContent | null;
  has_followup: boolean;
  created_at: string;
}

/** Client monthly vIMP row for the 13-month table. */
export interface ClientMonthlyVimpRow {
  client_id: string;
  client_name: string;
  projectedVimp: number | null; // projected vimp for current month
  months: number[]; // 13 months of vimp (newest → oldest)
}
