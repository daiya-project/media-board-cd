/**
 * CVR section — server-side data service.
 *
 * Fetches monthly CVR data from media.cvr for the CVR Manager page.
 * All queries use the media schema client (createMediaClient from media-server.ts).
 */

import { createMediaClient } from "@/lib/supabase/media-server";
import { getClientMeta } from "@/lib/api/dataBoard/shared";
import { paginateQuery } from "@/lib/api/paginateQuery";
import { toYearMonth, addMonths } from "@/lib/utils/date-utils";
import type { CvrPayload, CvrMonthlyPayload, CvrYearlyLevels, CvrRawRow } from "@/types/app-db.types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns YYYY-MM-DD for the first day of a given YYYY-MM month string. */
function toFirstDay(month: string): string {
  return `${month}-01`;
}

// ---------------------------------------------------------------------------
// getCvrPayload
// ---------------------------------------------------------------------------

/**
 * Phase 1 — Fetches monthly CVR data (rows + prev-month levels) for fast initial load.
 *
 * @param month - YYYY-MM string (optional; defaults to the latest available month)
 * @returns CvrMonthlyPayload with rows, available months, prevLevels, and clientMeta
 */
export async function getCvrMonthlyPayload(month?: string | null): Promise<CvrMonthlyPayload> {
  const supabase = await createMediaClient();

  // -------------------------------------------------------------------------
  // 1. Fetch all distinct months with data (paginated)
  // -------------------------------------------------------------------------
  const dateRows = await paginateQuery(
    (offset, batchSize) =>
      (supabase as any)
        .from("cvr")
        .select("date")
        .order("date", { ascending: false })
        .range(offset, offset + batchSize - 1),
    (row) => row as { date: string },
  );

  // Deduplicate and convert to YYYY-MM
  const monthSet = new Set<string>();
  for (const row of dateRows) {
    monthSet.add(toYearMonth(row.date));
  }
  const availableMonths = Array.from(monthSet); // already desc due to order

  if (availableMonths.length === 0) {
    return {
      selectedMonth: month ?? "",
      availableMonths: [],
      rows: [],
      prevLevels: {},
      clientMeta: [],
    };
  }

  // -------------------------------------------------------------------------
  // 2. Resolve selected month
  // -------------------------------------------------------------------------
  const selectedMonth =
    month && availableMonths.includes(month) ? month : availableMonths[0];

  // -------------------------------------------------------------------------
  // 3. Fetch rows for the selected month (paginated)
  // -------------------------------------------------------------------------
  const rows: CvrRawRow[] = await paginateQuery(
    (offset, batchSize) =>
      (supabase as any)
        .from("cvr")
        .select(
          "date, client_id, service_id, service_name, service_type, level, " +
            "revenue, vimp, rpm, vctr_pct, cpc, click, campaign_count, " +
            "normalized_cvr_pct, invalid_revenue_ratio_pct, contribution_margin_rate_pct",
        )
        .eq("date", toFirstDay(selectedMonth))
        .order("vimp", { ascending: false, nullsFirst: false })
        .range(offset, offset + batchSize - 1),
    (r) => ({
    date: String(r.date),
    client_id: String(r.client_id),
    service_id: String(r.service_id),
    service_name: r.service_name != null ? String(r.service_name) : null,
    service_type: r.service_type != null ? String(r.service_type) : null,
    level: r.level != null ? String(r.level) : null,
    revenue: r.revenue != null ? Number(r.revenue) : null,
    vimp: r.vimp != null ? Number(r.vimp) : null,
    rpm: r.rpm != null ? Number(r.rpm) : null,
    vctr_pct: r.vctr_pct != null ? Number(r.vctr_pct) : null,
    cpc: r.cpc != null ? Number(r.cpc) : null,
    click: r.click != null ? Number(r.click) : null,
    campaign_count: r.campaign_count != null ? Number(r.campaign_count) : null,
    normalized_cvr_pct: r.normalized_cvr_pct != null ? Number(r.normalized_cvr_pct) : null,
    invalid_revenue_ratio_pct:
      r.invalid_revenue_ratio_pct != null ? Number(r.invalid_revenue_ratio_pct) : null,
    contribution_margin_rate_pct:
      r.contribution_margin_rate_pct != null ? Number(r.contribution_margin_rate_pct) : null,
  }),
  );

  // -------------------------------------------------------------------------
  // 4. Fetch prev month levels only (for prevLevel column in monthly view)
  // -------------------------------------------------------------------------
  const prevMonth = addMonths(selectedMonth, -1);

  const prevLevelData = await paginateQuery(
    (offset, batchSize) =>
      (supabase as any)
        .from("cvr")
        .select("service_id, level")
        .eq("date", toFirstDay(prevMonth))
        .range(offset, offset + batchSize - 1),
    (r) => ({
      service_id: String(r.service_id),
      level: r.level != null ? String(r.level) : null,
    }),
  );

  const prevLevels: Record<string, string | null> = {};
  for (const row of prevLevelData) {
    prevLevels[row.service_id] = row.level;
  }

  const clientMeta = await getClientMeta();

  return {
    selectedMonth,
    availableMonths,
    rows,
    prevLevels,
    clientMeta,
  };
}

// ---------------------------------------------------------------------------
// getCvrYearlyLevels  (Phase 2 — lazy loaded on yearly view switch)
// ---------------------------------------------------------------------------

/**
 * Phase 2 — Fetches 13-month level history for the yearly view.
 *
 * @param selectedMonth - YYYY-MM string for the currently selected month
 * @returns Array of {month, levels} ordered ascending (oldest first)
 */
export async function getCvrYearlyLevels(
  selectedMonth: string,
): Promise<CvrYearlyLevels> {
  const supabase = await createMediaClient();

  const prev12Month = addMonths(selectedMonth, -12);

  const levelData = await paginateQuery(
    (offset, batchSize) =>
      (supabase as any)
        .from("cvr")
        .select("date, service_id, level")
        .gte("date", toFirstDay(prev12Month))
        .lte("date", toFirstDay(selectedMonth))
        .order("date", { ascending: true })
        .range(offset, offset + batchSize - 1),
    (r) => ({
      date: String(r.date),
      service_id: String(r.service_id),
      level: r.level != null ? String(r.level) : null,
    }),
  );

  // Group by month → {service_id: level}
  const monthLevelMap = new Map<string, Record<string, string | null>>();
  for (const row of levelData) {
    const m = toYearMonth(row.date);
    if (!monthLevelMap.has(m)) monthLevelMap.set(m, {});
    const entry = monthLevelMap.get(m)!;
    entry[row.service_id] = row.level;
  }

  return Array.from(monthLevelMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, levels]) => ({ month, levels }));
}

// ---------------------------------------------------------------------------
// getCvrPayload  (legacy — full payload, kept for backward compatibility)
// ---------------------------------------------------------------------------

/**
 * Fetches the full CVR payload for the given month (or the latest available month).
 *
 * @deprecated Use getCvrMonthlyPayload + getCvrYearlyLevels separately for phased loading.
 * @param month - YYYY-MM string (optional; defaults to the latest available month)
 * @returns CvrPayload with rows, available months, prev-month levels, and past 13-month levels
 */
export async function getCvrPayload(month?: string | null): Promise<CvrPayload> {
  const monthly = await getCvrMonthlyPayload(month);
  const pastMonthLevels = await getCvrYearlyLevels(monthly.selectedMonth);

  return {
    ...monthly,
    pastMonthLevels,
  };
}
