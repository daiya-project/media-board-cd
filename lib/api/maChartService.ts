/**
 * Moving Average chart data-fetching service.
 *
 * Two-phase loading strategy:
 *   Phase 1 (await):  35 dates of service-level data + metadata
 *                      → chart renders immediately with default 30d + MA5.
 *   Phase 2 (Promise): All 150 dates of service-level data
 *                      → replaces Phase 1; enables 90d + MA60.
 *
 * Widget-level data is fetched on demand via API route.
 *
 * Reuses getBoardAllDates and getServiceData from boardService.ts.
 */

import { getBoardAllDates, getServiceData } from "@/lib/api/boardService";
import { getHolidays } from "@/lib/api/dataBoardService";
import type { DailyServiceRow } from "@/types/app-db.types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MaChartQuickPayload {
  /** Up to 150 dates, newest first (YYYY-MM-DD[]). */
  allDates: string[];
  /** Service-level daily rows for initial dates (~1,750 rows). */
  serviceData: DailyServiceRow[];
  /** Holiday + weekend dates (YYYY-MM-DD[]). */
  holidays: string[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Max days to fetch: 90d display + 60d MA warmup. */
const MA_FETCH_DAYS = 150;

/** Initial days: 30d default display + 5d MA5 warmup. */
const MA_QUICK_DAYS = 35;

// ---------------------------------------------------------------------------
// Phase 1: Quick payload (awaited)
// ---------------------------------------------------------------------------

/**
 * Assembles the quick MA chart payload on the server.
 * Fetches the date list (fast) + 35 days of service data + holidays.
 *
 * @returns Quick payload with initial service data
 * @throws Supabase error if any query fails
 */
export async function getMaChartQuickPayload(): Promise<MaChartQuickPayload> {
  const allDates = await getBoardAllDates(MA_FETCH_DAYS);
  if (allDates.length === 0) {
    return { allDates: [], serviceData: [], holidays: [] };
  }

  const quickDates = allDates.slice(0, MA_QUICK_DAYS);
  const oldest = allDates[allDates.length - 1];
  const newest = allDates[0];

  const [serviceData, holidays] = await Promise.all([
    getServiceData(quickDates, null),
    getHolidays(oldest, newest),
  ]);

  return { allDates, serviceData, holidays };
}

// ---------------------------------------------------------------------------
// Phase 2: Full service data (NOT awaited — passed as Promise)
// ---------------------------------------------------------------------------

/**
 * Fetches full 150 days of service-level data.
 * Called without await in page.tsx so it resolves in the background.
 *
 * @param allDates - All 150 date strings from Phase 1
 * @returns Full service-level rows (~7,500 rows)
 */
export async function getMaChartFullData(
  allDates: string[],
): Promise<DailyServiceRow[]> {
  return getServiceData(allDates, null);
}
