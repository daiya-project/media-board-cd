"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { usePhase3Data } from "@/hooks/usePhase3Data";
import { useDataBoardFilters } from "@/hooks/useDataBoardFilters";
import { queryKeys } from "@/lib/queries/queryKeys";
import { fetchDataBoardWeeklyFullData } from "@/lib/queries/queryFns";
import { CHART_RANGE_DEFAULTS } from "@/lib/config";
import {
  groupWeeklyRawData,
  buildTotalRow,
} from "@/lib/logic/dataBoardGrouping";
import { sortDataRows } from "@/lib/logic/dataBoardCalculations";
import { matchesSearch, passesSmallAmountFilter, passesClientMetaFilter, buildClientMetaMap, getDataBoardSearchFields } from "@/lib/utils/filters";
import type { WeeklyPayload } from "@/types/app-db.types";
import DataFilters from "./DataFilters";
import { EmptyState } from "@/components/common/EmptyState";
import DataTable from "./DataTable";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface WeeklyClientProps {
  quickPayload: WeeklyPayload;
}

/** Module-level empty set — weekly/monthly modes skip weekday coloring. */
const EMPTY_HOLIDAYS = new Set<string>();

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * DATA Weekly page client component.
 *
 * Phase 2: quickPayload has first 8 weeks from v_weekly MV.
 * Phase 3: React Query fetches all weeks via /api/data-board/weekly.
 *
 * v_weekly already has widget-level granularity, so C/S/W switching
 * is instant client-side via groupWeeklyRawData().
 */
export default function WeeklyClient({
  quickPayload,
}: WeeklyClientProps) {
  const {
    allWeeks,
    rawData: initialRawData,
    holidays: holidayArray,
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
  } = useDataBoardFilters({ defaultChartRange: CHART_RANGE_DEFAULTS.weekly });

  // -------------------------------------------------------------------------
  // Phase 3: background data replacement
  // -------------------------------------------------------------------------
  const { data: rawData, isFullyLoaded } = usePhase3Data({
    queryKey: queryKeys.dataBoard.weeklyFullData(allWeeks),
    queryFn: (signal) => fetchDataBoardWeeklyFullData(allWeeks, signal),
    initialData: initialRawData,
    enabled: allWeeks.length > 0,
  });

  const loadedWeeksCount = useMemo(
    () => new Set(rawData.map((r) => r.display_label)).size,
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

  const holidays = useMemo(
    () => new Set<string>(holidayArray),
    [holidayArray],
  );

  // displayKeys = week labels, newest first, sliced to chartRange
  const allLabels = useMemo(
    () => allWeeks.map((w) => w.label),
    [allWeeks],
  );

  const displayKeys = useMemo(
    () => allLabels.slice(0, chartRange),
    [allLabels, chartRange],
  );

  const groupedData = useMemo(
    () => groupWeeklyRawData(rawData, filterType, metricType),
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
  const isEmpty = allWeeks.length === 0;

  return (
    <div className="flex flex-col h-full">
      <DataFilters
        filterType={filterType}
        onFilterTypeChange={(t) => onFilterTypeChange(t, isFullyLoaded)}
        metricType={metricType}
        onMetricTypeChange={onMetricTypeChange}
        periodType="weekly"
        chartRange={chartRange}
        onChartRangeChange={setChartRange}
        excludeSmall={excludeSmall}
        onExcludeSmallChange={setExcludeSmall}
        sliderMaxOverride={isFullyLoaded ? undefined : loadedWeeksCount}
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
          periodType="weekly"
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
