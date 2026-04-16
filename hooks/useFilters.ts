"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

export interface GlobalFilters {
  search: string;
  tier: string;
  owner: string;
  stage: string;
  /** Follow-up toggle filter (management page only). "1" = active, "" = inactive */
  followup: string;
}

/**
 * Reads and writes global filter state via URL search params.
 * All filter values are stored in the URL so that they persist across
 * navigation and can be shared/bookmarked.
 *
 * @returns Current filter values and helpers to update or reset them
 */
export function useFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const filters: GlobalFilters = {
    search: searchParams.get("search") ?? "",
    tier: searchParams.get("tier") ?? "",
    owner: searchParams.get("owner") ?? "",
    stage: searchParams.get("stage") ?? "",
    followup: searchParams.get("followup") ?? "",
  };

  /**
   * Updates a single filter key in the URL.
   * Removes the param entirely when value is empty.
   */
  const setFilter = (key: keyof GlobalFilters, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  /** Clears all filter params and navigates to the bare pathname */
  const resetAll = () => {
    router.push(pathname, { scroll: false });
  };

  return { filters, setFilter, resetAll };
}
