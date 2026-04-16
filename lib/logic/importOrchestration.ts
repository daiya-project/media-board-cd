/**
 * Import orchestration — full CSV import workflow.
 *
 * Based on _reference/src/shared/logic/import/orchestration.ts.
 * Key changes from reference:
 *  - validateRow checks client_id (not media_id)
 *  - importBatch targets media.daily with cnt_click / cnt_cv columns
 *  - upsert conflict key: date,client_id,service_id,widget_id
 *  - ImportResult uses dateStart/dateEnd (not lastImportedDate)
 *  - saveFailedRows receives importLogId (FK to media.import_log)
 *  - updateImportLog uses dateStart/dateEnd (not dataDateStart/End)
 */

import { parseCSV, normalizeDate } from "@/lib/utils/csvParser";
import { IMPORT_BATCH_DELAY_MS, IMPORT_BATCH_THRESHOLDS } from "@/lib/config";
import { addDays } from "@/lib/utils/date-utils";
import type {
  ParsedCSVRow,
  ImportResult,
  ImportCSVDataOptions,
} from "@/types/app-db.types";
import {
  getLastImportedDate,
  deleteDataByDateRange,
  fetchRegisteredClientIds,
  saveFailedRows,
  refreshDailyViews,
} from "@/lib/api/importDbOps";
import {
  scanMissingServices,
  scanMissingWidgets,
  registerMissingServices,
  registerMissingWidgets,
} from "@/lib/api/importEntityService";
import { type ValidatedRow, validateRow } from "./importValidation";
import { importBatch } from "@/lib/api/importBatchService";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function calculateBatchSize(totalRows: number): number {
  if (totalRows >= IMPORT_BATCH_THRESHOLDS.LARGE) return IMPORT_BATCH_THRESHOLDS.LARGE_SIZE;
  if (totalRows >= IMPORT_BATCH_THRESHOLDS.MEDIUM) return IMPORT_BATCH_THRESHOLDS.MEDIUM_SIZE;
  return IMPORT_BATCH_THRESHOLDS.DEFAULT_SIZE;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}


// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Full CSV import workflow: parse → validate → widget registration → batch upsert → log.
 *
 * Calls onProgress after each batch to enable real-time UI updates.
 * Respects onCancel() to allow user-initiated cancellation between batches.
 *
 * @param options.csvText       - Raw CSV string from Google Sheets
 * @param options.onProgress    - Callback invoked after each batch
 * @param options.onCancel      - Return true to stop processing
 * @param options.forceDateRange - If set, deletes existing data in range before import
 * @param options.lastDateHint  - Pre-fetched last date (skips a DB query)
 * @returns Final import result summary
 */
export async function importCSVData(
  options: ImportCSVDataOptions
): Promise<ImportResult> {
  const { csvText, onProgress, onCancel, batchSize, forceDateRange, lastDateHint } =
    options;

  const result: ImportResult = {
    success: true,
    totalRows: 0,
    imported: 0,
    failed: 0,
    skipped: 0,
    servicesCreated: 0,
    widgetsCreated: 0,
    dateStart: null,
    dateEnd: null,
    errors: [],
    newServiceLogs: [],
    newWidgetLogs: [],
    failedDetails: [],
  };

  const failedRowsForSave: Array<{
    row: ParsedCSVRow;
    normalizedDate: string;
    errorMessage: string;
  }> = [];

  let dataDateStart: string | null = null;
  let dataDateEnd: string | null = null;

  try {
    const rows = parseCSV(csvText);
    result.totalRows = rows.length;

    const dynamicBatchSize = batchSize ?? calculateBatchSize(rows.length);

    if (rows.length === 0) return result;

    // Determine import range
    let targetStartDate: string | null = null;
    let targetEndDate: string | null = null;

    if (forceDateRange) {
      targetStartDate = forceDateRange.startDate;
      targetEndDate = forceDateRange.endDate;
      const { error: deleteError } = await deleteDataByDateRange(
        targetStartDate,
        targetEndDate
      );
      if (deleteError)
        console.error("강제 업데이트 삭제 오류:", deleteError);
    } else {
      const lastDate =
        lastDateHint !== undefined ? lastDateHint : await getLastImportedDate();
      targetStartDate = lastDate ? addDays(lastDate, 1) : null;
    }

    let isCancelled = false;
    const validatedRows: ValidatedRow[] = [];

    // Iterate in reverse so we can break early on old data (newest-first CSV)
    for (let i = rows.length - 1; i >= 0; i--) {
      if (onCancel?.()) {
        isCancelled = true;
        break;
      }

      const row = rows[i];
      const validation = validateRow(row, i);

      if (!validation.valid) {
        if (validation.skip) {
          result.skipped++;
        } else {
          result.failed++;
          result.errors.push({ row: i + 1, message: validation.errorMessage });
        }
        continue;
      }

      const nd = normalizeDate(row.date!);
      if (!nd) {
        result.failed++;
        continue;
      }

      if (forceDateRange) {
        if (nd < targetStartDate! || nd > targetEndDate!) continue;
      } else {
        if (targetStartDate && nd < targetStartDate) break;
      }

      validatedRows.push({ row, index: i, normalizedDate: nd });
      if (!dataDateStart || nd < dataDateStart) dataDateStart = nd;
      if (!dataDateEnd || nd > dataDateEnd) dataDateEnd = nd;
    }

    // Early exit if cancelled during validation
    if (isCancelled) {
      result.cancelled = true;
      result.dateStart = dataDateStart;
      result.dateEnd = dataDateEnd;
      return result;
    }

    // Deduplicate by PK — prevents "ON CONFLICT DO UPDATE command cannot affect row a second time"
    // when the CSV contains duplicate (date, client_id, service_id, widget_id) combos.
    const pkSeen = new Set<string>();
    const uniqueRows: ValidatedRow[] = [];
    for (const vr of validatedRows) {
      const pk = `${vr.normalizedDate}|${vr.row.client_id}|${vr.row.service_id}|${vr.row.widget_id}`;
      if (!pkSeen.has(pk)) {
        pkSeen.add(pk);
        uniqueRows.push(vr);
      }
    }
    const finalRows = uniqueRows;

    // Phase 1: parallel scan — client whitelist + missing service/widget IDs
    // All three are read-only DB queries, safe to run concurrently.
    let acceptedRows: ValidatedRow[] = [];
    let clientNameMap = new Map<string, string>();
    if (finalRows.length > 0) {
      const uniqueClientIds = [...new Set(finalRows.map((r) => r.row.client_id!))];
      const scanRows = finalRows.map(({ row, normalizedDate }) => ({ row, normalizedDate }));

      const [{ validClientIds, clientNameMap: nameMap }, serviceScan, widgetScan] =
        await Promise.all([
          fetchRegisteredClientIds(uniqueClientIds),
          scanMissingServices(scanRows),
          scanMissingWidgets(scanRows),
        ]);
      clientNameMap = nameMap;

      // Phase 2: filter rows by registered client_id
      const filtered: ValidatedRow[] = [];
      for (const vr of finalRows) {
        const cid = vr.row.client_id!;
        if (!validClientIds.has(cid)) {
          result.failed++;
          const errorMsg = `미등록 client_id: ${cid}`;
          failedRowsForSave.push({
            row: vr.row,
            normalizedDate: vr.normalizedDate,
            errorMessage: errorMsg,
          });
          result.failedDetails.push({
            date: vr.normalizedDate,
            client_id: cid,
            client_name: null,
            service_id: vr.row.service_id,
            service_name: vr.row.service_name ?? null,
            widget_id: vr.row.widget_id ?? null,
            widget_name: vr.row.widget_name ?? null,
            reason: errorMsg,
          });
        } else {
          filtered.push(vr);
        }
      }
      acceptedRows = filtered;

      // Phase 3: register — narrow scan results to accepted rows only (avoids FK violations)
      // service first (widget FK → service)
      if (acceptedRows.length > 0) {
        const acceptedServiceIds = new Set(
          acceptedRows.map((r) => r.row.service_id!).filter(Boolean)
        );
        const missingServiceIds = serviceScan.missingIds.filter((id) =>
          acceptedServiceIds.has(id)
        );
        const serviceResult = await registerMissingServices(
          serviceScan.serviceInfoMap,
          missingServiceIds,
          clientNameMap
        );
        result.servicesCreated = serviceResult.created;
        result.newServiceLogs = serviceResult.newRows;
        serviceResult.errors.forEach((err) => result.errors.push({ row: 0, message: err }));

        const acceptedWidgetIds = new Set(
          acceptedRows
            .map((r) => r.row.widget_id)
            .filter((id): id is string => Boolean(id))
        );
        const missingWidgetIds = widgetScan.missingIds.filter((id) =>
          acceptedWidgetIds.has(id)
        );
        const widgetResult = await registerMissingWidgets(
          widgetScan.widgetInfoMap,
          missingWidgetIds,
          clientNameMap
        );
        result.widgetsCreated = widgetResult.created;
        result.newWidgetLogs = widgetResult.newRows;
        widgetResult.errors.forEach((err) => result.errors.push({ row: 0, message: err }));
      }
    }

    // Batch upsert
    for (let i = 0; i < acceptedRows.length; i += dynamicBatchSize) {
      if (onCancel?.()) {
        isCancelled = true;
        break;
      }

      const batch = acceptedRows.slice(i, i + dynamicBatchSize);
      const batchResult = await importBatch(batch);

      result.imported += batchResult.success;
      result.failed += batchResult.failed;

      for (const err of batchResult.errors) {
        const vr = batch[err.index];
        if (!vr) {
          result.errors.push({ row: i + err.index + 1, message: err.message });
          continue;
        }
        result.errors.push({ row: vr.index + 1, message: err.message });
        if (vr.row.widget_id) {
          failedRowsForSave.push({
            row: vr.row,
            normalizedDate: vr.normalizedDate,
            errorMessage: err.message,
          });
          result.failedDetails.push({
            date: vr.normalizedDate,
            client_id: vr.row.client_id,
            client_name: vr.row.client_id ? (clientNameMap.get(vr.row.client_id) ?? null) : null,
            service_id: vr.row.service_id,
            service_name: vr.row.service_name ?? null,
            widget_id: vr.row.widget_id,
            widget_name: vr.row.widget_name ?? null,
            reason: err.message,
          });
        }
      }

      onProgress?.({
        total: acceptedRows.length,
        processed: Math.min(i + dynamicBatchSize, acceptedRows.length),
        success: result.imported,
        failed: result.failed,
        skipped: result.skipped,
        servicesCreated: result.servicesCreated,
        widgetsCreated: result.widgetsCreated,
        currentDate: batch[batch.length - 1]?.normalizedDate ?? null,
      });

      if (i + dynamicBatchSize < acceptedRows.length)
        await delay(IMPORT_BATCH_DELAY_MS);
    }

    if (failedRowsForSave.length > 0)
      await saveFailedRows(failedRowsForSave);

    if (isCancelled) result.cancelled = true;

    // Refresh materialized views so the dashboard reflects newly imported data.
    // Run after save; a failure here is non-fatal (stale views until next import).
    // 30s timeout prevents the progress screen from hanging if the RPC is slow.
    if (!isCancelled && result.imported > 0) {
      await Promise.race([
        refreshDailyViews(),
        new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error("refresh_daily_views timeout")), 30_000)
        ),
      ]).catch((err) => {
        console.warn("[import] refresh_daily_views failed (non-fatal):", err);
      });
    }

    result.dateStart = dataDateStart;
    result.dateEnd = dataDateEnd;
    return result;
  } catch (err) {
    result.success = false;
    const errorMessage =
      err instanceof Error ? err.message : String(err);
    result.errors.push({ row: 0, message: `전체 import 오류: ${errorMessage}` });
    result.dateStart = dataDateStart;
    result.dateEnd = dataDateEnd;
    return result;
  }
}
