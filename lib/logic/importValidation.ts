/**
 * Import row validation — CSV row validation for the import workflow.
 *
 * Pure validation logic with no DB dependency.
 */

import { normalizeDate } from "@/lib/utils/csvParser";
import type { ParsedCSVRow } from "@/types/app-db.types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ValidatedRow = {
  row: ParsedCSVRow;
  index: number;
  normalizedDate: string;
};

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validates a single parsed CSV row.
 * Returns skip=true (not failed) when widget_id is missing, since
 * media.daily.widget_id is part of the PK and must not be NULL.
 */
export function validateRow(
  row: ParsedCSVRow,
  _rowIndex: number
): {
  valid: boolean;
  skip: boolean;
  errorMessage: string;
} {
  if (!row.date) {
    return { valid: false, skip: false, errorMessage: "필수값 누락: date" };
  }
  if (!normalizeDate(row.date)) {
    return { valid: false, skip: false, errorMessage: "날짜 형식 오류" };
  }
  // client_id / service_id are string per project ID rule
  if (!row.client_id || row.client_id.trim() === "") {
    return {
      valid: false,
      skip: false,
      errorMessage: "필수값 누락: client_id (또는 media_id)",
    };
  }
  if (!row.service_id || row.service_id.trim() === "") {
    return { valid: false, skip: false, errorMessage: "필수값 누락: service_id" };
  }
  if (!row.widget_id || row.widget_id.trim() === "") {
    // widget_id is part of PK — rows without it are skipped, not failed
    return { valid: false, skip: true, errorMessage: "widget_id 없음 (스킵)" };
  }
  return { valid: true, skip: false, errorMessage: "" };
}
