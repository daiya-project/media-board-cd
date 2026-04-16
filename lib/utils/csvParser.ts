/**
 * CSV parsing utilities for Google Sheets daily data import.
 *
 * Based on _reference/src/shared/lib/utils/csvParser.ts.
 * Key changes from reference:
 *  - `click` → `cnt_click` (matches media.daily.cnt_click)
 *  - `service_cv` → `cnt_cv` (matches media.daily.cnt_cv)
 *  - `media_id` removed; `client_id` parsed as string (DB type: TEXT)
 *  - `service_id` parsed as string (DB type: TEXT)
 */

import type { ParsedCSVRow } from "@/types/app-db.types";

/**
 * Parses raw CSV text into structured rows.
 * Supports English and Korean column headers with case-insensitive matching.
 * Rows missing all identity fields (date, client_id, service_id) are dropped.
 *
 * @param csvText - Raw CSV string from Google Sheets export
 * @returns Array of parsed rows
 */
export function parseCSV(csvText: string): ParsedCSVRow[] {
  const lines = csvText.split("\n").filter((line) => line.trim().length > 0);

  if (lines.length === 0) return [];

  const headers = parseCSVLine(lines[0]);
  const rows: ParsedCSVRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row: Partial<ParsedCSVRow> = {};

    headers.forEach((header, index) => {
      const value = values[index] ?? "";
      const normalized = header.trim().toLowerCase().replace(/\s+/g, "_");

      switch (normalized) {
        case "date":
        case "날짜":
          row.date = parseString(value);
          break;
        case "client_id":
        case "media_id":
        case "매체_id":
          // Always string per project ID rule. DB column type is TEXT.
          row.client_id = parseString(value);
          break;
        case "service_id":
        case "서비스_id":
          // Always string per project ID rule. DB column type is TEXT.
          row.service_id = parseString(value);
          break;
        case "service_name":
        case "서비스명":
        case "서비스_이름":
          row.service_name = parseString(value);
          break;
        case "widget_id":
        case "위젯_id":
          row.widget_id = parseString(value);
          break;
        case "widget_name":
        case "위젯_이름":
        case "위젯명":
          row.widget_name = parseString(value);
          break;
        case "cost_spent":
        case "광고비용":
        case "cost":
          row.cost_spent = parseNumber(value) ?? 0;
          break;
        case "pub_profit":
        case "퍼블리셔수익":
        case "profit":
        case "revenue":
          row.pub_profit = parseNumber(value) ?? 0;
          break;
        case "imp":
        case "노출":
        case "impression":
          row.imp = parseNumber(value) ?? 0;
          break;
        case "vimp":
        case "조회가능노출":
        case "viewable_impression":
          row.vimp = parseNumber(value) ?? 0;
          break;
        case "click":
        case "cnt_click":
        case "클릭":
          // Reference: 'click' → maps to media.daily.cnt_click
          row.cnt_click = parseNumber(value) ?? 0;
          break;
        case "service_cv":
        case "servce_cv": // legacy typo from reference
        case "cnt_cv":
        case "전환":
        case "cv":
        case "conversion":
          // Reference: 'service_cv' → maps to media.daily.cnt_cv
          row.cnt_cv = parseNumber(value) ?? 0;
          break;
      }
    });

    // Keep only rows that have at least one identity field
    const hasIdentity =
      row.date || row.client_id != null || row.service_id != null;

    if (hasIdentity) {
      rows.push({
        date: row.date ?? null,
        client_id: row.client_id ?? null,
        service_id: row.service_id ?? null,
        service_name: row.service_name ?? null,
        widget_id: row.widget_id ?? null,
        widget_name: row.widget_name ?? null,
        cost_spent: row.cost_spent ?? 0,
        pub_profit: row.pub_profit ?? 0,
        imp: row.imp ?? 0,
        vimp: row.vimp ?? 0,
        cnt_click: row.cnt_click ?? 0,
        cnt_cv: row.cnt_cv ?? 0,
      });
    }
  }

  return rows;
}

/**
 * Normalizes various date string formats to YYYY-MM-DD.
 * Supports: YYYY-MM-DD, YYYY/MM/DD, YYYY.MM.DD, and Date-parseable strings.
 *
 * @param dateStr - Raw date string from CSV
 * @returns Normalized YYYY-MM-DD string, or null if parsing fails
 */
export function normalizeDate(dateStr: string | null): string | null {
  if (!dateStr) return null;

  const cleaned = dateStr.trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return cleaned;

  if (/^\d{4}\/\d{2}\/\d{2}$/.test(cleaned))
    return cleaned.replace(/\//g, "-");

  if (/^\d{4}\.\d{2}\.\d{2}$/.test(cleaned))
    return cleaned.replace(/\./g, "-");

  const date = new Date(cleaned);
  if (!isNaN(date.getTime())) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Parses a single CSV line, handling quoted fields and escaped quotes. */
function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values;
}

/** Parses a numeric string (integer or decimal) to number. Removes commas. */
function parseNumber(value: string): number | null {
  if (!value || value.trim() === "") return null;

  const cleaned = value.replace(/,/g, "").trim();

  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;

  const parsed = parseFloat(cleaned);
  if (isNaN(parsed) || !isFinite(parsed)) return null;

  return Math.round(parsed);
}

/** Trims whitespace from a string; returns null for empty strings. */
function parseString(value: string): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
