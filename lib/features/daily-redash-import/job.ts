/**
 * Daily Redash import 잡 오케스트레이션.
 *
 * 호출자:
 *  - cron.ts (자동, 매일 06:00 KST)
 *  - app/api/import/redash/route.ts (모달, 보정용)
 *
 * 흐름:
 *   1. cookie-free supabase 클라이언트 생성
 *   2. (incremental) latest date 조회 → date-range 결정 (gap recovery)
 *      (force) 호출자가 준 range 그대로
 *   3. media.client 에서 client_id 화이트리스트 동적 조회
 *   4. Redash POST + Polling
 *   5. adapter 로 ParsedCSVRow[] 변환
 *   6. importParsedRows() 호출 (검증 / dedup / entity 등록 / 배치 upsert / view refresh)
 */

import { createCronSupabase } from "@/lib/supabase/cron-client";
import {
  getLastImportedDate,
  fetchAllClientIds,
} from "@/lib/api/importDbOps";
import { importParsedRows } from "@/lib/logic/importOrchestration";
import { computeSyncRange, type SyncRange } from "./date-range";
import { fetchRedashRecords } from "./redash-fetch";
import { redashRowToParsedCSVRow } from "./adapter";
import type { ImportProgress } from "@/types/app-db.types";

export type ImportMode = "incremental" | "force";

export interface RunImportOptions {
  mode: ImportMode;
  /** mode === 'force' 일 때 필수. inclusive YYYY-MM-DD. */
  range?: SyncRange;
  /** 모달의 progress UI 용. cron 은 생략. */
  onProgress?: (p: ImportProgress) => void;
  /** cancel 폴링. cron 은 생략. */
  onCancel?: () => boolean;
}

export interface JobResult {
  skipped: boolean;
  reason?: string;
  range?: SyncRange;
  redashRows?: number;
  importedRows?: number;
  failedRows?: number;
  servicesCreated?: number;
  widgetsCreated?: number;
  durationMs: number;
}

export async function runDailyImportJob(opts: RunImportOptions): Promise<JobResult> {
  const t0 = Date.now();
  const supabase = createCronSupabase();

  // 1. 범위 결정
  const latestDate =
    opts.mode === "incremental" ? await getLastImportedDate(supabase) : null;
  const decision = computeSyncRange(latestDate, new Date(), opts.range);
  if (decision.skip) {
    return {
      skipped: true,
      reason: decision.reason,
      durationMs: Date.now() - t0,
    };
  }

  const { start, end } = decision.range;

  // 2. client_id 화이트리스트
  const clientIds = await fetchAllClientIds(supabase);
  if (clientIds.length === 0) {
    return {
      skipped: true,
      reason: "media.client 에 등록된 client 가 없습니다",
      range: decision.range,
      durationMs: Date.now() - t0,
    };
  }

  // 3. Redash fetch
  const redashRows = await fetchRedashRecords({
    startDate: start,
    endDate: end,
    clientIds,
  });

  if (redashRows.length === 0) {
    return {
      skipped: false,
      range: decision.range,
      redashRows: 0,
      importedRows: 0,
      failedRows: 0,
      servicesCreated: 0,
      widgetsCreated: 0,
      durationMs: Date.now() - t0,
    };
  }

  // 4. Adapter
  const parsedRows = redashRows.map(redashRowToParsedCSVRow);

  // 5. Import
  const result = await importParsedRows({
    rows: parsedRows,
    supabase,
    forceDateRange:
      opts.mode === "force"
        ? { startDate: start, endDate: end }
        : null,
    lastDateHint: latestDate,
    onProgress: opts.onProgress,
    onCancel: opts.onCancel,
  });

  return {
    skipped: false,
    range: decision.range,
    redashRows: redashRows.length,
    importedRows: result.imported,
    failedRows: result.failed,
    servicesCreated: result.servicesCreated,
    widgetsCreated: result.widgetsCreated,
    durationMs: Date.now() - t0,
  };
}
