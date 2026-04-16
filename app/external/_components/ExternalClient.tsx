"use client";

import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toYearMonth, addMonths, getLastDayOfMonth } from "@/lib/utils/date-utils";
import { queryKeys } from "@/lib/queries/queryKeys";
import { fetchExternalData } from "@/lib/queries/queryFns";
import { Button } from "@/components/ui/button";
import { useToastStore } from "@/stores/useToastStore";
import {
  combineExternalWithInternal,
  computeExternalSummary,
} from "@/lib/logic/external-logic";
import MonthPicker from "./MonthPicker";
import SummaryCards from "./SummaryCards";
import ExternalTable from "./ExternalTable";
import ExternalSyncModal from "./ExternalSyncModal";
import type { ExternalPagePayload } from "@/types/external";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Gets the first and last day of a YYYY-MM month. */
function monthRange(ym: string): { start: string; end: string } {
  return { start: `${ym}-01`, end: getLastDayOfMonth(ym) };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ExternalClientProps {
  payload: ExternalPagePayload;
}

/**
 * Main client component for External Report page.
 * Handles month-based period selection, sync modal, and data combination.
 */
export default function ExternalClient({ payload }: ExternalClientProps) {
  const { latestDate, externalRows, mappings, unitPrices, internalRows: initialInternalRows } = payload;
  const addToast = useToastStore((s) => s.add);

  // Month selector state
  const currentMonth = toYearMonth(latestDate);
  const latestMonth = currentMonth;
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Sync modal state
  const [syncModalOpen, setSyncModalOpen] = useState(false);

  // Date range for selected month
  const { start, end } = useMemo(() => monthRange(selectedMonth), [selectedMonth]);

  // React Query for data fetching with SWR pattern
  const { data, isLoading: loading, refetch } = useQuery({
    queryKey: queryKeys.external.daily(start, end),
    queryFn: ({ signal }) => fetchExternalData(start, end, signal),
    initialData: selectedMonth === currentMonth
      ? { externalRows, mappings, unitPrices, internalRows: initialInternalRows }
      : undefined,
  });

  const currentExternalRows = data?.externalRows ?? [];
  const currentMappings = data?.mappings ?? [];
  const currentUnitPrices = data?.unitPrices ?? [];
  const currentInternalRows = data?.internalRows ?? [];

  // Month navigation (any month up to latestMonth)
  const canGoPrev = selectedMonth > "2025-01";
  const canGoNext = selectedMonth < latestMonth;

  // Combine external + internal data
  const combinedRows = useMemo(
    () => combineExternalWithInternal(currentExternalRows, currentMappings, currentInternalRows, currentUnitPrices),
    [currentExternalRows, currentMappings, currentInternalRows, currentUnitPrices],
  );

  const summary = useMemo(
    () => computeExternalSummary(combinedRows),
    [combinedRows],
  );

  // Sync completion: refetch query for current month
  const handleSyncComplete = useCallback(
    async () => {
      try {
        await refetch();
        addToast({ type: "success", message: "데이터가 갱신되었습니다" });
      } catch {
        addToast({ type: "error", message: "데이터 갱신에 실패했습니다" });
      }
    },
    [refetch, addToast],
  );

  // Default sync date range: selected month
  const syncDefaultStart = start;
  const syncDefaultEnd = end > latestDate ? latestDate : end;

  return (
    <>
      {/* Header: title + month nav left, sync button right */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-gray-800">External Report</h2>
            <span className="text-xs font-medium text-gray-400 tabular-nums">
              {combinedRows.length}건
            </span>
          </div>

          {/* Month navigator */}
          <div className="relative flex items-center gap-1">
            <button
              onClick={() => canGoPrev && setSelectedMonth(addMonths(selectedMonth, -1))}
              disabled={!canGoPrev}
              className="p-1.5 rounded-lg hover:bg-slate-200 disabled:opacity-30 transition-colors"
              aria-label="이전 월"
            >
              <ChevronLeft className="w-4 h-4 text-slate-600" />
            </button>

            <button
              onClick={() => setPickerOpen((v) => !v)}
              onBlur={() => setPickerOpen(false)}
              className={cn(
                "h-9 px-4 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors tabular-nums",
                loading && "opacity-60",
              )}
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin inline mr-1.5" />}
              {selectedMonth}
            </button>

            <button
              onClick={() => canGoNext && setSelectedMonth(addMonths(selectedMonth, 1))}
              disabled={!canGoNext}
              className="p-1.5 rounded-lg hover:bg-slate-200 disabled:opacity-30 transition-colors"
              aria-label="다음 월"
            >
              <ChevronRight className="w-4 h-4 text-slate-600" />
            </button>

            {pickerOpen && (
              <MonthPicker
                selectedMonth={selectedMonth}
                latestMonth={latestMonth}
                onSelect={setSelectedMonth}
                onClose={() => setPickerOpen(false)}
              />
            )}
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setSyncModalOpen(true)}
          className="gap-2"
        >
          <RefreshCw className="size-4" />
          동기화
        </Button>
      </div>

      {/* KPI Summary Cards */}
      <SummaryCards
        totalImp={summary.totalImp}
        totalRevenue={summary.totalRevenue}
        widgetCount={summary.widgetCount}
        bySource={summary.bySource}
      />

      {/* Data Table */}
      <ExternalTable rows={combinedRows} />

      {/* Sync Modal */}
      <ExternalSyncModal
        open={syncModalOpen}
        onClose={() => setSyncModalOpen(false)}
        onSyncComplete={handleSyncComplete}
        defaultStartDate={syncDefaultStart}
        defaultEndDate={syncDefaultEnd}
        latestDate={latestDate}
      />
    </>
  );
}
