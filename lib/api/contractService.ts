/**
 * Contract service — browser-side Supabase calls for contract mutations.
 *
 * Handles closing existing contracts and adding new ones.
 * Uses the browser client (`lib/supabase/client.ts`) since these functions
 * are called from Client Components (ClientOverviewSheet inline forms).
 */

import { createMediaClient } from "@/lib/supabase/media-client";

/**
 * Closes a contract by updating its date_end.
 * Used when a contract is superseded by a new one.
 *
 * @param contractId - The SERIAL PK of the contract to close
 * @param dateEnd - New end date (YYYY-MM-DD)
 */
export async function closeContract(
  contractId: number,
  dateEnd: string,
): Promise<void> {
  const supabase = createMediaClient();

  const { error } = await supabase
    .from("widget_contract")
    .update({ date_end: dateEnd })
    .eq("id", contractId);

  if (error) throw error;
}

/**
 * Inserts a new contract for an existing widget.
 * The caller is responsible for closing the previous contract first.
 *
 * @param input - New contract fields
 */
export async function addContract(input: {
  client_id: string;
  service_id: string;
  widget_id: string;
  contract_type: string;
  contract_value: number | null;
  date_start: string | null;
  date_end: string | null;
}): Promise<void> {
  const supabase = createMediaClient();

  const { error } = await supabase
    .from("widget_contract")
    .insert(input);

  if (error) throw error;
}
