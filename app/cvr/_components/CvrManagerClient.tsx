"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { matchesSearch, passesClientMetaFilter, buildClientMetaMap } from "@/lib/utils/filters";
import { cycleSortDirection, compareNullable, type SortState } from "@/lib/utils/sort-utils";
import { useToastStore } from "@/stores/useToastStore";
import type { CvrMonthlyPayload, CvrRawRow, CvrSortField, CvrYearlyLevels } from "@/types/app-db.types";
import { EmptyState } from "@/components/common/EmptyState";
import { TableSkeleton } from "@/components/common/PageSkeleton";
import CvrFilters from "./CvrFilters";
import CvrTableMonthly from "./CvrTableMonthly";
import CvrTableYearly from "./CvrTableYearly";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CvrManagerClientProps {
  payload: CvrMonthlyPayload;
}

// ---------------------------------------------------------------------------
// Sort
// ---------------------------------------------------------------------------

/** Converts null to -Infinity for null-last sorting via compareNullable. */
function n(v: number | null): number {
  return v ?? -Infinity;
}

function sortCvrRows(
  rows: CvrRawRow[],
  sort: SortState<CvrSortField>,
  prevLevels: Record<string, string | null>,
): CvrRawRow[] {
  if (sort.field === null || sort.direction === "none") {
    // Default: vimp descending
    return [...rows].sort((a, b) => compareNullable(n(a.vimp), n(b.vimp), -1));
  }

  const mul = sort.direction === "asc" ? 1 : -1;

  return [...rows].sort((a, b) => {
    switch (sort.field) {
      case "client":
        return mul * (a.client_id ?? "").localeCompare(b.client_id ?? "");
      case "service":
        return mul * (a.service_name ?? "").localeCompare(b.service_name ?? "");
      case "vimp":
        return compareNullable(n(a.vimp), n(b.vimp), mul);
      case "level":
        return mul * (a.level ?? "Z").localeCompare(b.level ?? "Z");
      case "prevLevel": {
        const pa = prevLevels[a.service_id] ?? "Z";
        const pb = prevLevels[b.service_id] ?? "Z";
        return mul * pa.localeCompare(pb);
      }
      case "cmr":
        return compareNullable(
          n(a.contribution_margin_rate_pct),
          n(b.contribution_margin_rate_pct),
          mul,
        );
      case "cvr":
        return compareNullable(n(a.normalized_cvr_pct), n(b.normalized_cvr_pct), mul);
      case "serviceType":
        return mul * (a.service_type ?? "").localeCompare(b.service_type ?? "");
      case "revenue":
        return compareNullable(n(a.revenue), n(b.revenue), mul);
      case "rpm":
        return compareNullable(n(a.rpm), n(b.rpm), mul);
      case "vctr":
        return compareNullable(n(a.vctr_pct), n(b.vctr_pct), mul);
      case "cpc":
        return compareNullable(n(a.cpc), n(b.cpc), mul);
      case "invalidRate":
        return compareNullable(
          n(a.invalid_revenue_ratio_pct),
          n(b.invalid_revenue_ratio_pct),
          mul,
        );
      case "campaign":
        return compareNullable(n(a.campaign_count), n(b.campaign_count), mul);
      default:
        return 0;
    }
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * CVR section main client component.
 *
 * Phase 1 (server): Receives CvrMonthlyPayload — rows + prevLevels for current month.
 * Phase 2 (client): Lazy-fetches 13-month level history when user switches to yearly view.
 *
 * Local interaction state:
 *   - viewMode       — "month" | "year" toggle
 *   - selectedLevels — A~F multi-select filter (empty = show all)
 *   - sort           — column sort state
 *   - search         — read from URL params (global search bar)
 *
 * Month navigation triggers a server round-trip via router.push (URL param).
 */
export default function CvrManagerClient({ payload }: CvrManagerClientProps) {
  const { selectedMonth, availableMonths, rows, prevLevels, clientMeta } = payload;

  // -------------------------------------------------------------------------
  // Local state
  // -------------------------------------------------------------------------
  const [viewMode, setViewMode] = useState<"month" | "year">("month");
  const [selectedLevels, setSelectedLevels] = useState<string[]>([]);
  const [sort, setSort] = useState<SortState<CvrSortField>>({ field: null, direction: "none" });

  // Phase 2: yearly level data (lazy loaded)
  const [yearlyLevels, setYearlyLevels] = useState<CvrYearlyLevels | null>(null);
  const [yearlyLoading, setYearlyLoading] = useState(false);
  const yearlyFetchedMonth = useRef<string | null>(null);

  // Global filters from URL
  const searchParams = useSearchParams();
  const search = searchParams.get("search") ?? "";
  const tier = searchParams.get("tier") ?? "";
  const owner = searchParams.get("owner") ?? "";
  const router = useRouter();

  const addToast = useToastStore((s) => s.add);

  const clientMetaMap = useMemo(
    () => buildClientMetaMap(clientMeta),
    [clientMeta],
  );

  // -------------------------------------------------------------------------
  // Phase 2: Fetch yearly levels on demand
  // -------------------------------------------------------------------------
  const fetchYearlyLevels = useCallback(async (month: string) => {
    if (yearlyFetchedMonth.current === month) return;

    setYearlyLoading(true);
    try {
      const res = await fetch("/api/cvr/yearly-levels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: CvrYearlyLevels = await res.json();
      setYearlyLevels(data);
      yearlyFetchedMonth.current = month;
    } catch (err) {
      console.error("[CvrManagerClient] Failed to fetch yearly levels:", err);
      addToast({ type: "error", message: "연간 레벨 데이터를 불러오는데 실패했습니다." });
    } finally {
      setYearlyLoading(false);
    }
  }, []);

  // Trigger fetch when switching to yearly view
  useEffect(() => {
    if (viewMode === "year") {
      fetchYearlyLevels(selectedMonth);
    }
  }, [viewMode, selectedMonth, fetchYearlyLevels]);

  // Reset cached yearly data when month changes via navigation
  useEffect(() => {
    if (yearlyFetchedMonth.current && yearlyFetchedMonth.current !== selectedMonth) {
      setYearlyLevels(null);
      yearlyFetchedMonth.current = null;
    }
  }, [selectedMonth]);

  // -------------------------------------------------------------------------
  // Month navigation
  // -------------------------------------------------------------------------
  function goToMonth(month: string) {
    router.push(`/cvr?month=${month}`);
  }

  // -------------------------------------------------------------------------
  // Level filter toggle
  // -------------------------------------------------------------------------
  function toggleLevel(level: string) {
    setSelectedLevels((prev) =>
      prev.includes(level) ? prev.filter((l) => l !== level) : [...prev, level],
    );
  }

  function clearLevels() {
    setSelectedLevels([]);
  }

  // -------------------------------------------------------------------------
  // Sort handler
  // -------------------------------------------------------------------------
  function handleSort(field: CvrSortField) {
    setSort((prev) => cycleSortDirection(prev, field));
  }

  // -------------------------------------------------------------------------
  // useMemo pipeline
  // -------------------------------------------------------------------------
  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (!matchesSearch([row.client_id, row.service_name ?? "", row.service_id], search))
        return false;
      if (!passesClientMetaFilter(row.client_id, clientMetaMap, tier, owner)) return false;
      if (selectedLevels.length > 0 && !selectedLevels.includes(row.level ?? "")) return false;
      return true;
    });
  }, [rows, search, tier, owner, clientMetaMap, selectedLevels]);

  const sortedRows = useMemo(
    () => sortCvrRows(filteredRows, sort, prevLevels),
    [filteredRows, sort, prevLevels],
  );

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div className="flex flex-col h-full">
      <CvrFilters
        selectedMonth={selectedMonth}
        availableMonths={availableMonths}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        selectedLevels={selectedLevels}
        onToggleLevel={toggleLevel}
        onClearLevels={clearLevels}
        onGoToMonth={goToMonth}
      />

      {sortedRows.length === 0 ? (
        <EmptyState className="flex-1" message="조건에 맞는 데이터가 없습니다." />
      ) : viewMode === "month" ? (
        <CvrTableMonthly
          rows={sortedRows}
          prevLevels={prevLevels}
          selectedMonth={selectedMonth}
          sort={sort}
          onSort={handleSort}
        />
      ) : yearlyLoading || !yearlyLevels ? (
        <TableSkeleton cols={16} rows={15} className="mx-4 mt-3 mb-4" />
      ) : (
        <CvrTableYearly
          rows={sortedRows}
          selectedMonth={selectedMonth}
          pastMonthLevels={yearlyLevels}
        />
      )}
    </div>
  );
}
