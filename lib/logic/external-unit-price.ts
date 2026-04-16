/**
 * Shared helpers for resolving external_value unit prices by widget/date.
 */

import type { ExternalValueRow, UnitPriceValue } from "@/types/external";

/**
 * Finds the UnitPriceValue applicable for a given date.
 * `prices` must be pre-sorted by start_date ascending.
 * Returns an empty object if no period covers the date.
 */
export function findUnitPriceForDate(
  prices: ExternalValueRow[],
  date: string,
): UnitPriceValue {
  for (let i = prices.length - 1; i >= 0; i--) {
    const p = prices[i];
    if (date >= p.start_date && (!p.end_date || date <= p.end_date)) {
      return p.value;
    }
  }
  return {};
}
