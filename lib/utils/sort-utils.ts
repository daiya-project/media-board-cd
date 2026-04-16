/**
 * Shared sort utilities used by MGMT table and DATA table.
 *
 * Provides common types (SortDirection, SortState) and helper functions
 * (cycleSortDirection, compareNullable) to eliminate sort-logic duplication.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SortDirection = "asc" | "desc" | "none";

export interface SortState<T extends string> {
  field: T | null;
  direction: SortDirection;
}

// ---------------------------------------------------------------------------
// cycleSortDirection
// ---------------------------------------------------------------------------

/**
 * Cycles sort direction for a column header click.
 *
 * New field   → asc
 * Same field  → asc → desc → none (reset)
 *
 * @param prev  - Current sort state
 * @param field - The field being toggled
 * @returns Next sort state
 */
export function cycleSortDirection<T extends string>(
  prev: SortState<T>,
  field: T,
): SortState<T> {
  if (prev.field !== field) return { field, direction: "asc" };
  if (prev.direction === "asc") return { field, direction: "desc" };
  return { field: null, direction: "none" };
}

// ---------------------------------------------------------------------------
// compareNullable
// ---------------------------------------------------------------------------

/**
 * Null-last comparator for pre-computed sort keys.
 *
 * Empty strings and -Infinity are treated as null/missing and always
 * sort last regardless of sort direction.
 *
 * @param va         - Sort key for row A
 * @param vb         - Sort key for row B
 * @param multiplier - 1 for asc, -1 for desc
 * @param localeOptions - Optional locale/numeric settings for string comparison
 * @returns Comparison result (-1, 0, or 1 range)
 */
export function compareNullable(
  va: string | number,
  vb: string | number,
  multiplier: 1 | -1,
  localeOptions?: { locale?: string; numeric?: boolean },
): number {
  const nullA = va === "" || va === -Infinity;
  const nullB = vb === "" || vb === -Infinity;
  if (nullA && nullB) return 0;
  if (nullA) return 1;
  if (nullB) return -1;

  if (typeof va === "number" && typeof vb === "number") {
    return (va - vb) * multiplier;
  }

  const locale = localeOptions?.locale;
  const opts = localeOptions?.numeric ? { numeric: true as const } : undefined;
  return String(va).localeCompare(String(vb), locale, opts) * multiplier;
}
