/**
 * Passback vendor_id ↔ slug 매핑 — 서버·클라이언트 공용.
 *
 * DW `ad_stats.DAILY_PASSBACK_STATS.vendor_id` 는 DB의 벤더 마스터 값이다.
 * `media.external_value.value` JSONB 키(syncmedia/klmedia/friendplus)와 매핑한다.
 *
 * 벤더 추가 시 PASSBACK_VENDORS 에 entry 만 추가하면 전 layer 반영된다.
 */

import type { PassbackVendorSlug } from "@/types/fc";

export interface PassbackVendorEntry {
  vendor_id: number;
  slug: PassbackVendorSlug;
  label: string;
}

export const PASSBACK_VENDORS: readonly PassbackVendorEntry[] = [
  { vendor_id: 2, slug: "syncmedia",  label: "Sync Media" },
  { vendor_id: 4, slug: "klmedia",    label: "KL Media" },
  { vendor_id: 5, slug: "friendplus", label: "친구플러스" },
];

/** vendor_id → slug. 허용 범위 밖이면 null. */
export function vendorIdToSlug(vendorId: number): PassbackVendorSlug | null {
  const entry = PASSBACK_VENDORS.find((v) => v.vendor_id === vendorId);
  return entry ? entry.slug : null;
}

/** FC 리포트에 포함될 vendor 인지 판정. */
export function isAllowedVendorId(vendorId: number): boolean {
  return PASSBACK_VENDORS.some((v) => v.vendor_id === vendorId);
}

/** vendor imp 내림차순 → 허용 벤더 중 최대 imp 의 slug. 동률은 slug 알파벳순. */
export function pickPrimaryVendor(
  rows: Array<{ vendor_id: number; impressions: number }>,
): PassbackVendorSlug | null {
  const allowed = rows.filter((r) => isAllowedVendorId(r.vendor_id));
  if (allowed.length === 0) return null;
  const sorted = [...allowed].sort((a, b) => {
    if (b.impressions !== a.impressions) return b.impressions - a.impressions;
    const slugA = vendorIdToSlug(a.vendor_id)!;
    const slugB = vendorIdToSlug(b.vendor_id)!;
    return slugA.localeCompare(slugB);
  });
  return vendorIdToSlug(sorted[0].vendor_id);
}
