/**
 * Shared hook for Phase 3 background data replacement via React Query.
 *
 * Wraps the common pattern of providing Phase 2 `initialData` that is
 * immediately marked stale (`initialDataUpdatedAt: 0`) so React Query
 * fetches the full dataset in the background.
 *
 * Used by: DataBoardClient, WeeklyClient, MonthlyClient,
 *          MaChartSection, DataChartSection.
 */

import { useQuery } from "@tanstack/react-query";

interface UsePhase3DataOptions<T> {
  /** React Query cache key. */
  queryKey: readonly unknown[];
  /** Fetch function that receives an AbortSignal. */
  queryFn: (signal: AbortSignal) => Promise<T>;
  /** Phase 2 data to display immediately. */
  initialData: T;
  /** Whether to enable the query (default: true). */
  enabled?: boolean;
}

interface UsePhase3DataResult<T> {
  /** Current data — Phase 2 initially, Phase 3 after background fetch. */
  data: T;
  /** True once Phase 3 data has replaced Phase 2. */
  isFullyLoaded: boolean;
}

/**
 * Fetches Phase 3 data in the background while immediately displaying
 * Phase 2 initialData. Returns `isFullyLoaded` flag for UI gating
 * (e.g., disabling widget mode until full data arrives).
 *
 * @param opts - Query key, fetch function, initial data, and optional enabled flag
 */
export function usePhase3Data<T>(opts: UsePhase3DataOptions<T>): UsePhase3DataResult<T> {
  const query = useQuery({
    queryKey: opts.queryKey,
    queryFn: ({ signal }) => opts.queryFn(signal),
    enabled: opts.enabled ?? true,
    initialData: opts.initialData,
    initialDataUpdatedAt: 0,
  });

  return {
    data: query.data ?? opts.initialData,
    isFullyLoaded: query.dataUpdatedAt > 0,
  };
}
