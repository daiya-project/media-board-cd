/**
 * Shared Supabase pagination utility.
 *
 * Wraps the common offset-based while-loop pattern used across all
 * data-fetching services. Keeps fetching pages of BATCH_SIZE until
 * the server returns fewer rows than requested (= last page).
 */

import { BATCH_SIZE } from "@/lib/config";

/**
 * Paginates a Supabase query and maps each row through the given mapper.
 *
 * @param buildQuery - Receives (offset, batchSize) and returns a Supabase
 *                     query builder with `.range()` already applied.
 * @param mapper     - Converts a raw Supabase row to the target type.
 * @returns All rows across all pages, mapped to type T.
 * @throws Re-throws any Supabase error from individual page fetches.
 */
export async function paginateQuery<T>(
  buildQuery: (
    offset: number,
    batchSize: number,
  ) => PromiseLike<{ data: Record<string, unknown>[] | null; error: unknown }>,
  mapper: (row: Record<string, unknown>) => T,
): Promise<T[]> {
  const results: T[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await buildQuery(offset, BATCH_SIZE);
    if (error) throw error;
    if (!data || data.length === 0) break;

    for (const row of data) {
      results.push(mapper(row));
    }

    if (data.length < BATCH_SIZE) break;
    offset += BATCH_SIZE;
  }

  return results;
}
