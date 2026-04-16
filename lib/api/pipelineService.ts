/**
 * Pipeline service — server-side data fetching for Recent Activities
 * and contact-due clients.
 *
 * Fetches the latest actions across all clients with client name resolution,
 * for use in the Pipeline page's activity feed.
 */

import { createMediaClient } from "@/lib/supabase/media-server";
import { getAllManagers, buildManagerMap } from "@/lib/api/managerService";
import type {
  RecentActivity,
  ActionStage,
  BlockNoteContent,
  ContactRule,
  ContactStatus,
  ContactStatusRow,
} from "@/types/app-db.types";

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Fetches recent activity records across all clients.
 * Joins with the client table to resolve client_name.
 * @param limit - Max number of activities to return (default 50)
 * @returns Array of recent activities sorted by action_date desc, created_at desc
 */
export async function getRecentActivities(
  limit: number = 50,
): Promise<RecentActivity[]> {
  const supabase = await createMediaClient();

  const { data, error } = await supabase
    .from("action")
    .select(
      "action_id, client_id, service_id, widget_id, action_date, stage, memo, has_followup, created_at, client:client_id(client_name)",
    )
    .eq("is_deleted", false)
    .order("action_date", { ascending: false })
    .order("created_at", { ascending: false })
    .range(0, limit - 1);

  if (error) throw error;

  return (data ?? []).map(
    (row: Record<string, unknown>) => {
      const client = row.client as Record<string, unknown> | null;
      return {
        action_id: row.action_id as number,
        client_id: row.client_id as string,
        client_name: (client?.client_name as string) ?? "Unknown",
        service_id: row.service_id as string | null,
        widget_id: row.widget_id as string | null,
        action_date: row.action_date as string,
        stage: row.stage as ActionStage | null,
        memo: row.memo as BlockNoteContent | null,
        has_followup: row.has_followup as boolean,
        created_at: row.created_at as string,
      };
    },
  );
}

// ---------------------------------------------------------------------------
// Contact-due clients
// ---------------------------------------------------------------------------

const ACTION_BATCH = 1000;

/**
 * Fetches clients whose contact cycle is due (overdue or urgent).
 * Computes contact status based on tier-specific contact_rule and action history.
 * @param todayDate - DB latest data date (YYYY-MM-DD)
 * @returns Array of ContactStatusRow sorted by days_remaining asc (most urgent first)
 */
export async function getContactDueClients(
  todayDate: string,
): Promise<ContactStatusRow[]> {
  const supabase = await createMediaClient();

  // 1. Fetch contact rules + active clients + managers in parallel
  const [rulesResult, clientsResult, managers] = await Promise.all([
    supabase
      .from("contact_rule")
      .select("id, tier, rule_day, required_stages, is_active"),
    supabase
      .from("client")
      .select("client_id, client_name, tier, manager_id")
      .eq("is_active", true),
    getAllManagers(),
  ]);

  if (rulesResult.error) throw rulesResult.error;
  if (clientsResult.error) throw clientsResult.error;

  const contactRules = (rulesResult.data ?? []) as ContactRule[];
  const ruleMap = new Map<string, ContactRule>();
  for (const r of contactRules) {
    if (r.is_active) ruleMap.set(r.tier, r);
  }

  const clients = (clientsResult.data ?? []) as Array<{
    client_id: string;
    client_name: string;
    tier: string | null;
    manager_id: number | null;
  }>;

  // Filter to clients that have an active rule for their tier
  const eligibleClients = clients.filter((c) => c.tier && ruleMap.has(c.tier));
  if (eligibleClients.length === 0) return [];

  const clientIds = eligibleClients.map((c) => c.client_id);
  const managerMap = buildManagerMap(managers);

  // 2. Fetch all actions for eligible clients (paginated)
  const allActions: Array<{
    client_id: string;
    action_date: string;
    stage: string | null;
  }> = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data: actions, error: actionsError } = await supabase
      .from("action")
      .select("client_id, action_date, stage")
      .in("client_id", clientIds)
      .eq("is_deleted", false)
      .order("action_date", { ascending: false })
      .range(offset, offset + ACTION_BATCH - 1);

    if (actionsError) throw actionsError;
    if (!actions || actions.length === 0) {
      hasMore = false;
      break;
    }

    allActions.push(
      ...(actions as Array<{
        client_id: string;
        action_date: string;
        stage: string | null;
      }>),
    );
    if (actions.length < ACTION_BATCH) hasMore = false;
    else offset += ACTION_BATCH;
  }

  // 3. Group actions by client_id
  const actionMap = new Map<
    string,
    Array<{ action_date: string; stage: string | null }>
  >();
  for (const a of allActions) {
    if (!actionMap.has(a.client_id)) actionMap.set(a.client_id, []);
    actionMap.get(a.client_id)!.push(a);
  }

  // 4. Compute contact status per client
  const todayMs = new Date(todayDate).getTime();
  const rows: ContactStatusRow[] = [];

  for (const c of eligibleClients) {
    const rule = ruleMap.get(c.tier!);
    if (!rule) continue;

    const acts = actionMap.get(c.client_id) ?? [];
    const requiredStages = new Set(rule.required_stages);

    // Find most recent qualifying action (date + stage)
    let lastQualifyingDate: string | null = null;
    let lastStage: string | null = null;
    for (const a of acts) {
      if (a.stage && requiredStages.has(a.stage)) {
        lastQualifyingDate = a.action_date;
        lastStage = a.stage;
        break; // already sorted desc
      }
    }

    const daysElapsed = lastQualifyingDate
      ? Math.floor(
          (todayMs - new Date(lastQualifyingDate).getTime()) /
            (1000 * 60 * 60 * 24),
        )
      : rule.rule_day + 1; // no qualifying action → treat as overdue

    const daysRemaining = rule.rule_day - daysElapsed;

    let contactStatus: ContactStatus;
    if (daysElapsed > rule.rule_day) {
      contactStatus = "overdue";
    } else if (daysRemaining <= 7) {
      contactStatus = "urgent";
    } else if (daysRemaining <= 30) {
      contactStatus = "upcoming";
    } else {
      contactStatus = "ok";
    }

    // Only include overdue + urgent + upcoming (skip ok)
    if (contactStatus === "ok") continue;

    const managerName = c.manager_id
      ? managerMap.get(c.manager_id)?.split(" ")[0] ?? null
      : null;

    rows.push({
      client_id: c.client_id,
      client_name: c.client_name,
      tier: c.tier as ContactStatusRow["tier"],
      manager_id: c.manager_id,
      manager_name: managerName,
      rule_day: rule.rule_day,
      last_action_date: lastQualifyingDate,
      last_stage: lastStage,
      days_elapsed: daysElapsed,
      days_remaining: daysRemaining,
      contact_status: contactStatus,
    });
  }

  // Sort: most urgent first (overdue with largest negative → upcoming with smallest positive)
  rows.sort((a, b) => (a.days_remaining ?? 0) - (b.days_remaining ?? 0));

  return rows;
}
