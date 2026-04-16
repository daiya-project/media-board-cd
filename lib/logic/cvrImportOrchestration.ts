/**
 * CVR import orchestration — full CSV import workflow for media.cvr.
 *
 * Two modes:
 *  - Normal:       filter rows newer than lastDate → pre-flight conflict check → upsert
 *  - Force update: delete existing date range → filter CSV to that range → upsert
 *
 * Reuses ImportProgress / ImportResult types and ProgressStep / ResultStep UI.
 */

import { parseCvrCSV } from "@/lib/utils/cvrCsvParser";
import { calcLevel } from "@/lib/utils/calculate-utils";
import { fetchCSVFromGoogleSheets } from "@/lib/api/importFetch";
import {
  getLastCvrImportedDate,
  checkExistingCvrDates,
  deleteCvrByDateRange,
  upsertCvrRows,
  buildCvrDbRow,
} from "@/lib/api/cvrImportDbOps";
import { IMPORT_CVR_CSV_URL } from "@/lib/config";
import { getLastDayOfMonth } from "@/lib/utils/date-utils";
import type { ImportProgress, ImportResult } from "@/types/app-db.types";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface ImportCvrOptions {
  /** Pre-fetched last imported date (skips a DB query when provided). */
  lastDateHint?: string | null;
  /** Progress callback invoked after each batch. */
  onProgress?: (progress: ImportProgress) => void;
  /** Return true to stop processing between batches. */
  onCancel?: () => boolean;
  /**
   * Force-update: delete existing rows in the month range then re-import.
   * If null/undefined → normal mode (only import rows newer than lastDate).
   */
  forceDateRange?: { startMonth: string; endMonth: string } | null;
}

/**
 * Full CVR import workflow:
 *
 * Normal mode:
 *   1. Fetch + parse CSV
 *   2. Filter: date > lastDate
 *   3. Pre-flight conflict check → fail entire import if conflicts detected
 *   4. Compute level, upsert
 *
 * Force update mode:
 *   1. Fetch + parse CSV
 *   2. Delete rows in [startMonth-01, lastDayOfEndMonth]
 *   3. Filter CSV to that date range, compute level, upsert
 */
export async function importCvrData(
  options: ImportCvrOptions = {}
): Promise<ImportResult> {
  const { lastDateHint, onProgress, onCancel, forceDateRange } = options;

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

  try {
    if (!IMPORT_CVR_CSV_URL) {
      throw new Error(
        "CSV URL이 설정되지 않았습니다. NEXT_PUBLIC_IMPORT_CVR_CSV_URL 환경 변수를 확인하세요."
      );
    }

    // 1. Fetch + parse
    const csvText = await fetchCSVFromGoogleSheets(IMPORT_CVR_CSV_URL);
    const parsedRows = parseCvrCSV(csvText);
    result.totalRows = parsedRows.length;

    if (parsedRows.length === 0) return result;

    let dateStart: string | null = null;
    let dateEnd: string | null = null;
    let dbRows;

    // -----------------------------------------------------------------------
    // Force update mode
    // -----------------------------------------------------------------------
    if (forceDateRange) {
      const forceStart = forceDateRange.startMonth + "-01";
      const forceEnd = getLastDayOfMonth(forceDateRange.endMonth);

      // Delete existing data in the range
      const { error: deleteError } = await deleteCvrByDateRange(
        forceStart,
        forceEnd
      );
      if (deleteError) {
        throw new Error(`기존 데이터 삭제 오류: ${deleteError.message}`);
      }

      // Filter CSV to force range and compute level
      dbRows = parsedRows
        .filter((row) => {
          if (row.date < forceStart || row.date > forceEnd) {
            result.skipped++;
            return false;
          }
          return true;
        })
        .map((parsed) => {
          const level = calcLevel(
            parsed.contribution_margin_rate_pct,
            parsed.normalized_cvr_pct
          );
          if (!dateStart || parsed.date < dateStart) dateStart = parsed.date;
          if (!dateEnd || parsed.date > dateEnd) dateEnd = parsed.date;
          return buildCvrDbRow(parsed, level);
        });

    // -----------------------------------------------------------------------
    // Normal mode
    // -----------------------------------------------------------------------
    } else {
      const lastDate =
        lastDateHint !== undefined
          ? lastDateHint
          : await getLastCvrImportedDate();

      // Filter rows: only keep dates newer than lastDate
      const filteredRows = parsedRows.filter((row) => {
        if (lastDate && row.date <= lastDate) {
          result.skipped++;
          return false;
        }
        return true;
      });

      if (filteredRows.length === 0) {
        return result; // nothing new to import
      }

      // Pre-flight conflict check: fail entire import if any date already exists
      const uniqueDates = [...new Set(filteredRows.map((r) => r.date))];
      const conflictingDates = await checkExistingCvrDates(uniqueDates);

      if (conflictingDates.length > 0) {
        const sample = conflictingDates.slice(0, 3).join(", ");
        const suffix = conflictingDates.length > 3 ? " 외 " + (conflictingDates.length - 3) + "건" : "";
        result.success = false;
        result.errors.push({
          row: 0,
          message: `이미 업로드된 데이터가 있습니다 (${sample}${suffix}). 강제 업데이트를 사용해주세요.`,
        });
        return result;
      }

      // Compute level
      dbRows = filteredRows.map((parsed) => {
        const level = calcLevel(
          parsed.contribution_margin_rate_pct,
          parsed.normalized_cvr_pct
        );
        if (!dateStart || parsed.date < dateStart) dateStart = parsed.date;
        if (!dateEnd || parsed.date > dateEnd) dateEnd = parsed.date;
        return buildCvrDbRow(parsed, level);
      });
    }

    result.dateStart = dateStart;
    result.dateEnd = dateEnd;

    if (dbRows.length === 0) return result;

    // Upsert with progress reporting
    const upsertResult = await upsertCvrRows(
      dbRows,
      (processed) => {
        onProgress?.({
          total: dbRows.length,
          processed,
          success: processed - result.failed,
          failed: result.failed,
          skipped: result.skipped,
          servicesCreated: 0,
          widgetsCreated: 0,
          currentDate: null,
        });
      },
      onCancel
    );

    result.imported = upsertResult.success;
    result.failed += upsertResult.failed;
    result.errors.push(...upsertResult.errors);

    if (onCancel?.()) {
      result.cancelled = true;
    }

    // Final progress update
    onProgress?.({
      total: dbRows.length,
      processed: dbRows.length,
      success: result.imported,
      failed: result.failed,
      skipped: result.skipped,
      servicesCreated: 0,
      widgetsCreated: 0,
      currentDate: null,
    });

    return result;
  } catch (err) {
    result.success = false;
    const message = err instanceof Error ? err.message : String(err);
    result.errors.push({ row: 0, message: `CVR import 오류: ${message}` });
    return result;
  }
}
