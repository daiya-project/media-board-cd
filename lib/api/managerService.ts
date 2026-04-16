/**
 * Manager service — shared server-side manager lookup.
 *
 * Centralizes ref_manager queries used by mgmtService and clientDetailService.
 * The browser-side equivalent lives in actionService.ts (uses media-client).
 */

import { createMediaClient } from "@/lib/supabase/media-server";
import { getDisplayName } from "@/lib/utils/date-utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ManagerRow {
  id: number;
  name: string;
  /** First-word display name (e.g. "홍길동 Hong" → "홍길동") */
  displayName: string;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Fetches media-team managers from media.ref_manager (server-side).
 * Only returns managers where team = 'media'.
 *
 * @returns Array of { id, name }
 * @throws Supabase error if the query fails
 */
export async function getAllManagers(): Promise<ManagerRow[]> {
  const supabase = await createMediaClient();

  const { data, error } = await supabase
    .from("ref_manager")
    .select("id, name")
    .eq("team", "media");

  if (error) throw error;
  return (data ?? []).map((row: { id: number; name: string }) => ({
    ...row,
    displayName: getDisplayName(row.name),
  }));
}

/**
 * Builds an id → display name map from manager rows.
 * Applies the first-name-only rule (splits by space, takes first part).
 *
 * @param managers - Raw manager rows from getAllManagers()
 * @returns Map<manager_id, display_name>
 */
export function buildManagerMap(managers: ManagerRow[]): Map<number, string> {
  return new Map(managers.map((m) => [m.id, m.displayName]));
}
