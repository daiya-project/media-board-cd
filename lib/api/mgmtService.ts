/**
 * MGMT section data-fetching service.
 *
 * Reads from the `media` schema:
 *   - media.client   — advertiser master data
 *   - media.action   — CRM activity records (paginated in 1000-row batches)
 *   - media.ref_manager — manager name lookup (VIEW over shared.manager)
 *
 * Pure data-fetching only; aggregation / business logic lives here
 * as it is tightly coupled to the query strategy.
 */

import { createMediaClient } from "@/lib/supabase/media-server";
import { getAllManagers, buildManagerMap } from "@/lib/api/managerService";
import type {
  MediaClient,
  MediaAction,
  MgmtTableRow,
  ContactRule,
  ContactStatus,
} from "@/types/app-db.types";

export interface MgmtFilters {
  search?: string;
  /** Tier value: '상' | '중' | '하' | '기타' */
  tier?: string;
  /** manager_id as string (from URL params) */
  owner?: string;
  /** Stage value: contact | meeting | propose | done */
  stage?: string;
  /** If true, only rows with followupCount > 0 are returned */
  followup?: boolean;
  /** Contact status filter: 'overdue' | 'urgent' | 'upcoming' | 'ok' */
  contactStatus?: string;
}

const ACTION_BATCH = 1000;

/**
 * Fetches aggregated MGMT table data from the media schema.
 *
 * @param filters - Global filter values from URL search params
 * @returns Array of aggregated rows sorted by most-recent action date (desc)
 * @throws Supabase/network error if any query fails
 */
export async function getMgmtTableData(
  filters: MgmtFilters = {},
): Promise<MgmtTableRow[]> {
  const supabase = await createMediaClient();

  // ---------------------------------------------------------------------------
  // 1. Fetch active clients matching filter criteria
  // ---------------------------------------------------------------------------
  let clientQuery = supabase
    .from("client")
    .select(
      "client_id, client_name, tier, manager_id, contact_name, contact_phone, contact_email",
    )
    .eq("is_active", true);

  if (filters.tier) {
    clientQuery = clientQuery.eq("tier", filters.tier);
  }
  if (filters.owner) {
    const ownerId = parseInt(filters.owner, 10);
    if (!isNaN(ownerId)) {
      clientQuery = clientQuery.eq("manager_id", ownerId);
    }
  }

  let clients: MediaClient[];

  if (filters.search) {
    // Search matches client_id, client_name, service_id, service_name in parallel
    const term = `%${filters.search}%`;
    const [clientResult, serviceResult] = await Promise.all([
      clientQuery.or(`client_id.ilike.${term},client_name.ilike.${term}`),
      supabase
        .from("service")
        .select("client_id")
        .or(`service_id.ilike.${term},service_name.ilike.${term}`),
    ]);
    if (clientResult.error) throw clientResult.error;
    if (serviceResult.error) throw serviceResult.error;

    // Collect client_ids matched via service, then fetch their full client rows
    const serviceClientIds = (
      (serviceResult.data ?? []) as Array<{ client_id: string }>
    ).map((r) => r.client_id);

    const directClients = (clientResult.data ?? []) as MediaClient[];
    const directIds = new Set(directClients.map((c) => c.client_id));

    // Fetch additional clients matched only through service search
    const extraIds = serviceClientIds.filter((id) => !directIds.has(id));
    if (extraIds.length > 0) {
      const { data: extraClients, error: extraError } = await supabase
        .from("client")
        .select(
          "client_id, client_name, tier, manager_id, contact_name, contact_phone, contact_email",
        )
        .in("client_id", extraIds)
        .eq("is_active", true);
      if (extraError) throw extraError;
      clients = [...directClients, ...((extraClients ?? []) as MediaClient[])];
    } else {
      clients = directClients;
    }
  } else {
    const { data, error: clientError } = await clientQuery;
    if (clientError) throw clientError;
    clients = (data ?? []) as MediaClient[];
  }

  if (!clients || clients.length === 0) return [];

  const clientIds = (clients as MediaClient[]).map((c) => c.client_id);

  // ---------------------------------------------------------------------------
  // 2. Fetch all actions for the matched clients (1 000-row batch pagination)
  // ---------------------------------------------------------------------------
  const allActions: MediaAction[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data: actions, error: actionsError } = await supabase
      .from("action")
      .select("action_id, client_id, action_date, stage, memo, has_followup")
      .in("client_id", clientIds)
      .eq("is_deleted", false)
      .order("action_date", { ascending: false })
      .order("created_at", { ascending: false })
      .range(offset, offset + ACTION_BATCH - 1);

    if (actionsError) throw actionsError;
    if (!actions || actions.length === 0) {
      hasMore = false;
      break;
    }

    allActions.push(...(actions as MediaAction[]));
    if (actions.length < ACTION_BATCH) hasMore = false;
    else offset += ACTION_BATCH;
  }

  // ---------------------------------------------------------------------------
  // 3. Fetch manager names + contact rules + "today" date in parallel
  // ---------------------------------------------------------------------------
  const [managers, contactRulesResult, todayResult] = await Promise.all([
    getAllManagers(),
    supabase
      .from("contact_rule")
      .select("id, tier, rule_day, required_stages, is_active"),
    supabase
      .from("v_dates")
      .select("date")
      .order("date", { ascending: false })
      .limit(1),
  ]);

  if (contactRulesResult.error) throw contactRulesResult.error;
  if (todayResult.error) throw todayResult.error;

  const contactRules = (contactRulesResult.data ?? []) as ContactRule[];
  const ruleMap = new Map<string, ContactRule>();
  for (const r of contactRules) ruleMap.set(r.tier, r);

  const latestDate = (todayResult.data?.[0] as { date: string } | undefined)?.date;
  if (!latestDate) throw new Error("No data dates found in v_dates");
  const todayStr = latestDate;
  const todayMs = new Date(todayStr).getTime();

  const managerMap = buildManagerMap(managers);

  // ---------------------------------------------------------------------------
  // 4. Group actions by client_id
  // ---------------------------------------------------------------------------
  const actionMap = new Map<string, MediaAction[]>();
  allActions.forEach((a) => {
    if (!actionMap.has(a.client_id)) actionMap.set(a.client_id, []);
    actionMap.get(a.client_id)!.push(a);
  });

  // ---------------------------------------------------------------------------
  // 5. Build aggregated rows
  // ---------------------------------------------------------------------------
  let rows: MgmtTableRow[] = (clients as MediaClient[]).map((c) => {
    const acts = actionMap.get(c.client_id) ?? [];
    const latest = acts[0] ?? null; // already sorted desc by action_date

    // Find first action with non-null memo for lastMemo
    const latestWithMemo = acts.find((a) => a.memo !== null && a.memo !== undefined);

    // Compute contact status based on tier rules
    const rule = ruleMap.get(c.tier ?? "");
    let contactStatus: ContactStatus | null = null;
    let daysRemaining: number | null = null;

    if (rule && rule.is_active) {
      const requiredStages = new Set(rule.required_stages);
      // Find most recent qualifying action
      let lastQualifyingDate: string | null = null;
      for (const a of acts) {
        if (a.stage && requiredStages.has(a.stage)) {
          lastQualifyingDate = a.action_date;
          break;
        }
      }

      const daysElapsed = lastQualifyingDate
        ? Math.floor((todayMs - new Date(lastQualifyingDate).getTime()) / (1000 * 60 * 60 * 24))
        : rule.rule_day + 1;

      daysRemaining = rule.rule_day - daysElapsed;

      if (daysElapsed > rule.rule_day) {
        contactStatus = "overdue";
      } else if (daysRemaining <= 7) {
        contactStatus = "urgent";
      } else if (daysRemaining <= 30) {
        contactStatus = "upcoming";
      } else {
        contactStatus = "ok";
      }
    }

    return {
      client_id: c.client_id,
      client_name: c.client_name,
      tier: c.tier,
      manager_id: c.manager_id,
      contact_name: c.contact_name,
      contact_phone: c.contact_phone,
      contact_email: c.contact_email,
      lastDate: latest?.action_date ?? null,
      actionCount: acts.length,
      followupCount: acts.filter((a) => a.has_followup).length,
      currentStage: (latest?.stage ?? null) as MgmtTableRow["currentStage"],
      lastMemo: latestWithMemo?.memo ?? null,
      managerName: c.manager_id ? (managerMap.get(c.manager_id) ?? null) : null,
      contactStatus,
      daysRemaining,
    };
  });

  // ---------------------------------------------------------------------------
  // 6. Post-aggregation filters (stage, followup depend on aggregated data)
  // ---------------------------------------------------------------------------
  if (filters.stage) {
    rows = rows.filter((r) => r.currentStage === filters.stage);
  }
  if (filters.followup) {
    rows = rows.filter((r) => r.followupCount > 0);
  }
  if (filters.contactStatus) {
    const statuses = new Set(filters.contactStatus.split(","));
    rows = rows.filter((r) => r.contactStatus !== null && statuses.has(r.contactStatus));
  }

  // ---------------------------------------------------------------------------
  // 7. Default sort: most-recent action date first (nulls last)
  // ---------------------------------------------------------------------------
  rows.sort((a, b) => {
    if (!a.lastDate && !b.lastDate) return 0;
    if (!a.lastDate) return 1;
    if (!b.lastDate) return -1;
    return b.lastDate.localeCompare(a.lastDate);
  });

  return rows;
}
