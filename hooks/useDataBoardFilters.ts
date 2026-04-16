/**
 * Shared filter state for DATA section pages (daily, weekly, monthly).
 *
 * Extracts the 5 common useState declarations + 3 handler functions
 * that are identical across DataBoardClient, WeeklyClient, MonthlyClient.
 */

import { useState, useCallback } from "react";
import { cycleSortDirection, type SortState } from "@/lib/utils/sort-utils";
import type { SortField } from "@/lib/logic/dataBoardCalculations";
import type { DataFilterType, DataMetricType } from "@/types/app-db.types";

interface UseDataBoardFiltersOptions {
  /** Default chart range (daily: 14, weekly: 8, monthly: 3). */
  defaultChartRange: number;
}

interface UseDataBoardFiltersReturn {
  filterType: DataFilterType;
  metricType: DataMetricType;
  chartRange: number;
  excludeSmall: boolean;
  sort: SortState<SortField>;
  setChartRange: (n: number) => void;
  setExcludeSmall: (v: boolean) => void;
  handleFilterTypeChange: (type: DataFilterType, isFullyLoaded: boolean) => void;
  handleMetricTypeChange: (type: DataMetricType) => void;
  handleSort: (field: SortField) => void;
}

/**
 * Manages filter/sort state for DATA section table pages.
 *
 * @param opts - Configuration with the default chart range for the period type
 */
export function useDataBoardFilters(
  opts: UseDataBoardFiltersOptions,
): UseDataBoardFiltersReturn {
  const [filterType, setFilterType] = useState<DataFilterType>("service");
  const [metricType, setMetricType] = useState<DataMetricType>("adrevenue");
  const [chartRange, setChartRange] = useState(opts.defaultChartRange);
  const [excludeSmall, setExcludeSmall] = useState(true);
  const [sort, setSort] = useState<SortState<SortField>>({
    field: null,
    direction: "none",
  });

  const resetSort = useCallback(
    () => setSort({ field: null, direction: "none" }),
    [],
  );

  const handleFilterTypeChange = useCallback(
    (type: DataFilterType, isFullyLoaded: boolean) => {
      if (type === "widget" && !isFullyLoaded) return;
      setFilterType(type);
      resetSort();
    },
    [resetSort],
  );

  const handleMetricTypeChange = useCallback(
    (type: DataMetricType) => {
      setMetricType(type);
      resetSort();
    },
    [resetSort],
  );

  const handleSort = useCallback(
    (field: SortField) => {
      setSort((prev) => cycleSortDirection(prev, field));
    },
    [],
  );

  return {
    filterType,
    metricType,
    chartRange,
    excludeSmall,
    sort,
    setChartRange,
    setExcludeSmall,
    handleFilterTypeChange,
    handleMetricTypeChange,
    handleSort,
  };
}
