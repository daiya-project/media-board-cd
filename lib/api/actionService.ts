/**
 * Action service — browser-side Supabase calls for the RecordAction modal.
 *
 * Uses the browser client (`lib/supabase/client.ts`) since these functions
 * are called from Client Components (modal forms).
 */

import { createMediaClient } from "@/lib/supabase/media-client";
import { getDisplayName } from "@/lib/utils/date-utils";
import type { ActionStage, BlockNoteContent } from "@/types/app-db.types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ClientOption {
  client_id: string;
  client_name: string;
}

export interface ServiceOption {
  service_id: string;
  service_name: string;
}

export interface WidgetOption {
  widget_id: string;
  widget_name: string | null;
}

export interface ManagerOption {
  id: number;
  name: string;
  /** First-word display name (e.g. "홍길동 Hong" → "홍길동") */
  displayName: string;
}

export interface CreateActionInput {
  client_id: string;
  service_id?: string | null;
  widget_id?: string | null;
  action_date: string; // YYYY-MM-DD
  stage?: ActionStage | null;
  memo?: BlockNoteContent | null;
  has_followup?: boolean;
}

export interface UpdateActionInput {
  service_id?: string | null;
  widget_id?: string | null;
  action_date?: string; // YYYY-MM-DD
  stage?: ActionStage | null;
  memo?: BlockNoteContent | null;
  has_followup?: boolean;
}

export interface ActionDetail {
  action_id: number;
  client_id: string;
  service_id: string | null;
  widget_id: string | null;
  action_date: string;
  stage: ActionStage | null;
  memo: BlockNoteContent | null;
  has_followup: boolean;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Fetches all active clients for the client selector dropdown.
 * @returns Array of { client_id, client_name } sorted by name
 */
export async function getActiveClients(): Promise<ClientOption[]> {
  const supabase = createMediaClient();

  const { data, error } = await supabase
    .from("client")
    .select("client_id, client_name")
    .eq("is_active", true)
    .order("client_name", { ascending: true });

  if (error) throw error;
  return (data ?? []) as ClientOption[];
}

/**
 * Fetches all managers for the owner filter dropdown.
 * @returns Array of { id, name } sorted by name
 */
export async function getManagers(): Promise<ManagerOption[]> {
  const supabase = createMediaClient();

  const { data, error } = await supabase
    .from("ref_manager")
    .select("id, name")
    .eq("team", "media")
    .order("name", { ascending: true });

  if (error) throw error;
  return (data ?? []).map((row: { id: number; name: string }) => ({
    ...row,
    displayName: getDisplayName(row.name),
  }));
}

/**
 * Fetches active services belonging to a client.
 * @param clientId - The owning client ID
 * @returns Array of { service_id, service_name } sorted by name
 */
export async function getServicesByClient(
  clientId: string,
): Promise<ServiceOption[]> {
  const supabase = createMediaClient();

  const { data, error } = await supabase
    .from("service")
    .select("service_id, service_name")
    .eq("client_id", clientId)
    .eq("is_active", true)
    .order("service_name", { ascending: true });

  if (error) throw error;
  return (data ?? []) as ServiceOption[];
}

/**
 * Fetches widgets belonging to a service.
 * @param serviceId - The owning service ID
 * @returns Array of { widget_id, widget_name } sorted by name
 */
export async function getWidgetsByService(
  serviceId: string,
): Promise<WidgetOption[]> {
  const supabase = createMediaClient();

  const { data, error } = await supabase
    .from("widget")
    .select("widget_id, widget_name")
    .eq("service_id", serviceId)
    .order("widget_name", { ascending: true });

  if (error) throw error;
  return (data ?? []) as WidgetOption[];
}

/**
 * Fetches all action records for a specific client.
 * @param clientId - The client ID to fetch actions for
 * @returns Array of action records sorted by action_date desc, then created_at desc
 */
export async function getActionsByClient(clientId: string): Promise<{
  action_id: number;
  action_date: string;
  stage: ActionStage | null;
  service_id: string | null;
  widget_id: string | null;
  memo: BlockNoteContent | null;
  has_followup: boolean;
}[]> {
  const supabase = createMediaClient();

  // Per-client action count is realistically well under 1000, but apply
  // .range() pagination to comply with Supabase 1000-row SELECT rule.
  const PAGE_SIZE = 1000;
  const allRows: {
    action_id: number;
    action_date: string;
    stage: ActionStage | null;
    service_id: string | null;
    widget_id: string | null;
    memo: BlockNoteContent | null;
    has_followup: boolean;
  }[] = [];
  let offset = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await supabase
      .from("action")
      .select("action_id, action_date, stage, service_id, widget_id, memo, has_followup")
      .eq("client_id", clientId)
      .eq("is_deleted", false)
      .order("action_date", { ascending: false })
      .order("created_at", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;
    allRows.push(...data);
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return allRows;
}

/**
 * Fetches a single action record by action_id.
 * @param actionId - The action ID to fetch
 * @returns Action detail record
 */
export async function getActionById(actionId: number): Promise<ActionDetail> {
  const supabase = createMediaClient();

  const { data, error } = await supabase
    .from("action")
    .select("action_id, client_id, service_id, widget_id, action_date, stage, memo, has_followup")
    .eq("action_id", actionId)
    .single();

  if (error) throw error;
  return data as ActionDetail;
}

/**
 * Inserts a new action record into media.action.
 * @param input - Action fields to insert
 */
export async function createAction(input: CreateActionInput): Promise<void> {
  const supabase = createMediaClient();

  const { error } = await supabase
    .from("action")
    .insert({
      client_id: input.client_id,
      service_id: input.service_id || null,
      widget_id: input.widget_id || null,
      action_date: input.action_date,
      stage: input.stage || null,
      memo: input.memo || null,
      has_followup: input.has_followup ?? false,
    });

  if (error) throw error;
}

/**
 * Updates an existing action record.
 * @param actionId - The action ID to update
 * @param input - Fields to update
 */
export async function updateAction(
  actionId: number,
  input: UpdateActionInput
): Promise<void> {
  const supabase = createMediaClient();

  const { error } = await supabase
    .from("action")
    .update({
      service_id: input.service_id !== undefined ? input.service_id : undefined,
      widget_id: input.widget_id !== undefined ? input.widget_id : undefined,
      action_date: input.action_date,
      stage: input.stage !== undefined ? input.stage : undefined,
      memo: input.memo !== undefined ? input.memo : undefined,
      has_followup: input.has_followup !== undefined ? input.has_followup : undefined,
    })
    .eq("action_id", actionId);

  if (error) throw error;
}

/**
 * Soft-deletes an action by setting is_deleted = true.
 * The action remains in the database for history tracking but is filtered out from all UI queries.
 * @param actionId - The action ID to delete
 */
export async function softDeleteAction(actionId: number): Promise<void> {
  const supabase = createMediaClient();

  const { error } = await supabase
    .from("action")
    .update({ is_deleted: true })
    .eq("action_id", actionId);

  if (error) throw error;
}

