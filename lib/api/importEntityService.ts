/**
 * Import entity scan & registration — service & widget existence check and creation.
 *
 * Split into two phases per entity:
 *  - scan*   : DB read-only, returns which IDs are missing (safe to run in parallel)
 *  - register*: DB write, inserts only the missing rows (must run sequentially due to FKs)
 *
 * Call order in orchestration:
 *  Promise.all([scanMissingServices, scanMissingWidgets, fetchRegisteredClientIds])
 *    → registerMissingServices
 *    → registerMissingWidgets
 */

import { createMediaClient } from "@/lib/supabase/media-client";
import { WIDGET_BATCH_SIZE } from "@/lib/config";
import type { ParsedCSVRow } from "@/types/app-db.types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Minimal shape required for entity registration. */
export type ValidatedImportRow = {
  row: ParsedCSVRow;
  normalizedDate: string;
};

/** Internal info stored per service_id during scan. */
type ServiceInfo = {
  client_id: string;
  service_name: string;
  date: string | null;
};

/** Internal info stored per widget_id during scan. */
type WidgetInfo = {
  client_id: string;
  service_id: string;
  service_name: string | null;
  widget_name: string | null;
  date: string | null;
};

/** New service log entry produced by registerMissingServices. */
export interface NewServiceLogEntry {
  date: string | null;
  client_id: string;
  client_name: string | null;
  service_id: string;
  service_name: string | null;
}

/** New widget log entry produced by registerMissingWidgets. */
export interface NewWidgetLogEntry {
  date: string | null;
  client_id: string;
  client_name: string | null;
  service_id: string;
  service_name: string | null;
  widget_id: string;
  widget_name: string | null;
}

/** Result of a scan phase. */
export interface ServiceScanResult {
  serviceInfoMap: Map<string, ServiceInfo>;
  missingIds: string[];
}

export interface WidgetScanResult {
  widgetInfoMap: Map<string, WidgetInfo>;
  missingIds: string[];
}

// ---------------------------------------------------------------------------
// Service — scan (read-only, parallel-safe)
// ---------------------------------------------------------------------------

/**
 * Scans which service_ids in the given rows are not yet registered in media.service.
 * Read-only — safe to run concurrently with other scans via Promise.all.
 *
 * @param rows - All validated import rows (pre-client-id filtering is fine here)
 * @returns serviceInfoMap (all unique services seen) + missingIds (not in DB)
 */
export async function scanMissingServices(
  rows: ValidatedImportRow[]
): Promise<ServiceScanResult> {
  const serviceInfoMap = new Map<string, ServiceInfo>();
  for (const { row, normalizedDate } of rows) {
    if (row.service_id && row.client_id && !serviceInfoMap.has(row.service_id)) {
      serviceInfoMap.set(row.service_id, {
        client_id: row.client_id,
        service_name: row.service_name ?? row.service_id,
        date: normalizedDate ?? null,
      });
    }
  }

  if (serviceInfoMap.size === 0) return { serviceInfoMap, missingIds: [] };

  const supabase = createMediaClient();
  const serviceIds = Array.from(serviceInfoMap.keys());

  // Paginate .in() queries to avoid the 1000-row response limit
  const existingIds = new Set<string>();
  for (let i = 0; i < serviceIds.length; i += WIDGET_BATCH_SIZE) {
    const batch = serviceIds.slice(i, i + WIDGET_BATCH_SIZE);
    const { data, error } = await supabase
      .from("service")
      .select("service_id")
      .in("service_id", batch);
    if (error) throw new Error(`서비스 스캔 실패: ${error.message}`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (data ?? []).forEach((s: any) => existingIds.add(s.service_id as string));
  }

  const missingIds = serviceIds.filter((id) => !existingIds.has(id));

  return { serviceInfoMap, missingIds };
}

// ---------------------------------------------------------------------------
// Service — register (write, sequential)
// ---------------------------------------------------------------------------

/**
 * Inserts missing services into media.service.
 * Must be called after scanMissingServices and after client_id filtering narrows missingIds.
 *
 * @param serviceInfoMap - Full map from scanMissingServices
 * @param missingIds     - Filtered list: only IDs whose client_id was accepted
 * @param clientNameMap  - Optional client_id → name for log enrichment
 */
export async function registerMissingServices(
  serviceInfoMap: Map<string, ServiceInfo>,
  missingIds: string[],
  clientNameMap?: Map<string, string>
): Promise<{ created: number; errors: string[]; newRows: NewServiceLogEntry[] }> {
  const result = { created: 0, errors: [] as string[], newRows: [] as NewServiceLogEntry[] };
  if (missingIds.length === 0) return result;

  const supabase = createMediaClient();

  for (let i = 0; i < missingIds.length; i += WIDGET_BATCH_SIZE) {
    const batch = missingIds.slice(i, i + WIDGET_BATCH_SIZE);
    const batchIndex = Math.floor(i / WIDGET_BATCH_SIZE) + 1;

    const insertData = batch
      .map((serviceId) => {
        const info = serviceInfoMap.get(serviceId);
        if (!info) return null;
        return {
          service_id: serviceId,
          client_id: info.client_id,
          service_name: info.service_name,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    const { data: batchData, error: batchError } = await supabase
      .from("service")
      .upsert(insertData, { onConflict: "client_id,service_name", ignoreDuplicates: true })
      .select("service_id");

    if (!batchError) {
      const insertedIds: string[] = (batchData ?? []).map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (s: any) => s.service_id as string
      );
      result.created += insertedIds.length;
      for (const serviceId of insertedIds) {
        const info = serviceInfoMap.get(serviceId);
        if (!info) continue;
        result.newRows.push({
          date: info.date,
          client_id: info.client_id,
          client_name: clientNameMap?.get(info.client_id) ?? null,
          service_id: serviceId,
          service_name: info.service_name,
        });
      }
    } else {
      // Fallback: row-by-row insert
      for (const item of insertData) {
        const { data: rowData, error: rowError } = await supabase
          .from("service")
          .insert(item)
          .select("service_id");

        if (rowError) {
          // 23505 = unique_violation — already exists, skip silently
          if (rowError.code !== "23505") {
            result.errors.push(
              `서비스 배치 ${batchIndex} 등록 실패 (${item.service_id}): ${rowError.message}`
            );
          }
        } else {
          const insertedRowIds: string[] = (rowData ?? []).map(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (s: any) => s.service_id as string
          );
          result.created += insertedRowIds.length;
          for (const serviceId of insertedRowIds) {
            const info = serviceInfoMap.get(serviceId);
            if (!info) continue;
            result.newRows.push({
              date: info.date,
              client_id: info.client_id,
              client_name: clientNameMap?.get(info.client_id) ?? null,
              service_id: serviceId,
              service_name: info.service_name,
            });
          }
        }
      }
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Widget — scan (read-only, parallel-safe)
// ---------------------------------------------------------------------------

/**
 * Scans which widget_ids in the given rows are not yet registered in media.widget.
 * Read-only — safe to run concurrently with other scans via Promise.all.
 *
 * @param rows - All validated import rows (pre-client-id filtering is fine here)
 * @returns widgetInfoMap (all unique widgets seen) + missingIds (not in DB)
 */
export async function scanMissingWidgets(
  rows: ValidatedImportRow[]
): Promise<WidgetScanResult> {
  const widgetInfoMap = new Map<string, WidgetInfo>();
  for (const { row, normalizedDate } of rows) {
    if (row.widget_id && row.client_id && row.service_id && !widgetInfoMap.has(row.widget_id)) {
      widgetInfoMap.set(row.widget_id, {
        client_id: row.client_id,
        service_id: row.service_id,
        service_name: row.service_name ?? null,
        widget_name: row.widget_name ?? null,
        date: normalizedDate ?? null,
      });
    }
  }

  if (widgetInfoMap.size === 0) return { widgetInfoMap, missingIds: [] };

  const supabase = createMediaClient();
  const widgetIds = Array.from(widgetInfoMap.keys());

  // Paginate .in() queries to avoid the 1000-row response limit
  const existingIds = new Set<string>();
  for (let i = 0; i < widgetIds.length; i += WIDGET_BATCH_SIZE) {
    const batch = widgetIds.slice(i, i + WIDGET_BATCH_SIZE);
    const { data, error } = await supabase
      .from("widget")
      .select("widget_id")
      .in("widget_id", batch);
    if (error) throw new Error(`위젯 스캔 실패: ${error.message}`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (data ?? []).forEach((w: any) => existingIds.add(w.widget_id as string));
  }

  const missingIds = widgetIds.filter((id) => !existingIds.has(id));

  return { widgetInfoMap, missingIds };
}

// ---------------------------------------------------------------------------
// Widget — register (write, sequential — must follow registerMissingServices)
// ---------------------------------------------------------------------------

/**
 * Inserts missing widgets into media.widget and creates a default contract row per widget.
 * Must be called after registerMissingServices (widget FK → service).
 * Must be called after client_id filtering narrows missingIds.
 *
 * @param widgetInfoMap - Full map from scanMissingWidgets
 * @param missingIds    - Filtered list: only IDs whose client_id was accepted
 * @param clientNameMap - Optional client_id → name for log enrichment
 */
export async function registerMissingWidgets(
  widgetInfoMap: Map<string, WidgetInfo>,
  missingIds: string[],
  clientNameMap?: Map<string, string>
): Promise<{ created: number; errors: string[]; newRows: NewWidgetLogEntry[] }> {
  const result = { created: 0, errors: [] as string[], newRows: [] as NewWidgetLogEntry[] };
  if (missingIds.length === 0) return result;

  const supabase = createMediaClient();

  for (let i = 0; i < missingIds.length; i += WIDGET_BATCH_SIZE) {
    const batch = missingIds.slice(i, i + WIDGET_BATCH_SIZE);
    const batchIndex = Math.floor(i / WIDGET_BATCH_SIZE) + 1;

    const widgetInsertData = batch
      .map((widgetId) => {
        const info = widgetInfoMap.get(widgetId);
        if (!info) return null;
        return {
          widget_id: widgetId,
          client_id: info.client_id,
          service_id: info.service_id,
          widget_name: info.widget_name,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    try {
      const { data: insertedWidgets, error: widgetError } = await supabase
        .from("widget")
        .upsert(widgetInsertData, { onConflict: "widget_id", ignoreDuplicates: true })
        .select("widget_id");

      if (widgetError) {
        result.errors.push(`위젯 배치 ${batchIndex} 오류: ${widgetError.message}`);
      } else {
        const insertedIds: string[] = (insertedWidgets ?? []).map(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (w: any) => w.widget_id as string
        );
        result.created += insertedIds.length;
        for (const widgetId of insertedIds) {
          const info = widgetInfoMap.get(widgetId);
          if (!info) continue;
          result.newRows.push({
            date: info.date,
            client_id: info.client_id,
            client_name: clientNameMap?.get(info.client_id) ?? null,
            service_id: info.service_id,
            service_name: info.service_name,
            widget_id: widgetId,
            widget_name: info.widget_name,
          });
        }
      }

      // Create a default contract row for each new widget.
      // media.widget_contract PK = id SERIAL → plain insert (no onConflict).
      const contractInsertData = batch.map((widgetId) => ({
        widget_id: widgetId,
        contract_type: null,
        contract_value: null,
        date_start: null,
        date_end: null,
      }));

      const { error: contractError } = await supabase
        .from("widget_contract")
        .insert(contractInsertData);

      if (contractError) {
        console.warn(`위젯 계약 등록 실패 (배치 ${batchIndex}):`, contractError.message);
      }
    } catch (err) {
      result.errors.push(
        `위젯 배치 ${batchIndex} 처리 오류: ${(err as Error).message}`
      );
    }
  }

  return result;
}
