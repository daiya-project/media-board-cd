/**
 * 매일 자동 동기화 잡의 동기화 범위 계산 (순수 함수).
 *
 * 규칙:
 *  - end = KST 기준 D-1 (nowUtc + 9시간 한 날짜의 전날)
 *  - latestDateInDb >= end → skip
 *  - latestDateInDb null   → start = end (하루치만)
 *  - 그 외                 → start = latestDateInDb + 1일 (gap recovery)
 *  - forceRange 가 있으면 그대로 반환 (검증은 호출자 책임)
 *
 * KST 는 서머타임이 없으므로 UTC+9 단순 오프셋으로 처리.
 */

export interface SyncRange {
  /** YYYY-MM-DD inclusive */
  start: string;
  /** YYYY-MM-DD inclusive */
  end: string;
}

export type SyncDecision =
  | { skip: true; reason: string }
  | { skip: false; range: SyncRange };

/** UTC Date 를 KST 달력상의 YYYY-MM-DD 로 변환. */
function toKstDateString(utc: Date): string {
  const kstMs = utc.getTime() + 9 * 60 * 60 * 1000;
  const d = new Date(kstMs);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** YYYY-MM-DD 에 N일 더해 YYYY-MM-DD 반환. */
function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  const ny = dt.getUTCFullYear();
  const nm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const nd = String(dt.getUTCDate()).padStart(2, "0");
  return `${ny}-${nm}-${nd}`;
}

/**
 * latestDateInDb 와 현재 UTC 시각을 받아 동기화 범위를 결정한다.
 *
 * @param latestDateInDb DB 에 저장된 가장 최신 날짜 (YYYY-MM-DD) 또는 null
 * @param nowUtc 현재 UTC 시각
 * @param forceRange 지정 시 범위 계산을 건너뛰고 그대로 반환 (검증은 호출자 책임)
 */
export function computeSyncRange(
  latestDateInDb: string | null,
  nowUtc: Date,
  forceRange?: SyncRange,
): SyncDecision {
  if (forceRange) {
    return { skip: false, range: forceRange };
  }

  const todayKst = toKstDateString(nowUtc);
  const end = addDays(todayKst, -1);

  if (latestDateInDb && latestDateInDb >= end) {
    return {
      skip: true,
      reason: `already up to date (latest=${latestDateInDb}, target=${end})`,
    };
  }

  const start = latestDateInDb ? addDays(latestDateInDb, 1) : end;
  return { skip: false, range: { start, end } };
}
