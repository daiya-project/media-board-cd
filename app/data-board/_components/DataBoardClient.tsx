"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { usePhase3Data } from "@/hooks/usePhase3Data";
import { useDataBoardFilters } from "@/hooks/useDataBoardFilters";
import { queryKeys } from "@/lib/queries/queryKeys";
import { fetchDataBoardFullData } from "@/lib/queries/queryFns";
import { CHART_RANGE_DEFAULTS } from "@/lib/config";
import {
  groupRawData,
  buildTotalRow,
} from "@/lib/logic/dataBoardGrouping";
import { sortDataRows } from "@/lib/logic/dataBoardCalculations";
import { matchesSearch, passesSmallAmountFilter, passesClientMetaFilter, buildClientMetaMap, getDataBoardSearchFields } from "@/lib/utils/filters";
import type { DataBoardPayload } from "@/types/app-db.types";
import DataFilters from "./DataFilters";
import { EmptyState } from "@/components/common/EmptyState";
import DataTable from "./DataTable";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface DataBoardClientProps {
  quickPayload: DataBoardPayload;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * DATA Daily page client component.
 *
 * Two-phase data loading:
 *   Phase 2: quickPayload contains service-level data for initial 14 days.
 *   Phase 3: client-side fetch via /api/data-board/full-data resolves with
 *            widget-level data for all 90 days.
 *
 * Daily-only — period switching uses Link-based navigation to /weekly or /monthly.
 */
export default function DataBoardClient({
  quickPayload,
}: DataBoardClientProps) {
  const {
    allDates,
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
  } = useDataBoardFilters({ defaultChartRange: CHART_RANGE_DEFAULTS.daily });

  // -------------------------------------------------------------------------
  // Phase 3: background data replacement (React Query — SWR cached)
  // -------------------------------------------------------------------------
  const { data: rawData, isFullyLoaded } = usePhase3Data({
    queryKey: queryKeys.dataBoard.fullData(allDates),
    queryFn: (signal) => fetchDataBoardFullData(allDates, signal),
    initialData: initialRawData,
    enabled: allDates.length > 0,
  });

  const loadedDaysCount = useMemo(
    () => new Set(rawData.map((r) => r.date)).size,
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

  const displayKeys = useMemo(
    () => allDates.slice(0, chartRange),
    [allDates, chartRange],
  );

  const groupedData = useMemo(
    () => groupRawData(rawData, filterType, metricType),
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
    () => sortDataRows(filteredData, sort, displayKeys, metricType, holidays),
    [filteredData, sort, displayKeys, metricType, holidays],
  );

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  const isEmpty = allDates.length === 0;

  return (
    <div className="flex flex-col h-full">
      <DataFilters
        filterType={filterType}
        onFilterTypeChange={(t) => onFilterTypeChange(t, isFullyLoaded)}
        metricType={metricType}
        onMetricTypeChange={onMetricTypeChange}
        periodType="daily"
        chartRange={chartRange}
        onChartRangeChange={setChartRange}
        excludeSmall={excludeSmall}
        onExcludeSmallChange={setExcludeSmall}
        sliderMaxOverride={isFullyLoaded ? undefined : loadedDaysCount}
        isWidgetDisabled={!isFullyLoaded}
      />

      {isEmpty ? (
        <EmptyState className="flex-1" />
      ) : (
        <DataTable
          dates={displayKeys}
          holidays={holidays}
          filterType={filterType}
          metricType={metricType}
          periodType="daily"
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
