/**
 * Shared date service — canonical "today" and "current month" for the app.
 *
 * "Today" is NOT the wall-clock date. It is the most recent date recorded
 * in media.daily, which may lag behind the real calendar by 1–2 days
 * depending on import frequency. All sections should use these functions
 * instead of `new Date()` to ensure consistent "current period" logic.
 */

import { createMediaClient } from "@/lib/supabase/media-server";
import { toYearMonth } from "@/lib/utils/date-utils";
import { cache } from "react";

/**
 * Fetches the most recent date present in media.daily.
 * Uses MAX(date) — extremely fast due to the idx_daily_date index.
 *
 * Wrapped in React cache() for per-request deduplication.
 * (unstable_cache cannot be used here because createClient() calls cookies()
 *  which is not allowed inside unstable_cache.)
 *
 * @returns Most recent date string (YYYY-MM-DD), or null if table is empty.
 * @throws Supabase error if the query fails.
 */
export const getLatestDataDate = cache(async (): Promise<string | null> => {
  const supabase = await createMediaClient();

  const { data, error } = await supabase
    .from("daily")
    .select("date")
    .order("date", { ascending: false })
    .limit(1)
    .single();

  if (error) {
    // "PGRST116" = no rows — table may be empty, not a fatal error
    if (error.code === "PGRST116") return null;
    throw error;
  }

  return (data?.date as string) ?? null;
});

/**
 * Returns the month (YYYY-MM) of the most recent data date.
 * Used as the canonical "current month" across all sections.
 *
 * @returns Month string (YYYY-MM), or null if no data exists.
 */
export async function getLatestDataMonth(): Promise<string | null> {
  const date = await getLatestDataDate();
  if (!date) return null;
  return toYearMonth(date);
}
