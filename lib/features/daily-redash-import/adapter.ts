/**
 * Redash row (쿼리 11939 결과) → ParsedCSVRow 어댑터.
 *
 * Redash 쿼리의 SELECT alias 가 그대로 row key 가 된다:
 *   date, client_id, client_name, service_id, service_name,
 *   widget_id, widget_name, cost_spent, pub_profit, imp, vimp,
 *   click, service_cv
 *
 * client_name 은 무시 (현재 import 파이프라인에서 사용 안 함).
 * click → cnt_click, service_cv → cnt_cv 로 컬럼명 매핑.
 *
 * 숫자는 BIGINT (number) 또는 string 으로 들어올 수 있음 → number 로 정규화.
 */

import type { ParsedCSVRow } from "@/types/app-db.types";

export type RedashRow = Record<string, unknown>;

function toNumber(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return Number.isFinite(v) ? Math.round(v) : 0;
  if (typeof v === "string") {
    const cleaned = v.replace(/,/g, "").trim();
    const n = Number(cleaned);
    return Number.isFinite(n) ? Math.round(n) : 0;
  }
  return 0;
}

function toStringOrNull(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length > 0 ? s : null;
}

export function redashRowToParsedCSVRow(row: RedashRow): ParsedCSVRow {
  return {
    date: toStringOrNull(row.date),
    client_id: toStringOrNull(row.client_id),
    service_id: toStringOrNull(row.service_id),
    service_name: toStringOrNull(row.service_name),
    widget_id: toStringOrNull(row.widget_id),
    widget_name: toStringOrNull(row.widget_name),
    cost_spent: toNumber(row.cost_spent),
    pub_profit: toNumber(row.pub_profit),
    imp: toNumber(row.imp),
    vimp: toNumber(row.vimp),
    cnt_click: toNumber(row.click),
    cnt_cv: toNumber(row.service_cv),
  };
}
