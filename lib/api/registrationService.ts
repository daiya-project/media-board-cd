/**
 * Registration service — browser-side Supabase calls for the AddClientModal.
 *
 * Handles creating new clients, services, widgets, and widget contracts.
 * Uses the browser client (`lib/supabase/client.ts`) since these functions
 * are called from Client Components (modal forms).
 */

import { createMediaClient } from "@/lib/supabase/media-client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RegisterClientInput {
  client_id: string;
  client_name: string;
  manager_id: number;
  tier?: string | null;
  contact_name?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
}

export interface UpdateClientInput {
  client_id: string;
  manager_id: number;
  tier?: string | null;
  contact_name?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
}

export interface RegisterServiceInput {
  service_id: string;
  client_id: string;
  service_name: string;
}

export interface RegisterWidgetInput {
  widget_id: string;
  client_id: string;
  service_id: string;
  widget_name: string;
}

export interface CreateWidgetContractInput {
  client_id: string;
  service_id: string;
  widget_id: string;
  contract_type: string;
  contract_value: number | null;
  date_start: string | null;
  date_end: string | null;
}

export interface ClientContactInfo {
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
}

// ---------------------------------------------------------------------------
// Client ID rename
// ---------------------------------------------------------------------------

/**
 * Renames a client_id via DB RPC. Cascades to all child tables.
 * @param oldId - Current client_id
 * @param newId - New client_id to set
 */
export async function renameClientId(oldId: string, newId: string): Promise<void> {
  const supabase = createMediaClient();

  const { error } = await supabase.rpc("rename_client_id", {
    p_old_id: oldId,
    p_new_id: newId,
  });

  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Duplicate checks
// ---------------------------------------------------------------------------

/**
 * Checks if a client_id already exists in media.client.
 * @param clientId - The client_id to check
 * @returns true if the client already exists
 */
export async function checkClientExists(clientId: string): Promise<boolean> {
  const supabase = createMediaClient();

  const { data, error } = await supabase
    .from("client")
    .select("client_id")
    .eq("client_id", clientId)
    .maybeSingle();

  if (error) throw error;
  return !!data;
}

/**
 * Checks if a service_id already exists in media.service.
 * @param serviceId - The service_id to check
 * @returns true if the service already exists
 */
export async function checkServiceExists(serviceId: string): Promise<boolean> {
  const supabase = createMediaClient();

  const { data, error } = await supabase
    .from("service")
    .select("service_id")
    .eq("service_id", serviceId)
    .maybeSingle();

  if (error) throw error;
  return !!data;
}

/**
 * Checks if a widget_id already exists in media.widget.
 * @param widgetId - The widget_id to check
 * @returns true if the widget already exists
 */
export async function checkWidgetExists(widgetId: string): Promise<boolean> {
  const supabase = createMediaClient();

  const { data, error } = await supabase
    .from("widget")
    .select("widget_id")
    .eq("widget_id", widgetId)
    .maybeSingle();

  if (error) throw error;
  return !!data;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Fetches contact info for a given client.
 * Used in the Service tab to auto-populate read-only contact fields.
 * @param clientId - Client to look up
 * @returns Contact name/phone/email or nulls
 */
export async function getClientContactInfo(
  clientId: string,
): Promise<ClientContactInfo> {
  const supabase = createMediaClient();

  const { data, error } = await supabase
    .from("client")
    .select("contact_name, contact_phone, contact_email")
    .eq("client_id", clientId)
    .single();

  if (error) throw error;
  return data as ClientContactInfo;
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/**
 * Updates an existing client's editable fields in media.client.
 * @param input - Client update fields (manager, tier, contact info)
 */
export async function updateClient(input: UpdateClientInput): Promise<void> {
  const supabase = createMediaClient();

  const { error } = await supabase
    .from("client")
    .update({
      manager_id: input.manager_id,
      tier: input.tier || null,
      contact_name: input.contact_name || null,
      contact_phone: input.contact_phone || null,
      contact_email: input.contact_email || null,
    })
    .eq("client_id", input.client_id);

  if (error) throw error;
}

/**
 * Inserts a new client into media.client.
 * @param input - Client registration fields
 */
export async function registerClient(input: RegisterClientInput): Promise<void> {
  const supabase = createMediaClient();

  const { error } = await supabase
    .from("client")
    .insert({
      client_id: input.client_id,
      client_name: input.client_name,
      manager_id: input.manager_id,
      tier: input.tier || null,
      contact_name: input.contact_name || null,
      contact_phone: input.contact_phone || null,
      contact_email: input.contact_email || null,
    });

  if (error) throw error;
}

/**
 * Inserts a new service into media.service.
 * @param input - Service registration fields
 */
export async function registerService(input: RegisterServiceInput): Promise<void> {
  const supabase = createMediaClient();

  const { error } = await supabase
    .from("service")
    .insert({
      service_id: input.service_id,
      client_id: input.client_id,
      service_name: input.service_name,
    });

  if (error) throw error;
}

/**
 * Inserts a new widget into media.widget.
 * @param input - Widget registration fields
 */
export async function registerWidget(input: RegisterWidgetInput): Promise<void> {
  const supabase = createMediaClient();

  const { error } = await supabase
    .from("widget")
    .insert({
      widget_id: input.widget_id,
      client_id: input.client_id,
      service_id: input.service_id,
      widget_name: input.widget_name,
    });

  if (error) throw error;
}

/**
 * Inserts a new widget contract into media.widget_contract.
 * PK is SERIAL auto-increment, so we just insert (no upsert).
 * @param input - Widget contract fields
 */
export async function createWidgetContract(
  input: CreateWidgetContractInput,
): Promise<void> {
  const supabase = createMediaClient();

  const { error } = await supabase
    .from("widget_contract")
    .insert({
      client_id: input.client_id,
      service_id: input.service_id,
      widget_id: input.widget_id,
      contract_type: input.contract_type,
      contract_value: input.contract_value,
      date_start: input.date_start,
      date_end: input.date_end,
    });

  if (error) throw error;
}
