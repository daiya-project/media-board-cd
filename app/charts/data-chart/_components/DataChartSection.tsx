"use client";

import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePhase3Data } from "@/hooks/usePhase3Data";
import { cn } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";
import { queryKeys } from "@/lib/queries/queryKeys";
import { fetchMaFullServiceData, fetchMaWidgetData } from "@/lib/queries/queryFns";
import type { MaChartQuickPayload } from "@/lib/api/maChartService";
import {
  groupByEntity,
  rankEntitiesByRevenue,
  computeDisplayDates,
  MA_METRICS,
  MA_METRIC_COLORS,
  MA_METRIC_LABELS,
  type MaMetricType,
  type MaDateRange,
} from "@/lib/logic/maChartLogic";
import {
  buildDataChartData,
  buildDataMiniCardsData,
} from "@/lib/logic/dataChartLogic";
import MaDateRangePicker from "@/app/charts/moving-average/_components/MaDateRangePicker";
import DataMainChart from "./DataMainChart";
import DataMidChartRow from "./DataMidChartRow";
import DataMiniCards from "./DataMiniCards";

interface DataChartSectionProps {
  quickPayload: MaChartQuickPayload;
}

/**
 * Orchestrator component for the Data Chart section.
 *
 * Structurally identical to MaChartSection but without MA window state,
 * MA picker, SMA computation, or gap/band data. Displays raw actual
 * metric values as a single-line time series.
 *
 * Shares React Query cache with MA Charts (same queryKeys.maCharts.*).
 */
export default function DataChartSection({
  quickPayload,
}: DataChartSectionProps) {
  const { allDates, serviceData: initialServiceData, holidays } = quickPayload;

  // -----------------------------------------------------------------------
  // State (no maWindow — that's the key difference from MaChartSection)
  // -----------------------------------------------------------------------
  const [metric, setMetric] = useState<MaMetricType>("ad_revenue");
  const [secondaryMetric, setSecondaryMetric] = useState<MaMetricType | null>(null);
  const [dateRange, setDateRange] = useState<MaDateRange>("30d");
  const [customDateRange, setCustomDateRange] = useState<{
    from: string;
    to: string;
  } | null>(null);
  const [includeHolidays, setIncludeHolidays] = useState(false);
  const [entityMode, setEntityMode] = useState<"service" | "widget">(
    "service",
  );
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [miniChartCount, setMiniChartCount] = useState(20);

  // -----------------------------------------------------------------------
  // Phase 3a: full service data (React Query — SWR cached, shared with MA)
  // -----------------------------------------------------------------------
  const { data: serviceData, isFullyLoaded } = usePhase3Data({
    queryKey: queryKeys.maCharts.fullServiceData(allDates),
    queryFn: (signal) => fetchMaFullServiceData(allDates, signal),
    initialData: initialServiceData,
    enabled: allDates.length > 0,
  });

  // -----------------------------------------------------------------------
  // Phase 3b: widget data (auto pre-load after Phase 3a completes)
  // -----------------------------------------------------------------------
  const widgetQuery = useQuery({
    queryKey: queryKeys.maCharts.widgetData(allDates),
    queryFn: ({ signal }) => fetchMaWidgetData(allDates, signal),
    enabled: isFullyLoaded && allDates.length > 0,
  });

  const widgetData = widgetQuery.data ?? null;
  const widgetDataLoading = widgetQuery.isFetching;

  const handleMetricChange = useCallback(
    (newMetric: MaMetricType) => {
      setMetric(newMetric);
      if (newMetric === secondaryMetric) setSecondaryMetric(null);
    },
    [secondaryMetric],
  );

  const handleEntityModeChange = useCallback(
    (mode: "service" | "widget") => {
      if (mode === "widget" && !widgetQuery.data) return;
      setEntityMode(mode);
      setSelectedEntityId(null);
    },
    [widgetQuery.data],
  );

  // -----------------------------------------------------------------------
  // Memoized computations
  // -----------------------------------------------------------------------

  const holidaySet = useMemo(() => new Set(holidays), [holidays]);

  const grouped = useMemo(() => {
    const data =
      entityMode === "widget" && widgetData ? widgetData : serviceData;
    return groupByEntity(data, entityMode);
  }, [serviceData, widgetData, entityMode]);

  const allSortedDates = useMemo(() => [...allDates].sort(), [allDates]);

  const displayDates = useMemo(
    () => computeDisplayDates(allDates, dateRange, customDateRange),
    [allDates, dateRange, customDateRange],
  );

  const rankedIds = useMemo(
    () => rankEntitiesByRevenue(grouped, displayDates),
    [grouped, displayDates],
  );

  const effectiveEntityId = selectedEntityId ?? rankedIds[0] ?? null;
  const effectiveEntity = effectiveEntityId
    ? grouped.get(effectiveEntityId)
    : null;

  // Main chart data — actual values only, no MA/bands/gap
  const mainChartData = useMemo(() => {
    if (!effectiveEntityId) return [];
    const entity = grouped.get(effectiveEntityId);
    if (!entity) return [];
    return buildDataChartData(
      entity,
      metric,
      allSortedDates,
      displayDates,
      holidaySet,
      includeHolidays,
      secondaryMetric,
    );
  }, [
    grouped,
    effectiveEntityId,
    metric,
    secondaryMetric,
    allSortedDates,
    displayDates,
    holidaySet,
    includeHolidays,
  ]);

  // Mini card data
  const miniCards = useMemo(
    () =>
      buildDataMiniCardsData(
        grouped,
        rankedIds,
        metric,
        allSortedDates,
        displayDates,
        holidaySet,
        includeHolidays,
        miniChartCount,
      ),
    [
      grouped,
      rankedIds,
      metric,
      allSortedDates,
      displayDates,
      holidaySet,
      includeHolidays,
      miniChartCount,
    ],
  );

  // Mid-chart data: compute for all 4 non-primary metrics (actual only)
  const midChartsData = useMemo(() => {
    if (!effectiveEntityId) return [];
    const entity = grouped.get(effectiveEntityId);
    if (!entity) return [];
    return MA_METRICS
      .filter(({ value }) => value !== metric)
      .map(({ value }) => ({
        metric: value,
        data: buildDataChartData(
          entity,
          value,
          allSortedDates,
          displayDates,
          holidaySet,
          includeHolidays,
          null,
        ),
      }));
  }, [
    grouped,
    effectiveEntityId,
    metric,
    allSortedDates,
    displayDates,
    holidaySet,
    includeHolidays,
  ]);

  // -----------------------------------------------------------------------
  // Header info
  // -----------------------------------------------------------------------
  const chartTitle = `${MA_METRIC_LABELS[metric]} Data Chart`;
  const entityLabel = effectiveEntity
    ? `${effectiveEntity.serviceId}. ${effectiveEntity.entityName}`
    : "";

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  return (
    <div className="flex flex-col gap-6">
      {/* Main chart card */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <span
            className="inline-block h-3 w-3 rounded-full"
            style={{ backgroundColor: MA_METRIC_COLORS[metric] }}
          />
          <h2 className="text-lg font-bold text-gray-700">{chartTitle}</h2>
          <span className="text-sm text-gray-400">{entityLabel}</span>
        </div>

        {/* Chart */}
        <DataMainChart
          data={mainChartData}
          metric={metric}
          secondaryMetric={secondaryMetric}
          holidaySet={holidaySet}
        />

        {/* Bottom controls */}
        <div className="flex items-center justify-center gap-4 mt-4">
          {/* Secondary metric checkboxes */}
          <div className="inline-flex items-center gap-2.5 text-xs">
            {MA_METRICS.map(({ value, label }) => {
              const isDisabled = value === metric;
              const isChecked = value === secondaryMetric;
              return (
                <label
                  key={value}
                  className={cn(
                    "flex items-center gap-1 cursor-pointer",
                    isDisabled && "opacity-30 cursor-not-allowed",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    disabled={isDisabled}
                    onChange={() =>
                      setSecondaryMetric(isChecked ? null : value)
                    }
                    className="rounded border-gray-300"
                  />
                  <span
                    className="font-medium"
                    style={
                      isChecked
                        ? { color: MA_METRIC_COLORS[value] }
                        : undefined
                    }
                  >
                    {label}
                  </span>
                </label>
              );
            })}
          </div>

          <div className="h-5 w-px bg-gray-200" />

          <MaDateRangePicker
            selected={dateRange}
            customRange={customDateRange}
            onChange={setDateRange}
            onCustomChange={setCustomDateRange}
          />

          <div className="h-5 w-px bg-gray-200" />

          {/* Holiday toggle */}
          <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
            <input
              type="checkbox"
              checked={includeHolidays}
              onChange={(e) => setIncludeHolidays(e.target.checked)}
              className="rounded border-gray-300"
            />
            <span>휴일 데이터 포함</span>
          </label>

          <div className="h-5 w-px bg-gray-200" />

          {/* Entity mode toggle */}
          <div className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 p-0.5 text-xs font-semibold">
            <button
              onClick={() => handleEntityModeChange("service")}
              className={cn(
                "rounded-full px-2.5 py-1 transition-colors",
                entityMode === "service"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700",
              )}
            >
              서비스
            </button>
            <button
              onClick={() => handleEntityModeChange("widget")}
              disabled={widgetDataLoading}
              className={cn(
                "rounded-full px-2.5 py-1 transition-colors",
                entityMode === "widget"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700",
                widgetDataLoading && "opacity-50",
              )}
            >
              {widgetDataLoading ? "로딩..." : "위젯"}
            </button>
          </div>

          {/* Phase 2 loading indicator */}
          {!isFullyLoaded && (
            <span className="text-[10px] text-gray-300 animate-pulse">
              전체 데이터 로딩 중...
            </span>
          )}
        </div>
      </div>

      {/* Mid-chart row: 4 non-primary metric charts */}
      <DataMidChartRow
        midChartsData={midChartsData}
        primaryMetric={metric}
        onMetricSwap={handleMetricChange}
      />

      {/* Mini cards section */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        {/* Header with count slider */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-600">
            Top {miniChartCount}{" "}
            {entityMode === "service" ? "Services" : "Widgets"}
          </h3>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400">{miniChartCount}</span>
            <Slider
              min={20}
              max={60}
              step={4}
              value={[miniChartCount]}
              onValueChange={(v) => setMiniChartCount(v[0] ?? 20)}
              className="w-24"
            />
          </div>
        </div>

        <DataMiniCards
          cards={miniCards}
          metric={metric}
          selectedEntityId={effectiveEntityId}
          onEntitySelect={setSelectedEntityId}
        />
      </div>
    </div>
  );
}
