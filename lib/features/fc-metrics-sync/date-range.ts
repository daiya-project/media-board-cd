/**
 * FC metrics cache gap recovery 범위 계산.
 * daily-redash-import 패턴과 동일.
 */

export interface SyncRange {
  start: string; // YYYY-MM-DD inclusive
  end: string; // YYYY-MM-DD inclusive
}
export type SyncDecision =
  | { skip: true; reason: string }
  | { skip: false; range: SyncRange };

export const MAX_BACKFILL_DAYS = 14;

function toKstDate(utc: Date): string {
  const kstMs = utc.getTime() + 9 * 60 * 60 * 1000;
  return new Date(kstMs).toISOString().slice(0, 10);
}
function addDays(ymd: string, delta: number): string {
  const d = new Date(ymd + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

/**
 * @param latestDate - DB 에 저장된 가장 최근 date (YYYY-MM-DD) 또는 null
 * @param now - 현재 UTC 시각
 * @param override - force 모드용 수동 지정
 */
export function computeFcSyncRange(
  latestDate: string | null,
  now: Date,
  override?: SyncRange,
): SyncDecision {
  if (override) return { skip: false, range: override };

  const today = toKstDate(now);
  const end = addDays(today, -1); // D-1 (어제까지)

  if (!latestDate) {
    return { skip: false, range: { start: end, end } };
  }
  if (latestDate >= end) {
    return { skip: true, reason: "already up to date" };
  }
  // gap recovery, but cap at MAX_BACKFILL_DAYS
  const proposedStart = addDays(latestDate, 1);
  const cap = addDays(end, -(MAX_BACKFILL_DAYS - 1));
  const start = proposedStart < cap ? cap : proposedStart;
  return { skip: false, range: { start, end } };
}
