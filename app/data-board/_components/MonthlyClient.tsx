"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { usePhase3Data } from "@/hooks/usePhase3Data";
import { useDataBoardFilters } from "@/hooks/useDataBoardFilters";
import { queryKeys } from "@/lib/queries/queryKeys";
import { fetchDataBoardMonthlyFullData } from "@/lib/queries/queryFns";
import { CHART_RANGE_DEFAULTS } from "@/lib/config";
import {
  groupMonthlyRawData,
  buildTotalRow,
} from "@/lib/logic/dataBoardGrouping";
import { sortDataRows } from "@/lib/logic/dataBoardCalculations";
import { matchesSearch, passesSmallAmountFilter, passesClientMetaFilter, buildClientMetaMap, getDataBoardSearchFields } from "@/lib/utils/filters";
import type { MonthlyPayload } from "@/types/app-db.types";
import DataFilters from "./DataFilters";
import { EmptyState } from "@/components/common/EmptyState";
import DataTable from "./DataTable";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface MonthlyClientProps {
  quickPayload: MonthlyPayload;
}

/** Module-level empty set — monthly mode skips weekday coloring. */
const EMPTY_HOLIDAYS = new Set<string>();

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * DATA Monthly page client component.
 *
 * Phase 2: quickPayload has first 3 months from v_monthly MV.
 * Phase 3: React Query fetches all months via /api/data-board/monthly.
 *
 * v_monthly already has widget-level granularity, so C/S/W switching
 * is instant client-side via groupMonthlyRawData().
 */
export default function MonthlyClient({
  quickPayload,
}: MonthlyClientProps) {
  const {
    allMonths,
    rawData: initialRawData,
    clientMeta,
  } = quickPayload;

  // -------------------------------------------------------------------------
  // Shared filter state
  // -------------------------------------------------------------------------
  const {
    filterType, metricType, chartRange, excludeSmall, sort,
    setChartRange, setExcludeSmall,
    handleFilterTypeChange: onFilterTypeChange,
    handleMetricTypeChange: onMetricTypeChange,
    handleSort,
  } = useDataBoardFilters({ defaultChartRange: CHART_RANGE_DEFAULTS.monthly });

  // -------------------------------------------------------------------------
  // Phase 3: background data replacement
  // -------------------------------------------------------------------------
  const { data: rawData, isFullyLoaded } = usePhase3Data({
    queryKey: queryKeys.dataBoard.monthlyFullData(allMonths),
    queryFn: (signal) => fetchDataBoardMonthlyFullData(allMonths, signal),
    initialData: initialRawData,
    enabled: allMonths.length > 0,
  });

  const loadedMonthsCount = useMemo(
    () => new Set(rawData.map((r) => r.year_month)).size,
    [rawData],
  );

  const searchParams = useSearchParams();
  const search = searchParams.get("search") ?? "";
  const tier = searchParams.get("tier") ?? "";
  const owner = searchParams.get("owner") ?? "";

  const clientMetaMap = useMemo(
    () => buildClientMetaMap(clientMeta),
    [clientMeta],
  );

  // -------------------------------------------------------------------------
  // useMemo pipeline
  // -------------------------------------------------------------------------


  // displayKeys = year_month strings, newest first, sliced to chartRange
  const displayKeys = useMemo(
    () => allMonths.slice(0, chartRange),
    [allMonths, chartRange],
  );

  const groupedData = useMemo(
    () => groupMonthlyRawData(rawData, filterType, metricType),
    [rawData, filterType, metricType],
  );

  const filteredData = useMemo(() => {
    const filterKey = displayKeys[0] ?? "";
    return groupedData.filter((row) => {
      if (!matchesSearch(getDataBoardSearchFields(row), search)) return false;
      if (!passesClientMetaFilter(row.client_id, clientMetaMap, tier, owner)) return false;

      const latestCostSpent = row.rawDates.get(filterKey)?.cost_spent ?? 0;
      if (!passesSmallAmountFilter(latestCostSpent, filterType, excludeSmall))
        return false;

      return true;
    });
  }, [groupedData, search, tier, owner, clientMetaMap, filterType, excludeSmall, displayKeys]);

  const { totalDateValues, totalRawDates } = useMemo(
    () => buildTotalRow(filteredData, displayKeys, metricType),
    [filteredData, displayKeys, metricType],
  );

  const sortedRows = useMemo(
    () => sortDataRows(filteredData, sort, displayKeys, metricType, EMPTY_HOLIDAYS),
    [filteredData, sort, displayKeys, metricType],
  );

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  const isEmpty = allMonths.length === 0;

  return (
    <div className="flex flex-col h-full">
      <DataFilters
        filterType={filterType}
        onFilterTypeChange={(t) => onFilterTypeChange(t, isFullyLoaded)}
        metricType={metricType}
        onMetricTypeChange={onMetricTypeChange}
        periodType="monthly"
        chartRange={chartRange}
        onChartRangeChange={setChartRange}
        excludeSmall={excludeSmall}
        onExcludeSmallChange={setExcludeSmall}
        sliderMaxOverride={isFullyLoaded ? undefined : loadedMonthsCount}
        isWidgetDisabled={!isFullyLoaded}
      />

      {isEmpty ? (
        <EmptyState className="flex-1" />
      ) : (
        <DataTable
          dates={displayKeys}
          holidays={EMPTY_HOLIDAYS}
          filterType={filterType}
          metricType={metricType}
          periodType="monthly"
          sortedRows={sortedRows}
          totalDateValues={totalDateValues}
          totalRawDates={totalRawDates}
          sort={sort}
          onSort={handleSort}
          isEmpty={filteredData.length === 0}
        />
      )}
    </div>
  );
}
