import type { UnitPriceValue } from "@/types/external";

const COMPARE_KEYS: (keyof UnitPriceValue)[] = [
  "internal",
  "syncmedia",
  "klmedia",
  "friendplus",
  "fc",
];

/**
 * snapshot 이 latest 와 다르면 true.
 * snapshot 에 undefined 인 필드는 비교 대상에서 제외 (기존 값 유지).
 */
export function unitPriceChanged(
  latest: UnitPriceValue,
  snapshot: UnitPriceValue,
): boolean {
  for (const k of COMPARE_KEYS) {
    if (snapshot[k] === undefined) continue;
    if (latest[k] !== snapshot[k]) return true;
  }
  return false;
}

/** base 위에 snapshot 을 덮어씌운 새 객체 (undefined 는 유지, 실제 값만 덮어씀). */
export function mergeSnapshot(
  base: UnitPriceValue,
  snapshot: UnitPriceValue,
): UnitPriceValue {
  const out: UnitPriceValue = { ...base };
  for (const k of COMPARE_KEYS) {
    if (snapshot[k] !== undefined) {
      out[k] = snapshot[k];
    }
  }
  return out;
}
