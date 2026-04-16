/**
 * Goal Setting service — CRUD for monthly vIMP goals.
 *
 * Manages team-level (manager_id IS NULL) and individual manager goals
 * stored in the media.goal table.
 */

import { createMediaClient } from "@/lib/supabase/media-server";
import type { GoalRow } from "@/types/app-db.types";

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Fetches team-level monthly goals for a given year.
 * Team goals have manager_id IS NULL.
 *
 * @param year - Calendar year (e.g. 2026)
 * @returns Array of GoalRow for the 12 months of that year
 */
export async function getTeamGoalsForYear(year: number): Promise<GoalRow[]> {
  const supabase = await createMediaClient();

  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;

  const { data, error } = await supabase
    .from("goal")
    .select("id, manager_id, goal_type, date_start, date_end, vimp_target")
    .is("manager_id", null)
    .eq("goal_type", "monthly")
    .gte("date_start", yearStart)
    .lte("date_start", yearEnd)
    .order("date_start", { ascending: true });

  if (error) throw error;
  return (data ?? []) as GoalRow[];
}

/**
 * Fetches all manager-level monthly goals for a given year.
 *
 * @param year - Calendar year (e.g. 2026)
 * @returns Array of GoalRow (with manager_id populated)
 */
export async function getManagerGoalsForYear(
  year: number,
): Promise<GoalRow[]> {
  const supabase = await createMediaClient();

  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;

  const { data, error } = await supabase
    .from("goal")
    .select("id, manager_id, goal_type, date_start, date_end, vimp_target")
    .not("manager_id", "is", null)
    .eq("goal_type", "monthly")
    .gte("date_start", yearStart)
    .lte("date_start", yearEnd)
    .order("date_start", { ascending: true });

  if (error) throw error;
  return (data ?? []) as GoalRow[];
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/**
 * Upserts a monthly goal record.
 *
 * If a matching (manager_id, date_start) row exists, updates vimp_target.
 * Otherwise inserts a new row.
 *
 * @param managerId  - null for team goal, number for manager goal
 * @param monthStart - first day of month "YYYY-MM-01"
 * @param monthEnd   - last day of month "YYYY-MM-DD"
 * @param vimpTarget - target vIMP value
 */
export async function upsertMonthlyGoal(
  managerId: number | null,
  monthStart: string,
  monthEnd: string,
  vimpTarget: number,
): Promise<void> {
  const supabase = await createMediaClient();

  // Check for existing record
  let query = supabase
    .from("goal")
    .select("id")
    .eq("goal_type", "monthly")
    .eq("date_start", monthStart);

  if (managerId === null) {
    query = query.is("manager_id", null);
  } else {
    query = query.eq("manager_id", managerId);
  }

  const { data: existing, error: findError } = await query.limit(1);
  if (findError) throw findError;

  if (existing && existing.length > 0) {
    // Update
    const { error: updateError } = await supabase
      .from("goal")
      .update({ vimp_target: vimpTarget })
      .eq("id", (existing[0] as { id: number }).id);

    if (updateError) throw updateError;
  } else {
    // Insert
    const { error: insertError } = await supabase.from("goal").insert({
      manager_id: managerId,
      goal_type: "monthly",
      date_start: monthStart,
      date_end: monthEnd,
      vimp_target: vimpTarget,
    });

    if (insertError) throw insertError;
  }
}
