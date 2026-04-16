/**
 * Shared row-mapping helpers for Supabase query results.
 *
 * Centralises the `as T ?? fallback` casting pattern used across
 * dataBoardService, boardService, and API routes so that mapping
 * rules are defined once and reused everywhere.
 */

type RawRow = Record<string, unknown>;

/** Maps the 5 common metric columns (cost_spent … cnt_click) with zero defaults. */
export function mapBaseMetrics(row: RawRow) {
  return {
    cost_spent: (row.cost_spent as number) ?? 0,
    ad_revenue: (row.ad_revenue as number) ?? 0,
    imp: (row.imp as number) ?? 0,
    vimp: (row.vimp as number) ?? 0,
    cnt_click: (row.cnt_click as number) ?? 0,
  };
}

/** Maps client_id/name + service_id/name with String coercion and fallback names. */
export function mapClientService(row: RawRow) {
  return {
    client_id: String(row.client_id),
    client_name: (row.client_name as string) ?? `Client ${row.client_id}`,
    service_id: String(row.service_id),
    service_name: (row.service_name as string) ?? `Service ${row.service_id}`,
  };
}

/** Maps optional widget_id/widget_name (nullable). */
export function mapWidget(row: RawRow) {
  return {
    widget_id: (row.widget_id as string | null) ?? null,
    widget_name: (row.widget_name as string | null) ?? null,
  };
}
