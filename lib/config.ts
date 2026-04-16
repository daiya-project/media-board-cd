/**
 * Global application constants.
 */

/** External link: Google Sheets DB (daily data tab) */
export const DB_LINK =
  "https://docs.google.com/spreadsheets/d/1DstWpM2Jy_r7eAErV176YsMKQTslTPLfLF7jbL0WENI/edit?gid=0#gid=0";

/** External link: Google Sheets DB (CVR tab) */
export const CVR_DB_LINK =
  "https://docs.google.com/spreadsheets/d/1DstWpM2Jy_r7eAErV176YsMKQTslTPLfLF7jbL0WENI/edit?gid=2116998053#gid=2116998053";

/** External link: Redash (daily data) */
export const REDASH_LINK =
  "https://redash.dable.io/queries/11939/source?p_client_id=5%2C10%2C14%2C15%2C17%2C18%2C26%2C30%2C31%2C33%2C34%2C35%2C37%2C39%2C40%2C55%2C56%2C57%2C72%2C74%2C85%2C116%2C119%2C120%2C122%2C123%2C138%2C139%2C147%2C149%2C155%2C168%2C182%2C197%2C244%2C301%2C306%2C313%2C320%2C343%2C356%2C368%2C395%2C424%2C492%2C532%2C536%2C598%2C637%2C663%2C664%2C692%2C693%2C718%2C722%2C759%2C779%2C797%2C804%2C946%2C984%2C1019%2C1020%2C1269%2C1300%2C1308%2C1403%2C1530%2C1561%2C1590%2C1615%2C1678%2C1687%2C1690%2C1717%2C1740%2C1753%2C1755%2C1825%2C1895%2C2045%2C2121%2C2146%2C2149%2C2253%2C2270%2C2273%2C2306%2C2351%2C2457%2C2512%2C2542%2C2562%2C2610%2C2805%2C3099%2C3138%2C3175%2C3184%2C3339%2C3401%2C3524%2C3629%2C3814%2C3944%2C3976%2C3988%2C4099%2C4100%2C4108%2C4177%2C4250%2C4311%2C4315%2C4354%2C4858%2C4859%2C4901%2C4907%2C4912%2C5016%2C5036%2C5055%2C5060%2C5063%2C5067%2C5068%2C5075%2C5103%2C5160&p_date=2026-01-22--2026-01-22";

/** Supabase batch size limit */
export const BATCH_SIZE = 1000;

/** Supabase SELECT page size for .range() pagination (max 1000) */
export const SUPABASE_PAGE_SIZE = 1000;

/** SWR cache TTL (ms): 3 minutes */
export const CACHE_TTL = 3 * 60 * 1000;

/** Minimum cost thresholds for small-slot filtering (DATA section) */
export const SMALL_SLOT_THRESHOLD = {
  client: 100_000,
  service: 30_000,
  widget: 10_000,
} as const;

/** Minimum cost_spent thresholds for trend list qualification (Dashboard section) */
export const TREND_MIN_COST = {
  adRevenue: 100_000,
  vimp: 30_000,
  mfr: 30_000,
} as const;

/**
 * Google Sheets CSV export URL for daily data import.
 * Uses NEXT_PUBLIC_ prefix because it is referenced from a Client Component.
 * Override via NEXT_PUBLIC_IMPORT_CSV_URL environment variable.
 */
export const IMPORT_CSV_URL =
  process.env.NEXT_PUBLIC_IMPORT_CSV_URL ?? "";

/**
 * Google Sheets CSV export URL for CVR data import.
 * Uses NEXT_PUBLIC_ prefix because it is referenced from a Client Component.
 * Override via NEXT_PUBLIC_IMPORT_CVR_CSV_URL environment variable.
 */
export const IMPORT_CVR_CSV_URL =
  process.env.NEXT_PUBLIC_IMPORT_CVR_CSV_URL ?? "";

/** Default chart range per period type (Dashboard + DATA sections) */
export const CHART_RANGE_DEFAULTS = {
  daily: 14,
  weekly: 8,
  monthly: 3,
} as const;

/** Batch size for widget auto-registration inserts. */
export const WIDGET_BATCH_SIZE = 100;

/** Rate-limiting delay between import batches (ms). */
export const IMPORT_BATCH_DELAY_MS = 10;

/**
 * Dynamic batch size thresholds for CSV import.
 * Larger datasets use smaller batches to avoid Supabase timeouts.
 */
export const IMPORT_BATCH_THRESHOLDS = {
  /** Rows >= this → batch size 200 */
  LARGE: 100_000,
  /** Rows >= this → batch size 500 */
  MEDIUM: 10_000,
  /** Default batch size for smaller imports */
  DEFAULT_SIZE: 1_000,
  LARGE_SIZE: 200,
  MEDIUM_SIZE: 500,
} as const;

/** External link: Redash (CVR) */
export const CVR_REDASH_LINK = "https://redash.dable.io/queries/12770";
