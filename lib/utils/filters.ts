/**
 * Shared filtering utilities.
 * Used by DATA section and other sections that filter tabular data.
 */

import type { ClientMeta, DataFilterType, DataBoardGroupedRow } from "@/types/app-db.types";
import { SMALL_SLOT_THRESHOLD } from "@/lib/config";

/**
 * Checks whether any of the given field values match the comma-separated
 * search query (case-insensitive, any term against any field).
 *
 * Returns true if:
 *  - the search string is empty / blank, OR
 *  - at least one comma-separated term matches at least one of the fields.
 *
 * @param fields - Array of string values to search against (ids, names, etc.)
 * @param search - Raw search string from the URL or state (may be comma-separated)
 *
 * @example
 * matchesSearch(["42", "네이버", "메인", "M123", "위젯A"], "네이버,42")
 * // → true
 */
export function matchesSearch(fields: string[], search: string): boolean {
  const trimmed = search.trim();
  if (!trimmed) return true;

  const terms = trimmed
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length > 0);

  if (terms.length === 0) return true;

  const lowerFields = fields.map((f) => (f ?? "").toLowerCase());
  return terms.some((term) => lowerFields.some((field) => field.includes(term)));
}

/**
 * Checks whether a row's latest-date cost_spent meets the minimum threshold
 * for its granularity level, used to exclude low-revenue "small slots".
 *
 * Thresholds (from lib/config.ts SMALL_SLOT_THRESHOLD):
 *  - client:  100,000
 *  - service:  30,000
 *  - widget:   10,000
 *
 * @param costSpent   - The cost_spent value for the latest date
 * @param filterType  - Current granularity level (client / service / widget)
 * @param excludeSmall - Whether the small-slot filter is active
 * @returns true if the row should be shown (passes the filter)
 */
/**
 * Extracts the searchable string fields from a DATA section grouped row.
 * Used by DataBoardClient, WeeklyClient, MonthlyClient for search filtering.
 *
 * @param row - A grouped row from the DATA section
 * @returns Array of 6 string values to match against the search query
 */
export function getDataBoardSearchFields(row: DataBoardGroupedRow): string[] {
  return [
    row.client_id,
    row.client_name,
    row.service_id,
    row.service_name,
    row.widget_id ?? "",
    row.widget_name ?? "",
  ];
}

/**
 * Builds a Map from ClientMeta[] for O(1) lookup by client_id.
 *
 * @param clientMeta - Array of client metadata from the server payload
 * @returns Map keyed by client_id
 */
export function buildClientMetaMap(
  clientMeta: ClientMeta[],
): Map<string, ClientMeta> {
  const map = new Map<string, ClientMeta>();
  for (const m of clientMeta) {
    map.set(m.client_id, m);
  }
  return map;
}

/**
 * Checks whether a row's client passes the tier and owner (manager_id) filters.
 *
 * @param clientId  - The client_id of the row to check
 * @param metaMap   - Pre-built Map<client_id, ClientMeta>
 * @param tier      - Tier filter value from URL params ("" = no filter)
 * @param owner     - Owner filter value from URL params ("" = no filter, string of manager_id)
 * @returns true if the row passes both filters (or filters are empty)
 */
export function passesClientMetaFilter(
  clientId: string,
  metaMap: Map<string, ClientMeta>,
  tier: string,
  owner: string,
): boolean {
  if (!tier && !owner) return true;

  const meta = metaMap.get(clientId);
  if (!meta) return false;

  if (tier && meta.tier !== tier) return false;
  if (owner && String(meta.manager_id) !== owner) return false;

  return true;
}

/** Returns true if cost_spent meets the minimum threshold for the given filter type. */
export function passesSmallAmountFilter(
  costSpent: number,
  filterType: DataFilterType,
  excludeSmall: boolean,
): boolean {
  if (!excludeSmall) return true;
  return costSpent >= SMALL_SLOT_THRESHOLD[filterType];
}

/**
 * Client-level filter: drops entire client (and all child service/widget rows)
 * if it has a blog child service or a client_name containing "SSP".
 *
 * @param clientId    - The client_id of the row to check
 * @param metaMap     - Pre-built Map<client_id, ClientMeta>
 * @param excludeBlog - "blog 제외" checkbox state
 * @param excludeSsp  - "ssp 제외" checkbox state
 * @returns true if the row should be shown (passes the filter)
 */
export function passesClientFlagsFilter(
  clientId: string,
  metaMap: Map<string, ClientMeta>,
  excludeBlog: boolean,
  excludeSsp: boolean,
): boolean {
  if (!excludeBlog && !excludeSsp) return true;

  const meta = metaMap.get(clientId);
  if (!meta) return true;

  if (excludeBlog && meta.has_blog_service) return false;
  if (excludeSsp && meta.is_ssp) return false;

  return true;
}
