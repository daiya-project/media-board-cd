/**
 * External settlement data service.
 *
 * Fetches from KL Media and SyncMedia APIs, stores to media.external_daily.
 * Reads external_daily + external_mapping for report page.
 *
 * Pure data-fetching only — no business logic.
 */

import { createMediaClient } from "@/lib/supabase/media-server";
import { paginateQuery } from "@/lib/api/paginateQuery";
import { getLatestDataDate } from "@/lib/api/dateService";
import { mapBaseMetrics, mapClientService, mapWidget } from "@/lib/api/rowMappers";
import { toYearMonth } from "@/lib/utils/date-utils";
import { BATCH_SIZE } from "@/lib/config";
import type {
  KlMediaResponse,
  KlMediaRawRow,
  SyncMediaRawRow,
  ExternalDailyRow,
  ExternalMappingRow,
  ExternalValueRow,
  UnitPriceValue,
  ExternalSource,
  ExternalPagePayload,
} from "@/types/external";
import type { DailyRawRow } from "@/types/app-db.types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const KLMEDIA_BASE_URL = "https://admin.klmedia.co.kr/request/report";
const SYNCMEDIA_BASE_URL =
  "https://syncads.3dpop.kr/Web/Report_Partner/_API/report_json.php";

/** SyncMedia company_uid list — one entry per media partner. */
const SYNCMEDIA_UIDS = [
  "d6715fb70388c72311139ce149779d91abcfdecd",
  "b38bb23742613e15bed3109bfdfa6268246d9b65",
  "766ba62c79ff67ba4504b009768f100d192dc291",
  "1dc61701c687a039f9fcdf496c96da1ffa58628d",
  "62d963fbe110a20cbc4cb66347e562aa72f68f58",
  "7c1f7a1a381618ce1f9cb9f462eb7395f306d12f",
  "a439e0475c9372bf41f23a610242e6470870388f",
  "4086930a3dff30b2999a28e2d95cb273a3b8ea3f",
  "3951bb5af4a07989afa247cf9925c6bddc7d8fd3",
  "702da6f781d6592336a19a6ae06ddefeacdd3bea",
  "5d799eac0a228580c72afdadd04deb11ed751c8b",
  "e81cbf965227136cb3952153154ac20f6c2971bc",
];

// ---------------------------------------------------------------------------
// External API Fetchers
// ---------------------------------------------------------------------------

/**
 * Fetches KL Media report data for a date range.
 * @param startDate - YYYYMMDD format
 * @param endDate - YYYYMMDD format
 */
export async function fetchKlMediaData(
  startDate: string,
  endDate: string,
): Promise<KlMediaRawRow[]> {
  const key = process.env.KLMEDIA_API_KEY;
  if (!key) throw new Error("KLMEDIA_API_KEY is not set");

  const url = `${KLMEDIA_BASE_URL}?key=${key}&startDate=${startDate}&endDate=${endDate}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`KL Media API error: ${res.status}`);

  const json: KlMediaResponse = await res.json();
  if (json.message !== "success") {
    throw new Error(`KL Media API returned: ${json.message}`);
  }
  return json.report ?? [];
}

/**
 * Fetches SyncMedia report data for a year-month, across all company_uids.
 * @param year - YYYY
 * @param month - MM (zero-padded)
 */
export async function fetchSyncMediaData(
  year: string,
  month: string,
): Promise<SyncMediaRawRow[]> {
  // Fetch sequentially to avoid connection limits on external API
  const results: SyncMediaRawRow[] = [];
  for (const uid of SYNCMEDIA_UIDS) {
    try {
      const url = `${SYNCMEDIA_BASE_URL}?company_uid=${uid}&chk_year=${year}&chk_month=${month}`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        console.error(`SyncMedia fetch failed for uid=${uid}: ${res.status}`);
        continue;
      }
      const json = await res.json();
      // API returns error object instead of array when IP is blocked etc.
      if (!Array.isArray(json)) {
        console.error(`SyncMedia returned non-array for uid=${uid}:`, json);
        continue;
      }
      results.push(...(json as SyncMediaRawRow[]));
    } catch (err) {
      console.error(`SyncMedia fetch error for uid=${uid}:`, err);
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// Row Transformers (API → DB shape)
// ---------------------------------------------------------------------------

/** Converts a KL Media raw row into external_daily insert shape. */
function klMediaToInsert(row: KlMediaRawRow) {
  return {
    source: "klmedia" as const,
    date: row.log_date,
    external_service_name: row.media_name,
    external_widget_name: row.page_name,
    share_type: row.option || null,
    imp: row.query_cnt ?? 0,
    click: row.click_cnt ?? 0,
    revenue: row.cost ?? 0,
  };
}

/** Converts a SyncMedia raw row into external_daily insert shape. */
function syncMediaToInsert(row: SyncMediaRawRow) {
  return {
    source: "syncmedia" as const,
    date: row.chk_date,
    external_service_name: decodeURIComponent(row.media_name),
    external_widget_name: "",    // SyncMedia has no widget-level detail
    share_type: null,
    imp: parseInt(row.sum_loadstart, 10) || 0,
    click: parseInt(row.sum_click, 10) || 0,
    revenue: parseInt(row.amount_sales, 10) || 0,
  };
}

// ---------------------------------------------------------------------------
// DB Upsert
// ---------------------------------------------------------------------------

/**
 * Upserts external daily rows into media.external_daily.
 * Uses batch insert with conflict handling.
 */
export async function upsertExternalDaily(
  rows: Array<{
    source: ExternalSource;
    date: string;
    external_service_name: string;
    external_widget_name: string;
    share_type: string | null;
    imp: number;
    click: number;
    revenue: number;
  }>,
): Promise<number> {
  if (rows.length === 0) return 0;
  const supabase = await createMediaClient();

  let upserted = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from("external_daily")
      .upsert(batch, {
        onConflict:
          "source,date,external_service_name,external_widget_name",
        ignoreDuplicates: false,
      });
    if (error) throw error;
    upserted += batch.length;
  }
  return upserted;
}

// ---------------------------------------------------------------------------
// Sync Orchestrator
// ---------------------------------------------------------------------------

/**
 * Syncs external data for a given date range.
 * Fetches from both KL Media and SyncMedia, then upserts to DB.
 *
 * @param startDate - YYYY-MM-DD
 * @param endDate - YYYY-MM-DD
 * @returns Count of upserted rows per source
 */
export async function syncExternalData(
  startDate: string,
  endDate: string,
): Promise<{ klmedia: number; syncMedia: number }> {
  // Convert YYYY-MM-DD → YYYYMMDD for KL Media
  const klStart = startDate.replace(/-/g, "");
  const klEnd = endDate.replace(/-/g, "");

  // Extract year/month for SyncMedia (only supports month-level queries)
  const [year, month] = startDate.split("-");

  const [klRows, tdRows] = await Promise.all([
    fetchKlMediaData(klStart, klEnd).catch((err) => {
      console.error("[syncExternalData] KL Media fetch failed:", err);
      return [] as KlMediaRawRow[];
    }),
    fetchSyncMediaData(year, month),
  ]);

  const klInserts = klRows.map(klMediaToInsert);
  const tdInserts = tdRows.map(syncMediaToInsert);

  const [klCount, tdCount] = await Promise.all([
    upsertExternalDaily(klInserts),
    upsertExternalDaily(tdInserts),
  ]);

  // Auto-populate external_mapping for new keys
  await backfillMappings(klInserts, tdInserts);

  return { klmedia: klCount, syncMedia: tdCount };
}

// ---------------------------------------------------------------------------
// Auto-populate Mappings
// ---------------------------------------------------------------------------

/**
 * Extracts the mapping key from an insert row.
 * KL Media: external_widget_name (fallback to external_service_name)
 * SyncMedia: external_service_name
 */
function toExternalKey(row: { source: ExternalSource; external_service_name: string; external_widget_name: string }): string {
  if (row.source === "klmedia") {
    return row.external_widget_name || row.external_service_name;
  }
  return row.external_service_name;
}

/**
 * Inserts missing entries into media.external_mapping after sync.
 * Uses upsert with ignoreDuplicates so existing rows are untouched.
 */
async function backfillMappings(
  klInserts: ReturnType<typeof klMediaToInsert>[],
  tdInserts: ReturnType<typeof syncMediaToInsert>[],
): Promise<void> {
  // Deduplicate by source + external_key
  const seen = new Set<string>();
  const newMappings: Array<{
    source: ExternalSource;
    external_key: string;
    label: string;
  }> = [];

  for (const row of [...klInserts, ...tdInserts]) {
    const key = `${row.source}:${toExternalKey(row)}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const externalKey = toExternalKey(row);
    // Label: use service name for display, append widget name if different
    const label =
      row.source === "klmedia" && row.external_widget_name && row.external_widget_name !== row.external_service_name
        ? `${row.external_service_name} — ${row.external_widget_name}`
        : row.external_service_name;

    newMappings.push({ source: row.source, external_key: externalKey, label });
  }

  if (newMappings.length === 0) return;

  const supabase = await createMediaClient();
  for (let i = 0; i < newMappings.length; i += BATCH_SIZE) {
    const batch = newMappings.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from("external_mapping")
      .upsert(batch, {
        onConflict: "source,external_key",
        ignoreDuplicates: true,
      });
    if (error) throw error;
  }
}

// ---------------------------------------------------------------------------
// DB Reads
// ---------------------------------------------------------------------------

/** Maps a raw DB row to ExternalDailyRow. */
function mapExternalDailyRow(row: Record<string, unknown>): ExternalDailyRow {
  return {
    id: Number(row.id) || 0,
    source: (row.source as ExternalSource) ?? "klmedia",
    date: String(row.date ?? ""),
    external_service_name: String(row.external_service_name ?? ""),
    external_widget_name: String(row.external_widget_name ?? ""),
    share_type: row.share_type ? String(row.share_type) : null,
    imp: Number(row.imp) || 0,
    click: Number(row.click) || 0,
    revenue: Number(row.revenue) || 0,
    fetched_at: String(row.fetched_at ?? ""),
  };
}

/**
 * Reads external daily data for a date range.
 */
export async function getExternalDaily(
  startDate: string,
  endDate: string,
): Promise<ExternalDailyRow[]> {
  const supabase = await createMediaClient();
  return paginateQuery(
    (offset, bs) => {
      const q = supabase
        .from("external_daily")
        .select("*")
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date", { ascending: true })
        .range(offset, offset + bs - 1);
      return q as never;
    },
    mapExternalDailyRow,
  );
}

/**
 * Reads all external mappings.
 * Uses paginateQuery to handle 1000-row Supabase limit.
 */
export async function getExternalMappings(): Promise<ExternalMappingRow[]> {
  const supabase = await createMediaClient();
  return paginateQuery(
    (offset, bs) => {
      const q = supabase
        .from("external_mapping")
        .select("*")
        .order("source", { ascending: true })
        .range(offset, offset + bs - 1);
      return q as never;
    },
    (row: Record<string, unknown>): ExternalMappingRow => ({
      id: Number(row.id) || 0,
      source: (row.source as ExternalSource) ?? "klmedia",
      external_key: String(row.external_key ?? ""),
      widget_id: row.widget_id ? String(row.widget_id) : null,
      label: row.label ? String(row.label) : null,
      created_at: String(row.created_at ?? ""),
    }),
  );
}

// ---------------------------------------------------------------------------
// Internal Daily Reads (for mapped widgets)
// ---------------------------------------------------------------------------

/**
 * Fetches internal daily data from media.v_daily for the given widget_ids and date range.
 * Used to populate the "internal" section of the external report.
 */
export async function getInternalDailyForWidgets(
  widgetIds: string[],
  startDate: string,
  endDate: string,
): Promise<DailyRawRow[]> {
  if (widgetIds.length === 0) return [];
  const supabase = await createMediaClient();
  return paginateQuery(
    (offset, bs) => {
      const q = supabase
        .from("v_daily")
        .select("date, client_id, client_name, service_id, service_name, widget_id, widget_name, cost_spent, ad_revenue, imp, vimp, cnt_click")
        .in("widget_id", widgetIds)
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date", { ascending: true })
        .range(offset, offset + bs - 1);
      return q as never;
    },
    (row: Record<string, unknown>): DailyRawRow => ({
      date: String(row.date ?? ""),
      ...mapClientService(row),
      ...mapWidget(row),
      ...mapBaseMetrics(row),
    }),
  );
}

// ---------------------------------------------------------------------------
// Unit Price Reads
// ---------------------------------------------------------------------------

/** Maps a raw DB row to ExternalValueRow. */
function mapValueRow(row: Record<string, unknown>): ExternalValueRow {
  return {
    id: Number(row.id) || 0,
    widget_id: String(row.widget_id ?? ""),
    value: (row.value as UnitPriceValue) ?? {},
    start_date: String(row.start_date ?? ""),
    end_date: row.end_date ? String(row.end_date) : null,
    created_at: String(row.created_at ?? ""),
  };
}

/**
 * Upserts detected CPM periods into media.external_value.
 * Uses UNIQUE(widget_id, start_date) for conflict resolution.
 * The DB trigger auto-closes previous periods when a new row is inserted.
 *
 * @param rows - Value rows to upsert (sorted by widget_id, start_date)
 * @returns Number of upserted rows
 */
export async function upsertExternalValues(
  rows: Array<{
    widget_id: string;
    value: UnitPriceValue;
    start_date: string;
    end_date: string | null;
  }>,
): Promise<number> {
  if (rows.length === 0) return 0;
  const supabase = await createMediaClient();

  let upserted = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from("external_value")
      .upsert(batch, {
        onConflict: "widget_id,start_date",
        ignoreDuplicates: false,
      });
    if (error) throw error;
    upserted += batch.length;
  }
  return upserted;
}

/**
 * Reads all external unit prices.
 * Uses paginateQuery to handle 1000-row Supabase limit.
 */
export async function getExternalValues(): Promise<ExternalValueRow[]> {
  const supabase = await createMediaClient();
  return paginateQuery(
    (offset, bs) => {
      const q = supabase
        .from("external_value")
        .select("*")
        .order("widget_id")
        .order("start_date", { ascending: true })
        .range(offset, offset + bs - 1);
      return q as never;
    },
    mapValueRow,
  );
}

/**
 * Phase 2 payload: external daily rows + mappings + internal daily + latest date.
 * Called from page.tsx server component.
 */
export async function getExternalPagePayload(
  startDate: string,
  endDate: string,
): Promise<ExternalPagePayload> {
  // Use shared dateService (cache()-wrapped, handles empty table)
  const latest = await getLatestDataDate();
  if (!latest) throw new Error("No data dates found in media.daily");

  const effectiveEnd = endDate || latest;
  const effectiveStart = startDate || `${toYearMonth(effectiveEnd)}-01`;

  const [externalRows, mappings, unitPrices] = await Promise.all([
    getExternalDaily(effectiveStart, effectiveEnd),
    getExternalMappings(),
    getExternalValues(),
  ]);

  // Extract mapped widget_ids and fetch internal daily data
  const widgetIds = [
    ...new Set(mappings.map((m) => m.widget_id).filter((id): id is string => id != null)),
  ];
  const internalRows = await getInternalDailyForWidgets(widgetIds, effectiveStart, effectiveEnd);

  return { externalRows, mappings, unitPrices, internalRows, latestDate: latest };
}
