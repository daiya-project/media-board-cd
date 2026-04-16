"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queries/queryKeys";
import { fetchDashboardServiceData } from "@/lib/queries/queryFns";
import { CHART_RANGE_DEFAULTS } from "@/lib/config";
import {
  getPeriodDateRanges,
  calcBoardSummaryByDateRange,
  calcChartPointsByGroups,
  calcTrendListByDateRange,
  aggregateServiceToTotal,
} from "@/lib/logic/boardLogic";
import type { PeriodType } from "@/lib/logic/boardLogic";
import type {
  BoardQuickPayload,
  DailyServiceRow,
} from "@/types/app-db.types";
import { ChartSkeleton } from "@/components/common/PageSkeleton";
import { EmptyState } from "@/components/common/EmptyState";
import SummaryCards from "./SummaryCards";
import DashboardControls from "./DashboardControls";
import BoardChart from "./BoardChart";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface DashboardClientProps {
  quickPayload: BoardQuickPayload;
  hasFilters: boolean;
}

// ---------------------------------------------------------------------------
// SelectedService
// ---------------------------------------------------------------------------

interface SelectedService {
  id: string;
  name: string;
}

// ---------------------------------------------------------------------------
// DashboardClient
// ---------------------------------------------------------------------------

/**
 * Dashboard (Board) section main client component.
 *
 * Phase 2 data (quickPayload) renders KPI cards immediately.
 * Phase 3 service data is fetched client-side via API route to avoid
 * RSC stream blocking (which would prevent navigation to other sections).
 *
 * All derived data is computed via useMemo — no network requests on interaction.
 */
export default function DashboardClient({
  quickPayload,
  hasFilters,
}: DashboardClientProps) {
  const { allDates, totalData, weeks } = quickPayload;

  // ---------------------------------------------------------------------------
  // Local state
  // ---------------------------------------------------------------------------

  const [periodType, setPeriodType] = useState<PeriodType>("daily");

  const [chartRange, setChartRange] = useState<number>(CHART_RANGE_DEFAULTS.daily);

  // ---------------------------------------------------------------------------
  // Phase 3: service data (React Query — SWR cached)
  // ---------------------------------------------------------------------------

  const serviceQuery = useQuery({
    queryKey: queryKeys.dashboard.serviceData(allDates, quickPayload.clientIds),
    queryFn: ({ signal }) =>
      fetchDashboardServiceData(allDates, quickPayload.clientIds, signal),
    enabled: allDates.length > 0,
  });

  const serviceData = serviceQuery.data ?? [];
  const isServiceLoaded = serviceQuery.isFetched;

  // ---------------------------------------------------------------------------
  // Derived: period date ranges (for KPI + comparison label)
  // ---------------------------------------------------------------------------

  const latestDate = allDates[0] ?? "";

  const periodRanges = useMemo(
    () => getPeriodDateRanges(allDates, periodType, chartRange, weeks),
    [allDates, periodType, chartRange, weeks],
  );

  // ---------------------------------------------------------------------------
  // Derived: KPI summary
  // ---------------------------------------------------------------------------

  const effectiveTotalData = useMemo(
    () =>
      hasFilters && serviceData.length > 0
        ? aggregateServiceToTotal(serviceData)
        : totalData,
    [hasFilters, totalData, serviceData],
  );

  const summary = useMemo(
    () =>
      calcBoardSummaryByDateRange(
        effectiveTotalData,
        periodRanges.currentDates,
        periodRanges.previousDates,
      ),
    [effectiveTotalData, periodRanges],
  );

  // ---------------------------------------------------------------------------
  // Derived: comparison label
  // ---------------------------------------------------------------------------

  const comparisonLabel = useMemo(() => {
    if (periodType === "monthly") {
      const prevDate = periodRanges.previousDates[0];
      if (!prevDate) return "vs 전월";
      const month = parseInt(prevDate.slice(5, 7), 10);
      return `vs ${month}월`;
    }
    if (periodType === "weekly") return "vs 전주";
    const prevDate = periodRanges.previousDates[0];
    return prevDate
      ? `vs ${prevDate.slice(5).replace("-", "/")}`
      : "vs -";
  }, [periodType, periodRanges]);

  // ---------------------------------------------------------------------------
  // Derived: charts (only when serviceData is available)
  // ---------------------------------------------------------------------------

  const [selectedService, setSelectedService] =
    useState<SelectedService | null>(null);
  const [adRevenueTrend, setAdRevenueTrend] = useState<"up" | "down">("down");
  const [vimpTrend, setVimpTrend] = useState<"up" | "down">("down");
  const [mfrTrend, setMfrTrend] = useState<"up" | "down">("up");

  useEffect(() => {
    setSelectedService(null);
  }, [periodType]);

  const chartPeriodRanges = useMemo(
    () => getPeriodDateRanges(allDates, periodType, chartRange, weeks),
    [allDates, periodType, chartRange, weeks],
  );

  const chartPoints = useMemo(
    () =>
      isServiceLoaded && serviceData.length > 0
        ? calcChartPointsByGroups(
            effectiveTotalData,
            serviceData,
            chartPeriodRanges.chartGroups,
            selectedService?.id ?? null,
          )
        : [],
    [effectiveTotalData, serviceData, chartPeriodRanges, selectedService?.id, isServiceLoaded],
  );

  const adRevenueTrendItems = useMemo(
    () =>
      isServiceLoaded
        ? calcTrendListByDateRange(
            serviceData,
            chartPeriodRanges.currentDates,
            chartPeriodRanges.previousDates,
            "adRevenue",
            adRevenueTrend,
          )
        : [],
    [serviceData, chartPeriodRanges, adRevenueTrend, isServiceLoaded],
  );

  const vimpTrendItems = useMemo(
    () =>
      isServiceLoaded
        ? calcTrendListByDateRange(
            serviceData,
            chartPeriodRanges.currentDates,
            chartPeriodRanges.previousDates,
            "vimp",
            vimpTrend,
          )
        : [],
    [serviceData, chartPeriodRanges, vimpTrend, isServiceLoaded],
  );

  const mfrTrendItems = useMemo(
    () =>
      isServiceLoaded
        ? calcTrendListByDateRange(
            serviceData,
            chartPeriodRanges.currentDates,
            chartPeriodRanges.previousDates,
            "mfr",
            mfrTrend,
          )
        : [],
    [serviceData, chartPeriodRanges, mfrTrend, isServiceLoaded],
  );

  function handleServiceSelect(serviceId: string | null) {
    if (serviceId === null) {
      setSelectedService(null);
      return;
    }
    const row = serviceData.find((r) => r.service_id === serviceId);
    setSelectedService(
      row
        ? { id: serviceId, name: row.service_name }
        : { id: serviceId, name: serviceId },
    );
  }

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  function handlePeriodTypeChange(t: PeriodType) {
    setPeriodType(t);
    setChartRange(CHART_RANGE_DEFAULTS[t]);
  }

  // ---------------------------------------------------------------------------
  // Empty state
  // ---------------------------------------------------------------------------

  if (allDates.length === 0) {
    return <EmptyState className="flex-1 p-6" />;
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex flex-col gap-4 pb-8">
      {/* 1. KPI Cards — immediate from totalData, updated when serviceData loads (filtered) */}
      <SummaryCards
        summary={summary}
        latestDate={latestDate}
        comparisonLabel={comparisonLabel}
        periodType={periodType}
      />

      {/* 2. Control Panel — always immediate (no data dependency) */}
      <DashboardControls
        periodType={periodType}
        chartRange={chartRange}
        latestDate={latestDate}
        onPeriodTypeChange={handlePeriodTypeChange}
        onChartRangeChange={setChartRange}
      />

      {/* 3. Charts + Trend Lists — skeleton until Phase 3 resolves */}
      {!isServiceLoaded ? (
        <div className="px-6 space-y-5">
          <ChartSkeleton />
          <ChartSkeleton />
          <ChartSkeleton />
        </div>
      ) : (
        <div className="px-6 space-y-5">
          <BoardChart
            title="Ad Revenue"
            metric="adRevenue"
            metricLabel="Ad Revenue"
            dataKey="adRevenue"
            chartPoints={chartPoints}
            trendItems={adRevenueTrendItems}
            direction={adRevenueTrend}
            onDirectionChange={(d) => {
              setAdRevenueTrend(d);
              setSelectedService(null);
            }}
            selectedServiceId={selectedService?.id ?? null}
            selectedServiceName={selectedService?.name ?? null}
            onServiceSelect={handleServiceSelect}
            periodType={periodType}
          />

          <BoardChart
            title="vIMP"
            metric="vimp"
            metricLabel="vIMP"
            dataKey="vimp"
            chartPoints={chartPoints}
            trendItems={vimpTrendItems}
            direction={vimpTrend}
            onDirectionChange={(d) => {
              setVimpTrend(d);
              setSelectedService(null);
            }}
            selectedServiceId={selectedService?.id ?? null}
            selectedServiceName={selectedService?.name ?? null}
            onServiceSelect={handleServiceSelect}
            periodType={periodType}
          />

          <BoardChart
            title="MFR"
            metric="mfr"
            metricLabel="MFR"
            dataKey="mfr"
            chartPoints={chartPoints}
            trendItems={mfrTrendItems}
            direction={mfrTrend}
            onDirectionChange={(d) => {
              setMfrTrend(d);
              setSelectedService(null);
            }}
            selectedServiceId={selectedService?.id ?? null}
            selectedServiceName={selectedService?.name ?? null}
            onServiceSelect={handleServiceSelect}
            periodType={periodType}
          />
        </div>
      )}
    </div>
  );
}
