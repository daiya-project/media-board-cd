"use client";

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";
import { Search, X, RotateCcw, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFilters } from "@/hooks/useFilters";
import { Combobox } from "@/components/common/Combobox";
import type { ComboboxOption } from "@/components/common/Combobox";
import { getManagers } from "@/lib/api/actionService";
import type { ManagerOption } from "@/lib/api/actionService";
import { getHeaderConfig } from "@/lib/config/header-filter-config";

const SEARCH_DEBOUNCE_MS = 300;

const TIER_OPTIONS: ComboboxOption[] = [
  { id: "상", name: "상" },
  { id: "중", name: "중" },
  { id: "하", name: "하" },
  { id: "기타", name: "기타" },
];

const STAGE_OPTIONS: ComboboxOption[] = [
  { id: "memo", name: "Memo" },
  { id: "contact", name: "Contact" },
  { id: "meeting", name: "Meeting" },
  { id: "propose", name: "Propose" },
  { id: "done", name: "Done" },
];

/**
 * Filter controls for the header bar.
 * Visibility and enabled state of each control is driven by
 * `getHeaderConfig()` based on the current route.
 */
export function HeaderFilters() {
  const pathname = usePathname();
  const { filters, setFilter, resetAll } = useFilters();
  const config = getHeaderConfig(pathname);

  // Debounced search — local state for instant typing, URL sync after delay
  const [localSearch, setLocalSearch] = useState(filters.search);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  // Sync local state when URL param changes externally (e.g., reset)
  useEffect(() => {
    setLocalSearch(filters.search);
  }, [filters.search]);

  const handleSearchChange = useCallback(
    (value: string) => {
      setLocalSearch(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        setFilter("search", value);
      }, SEARCH_DEBOUNCE_MS);
    },
    [setFilter],
  );

  const handleSearchClear = useCallback(() => {
    setLocalSearch("");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setFilter("search", "");
  }, [setFilter]);

  // Load managers for owner filter
  const [managers, setManagers] = useState<ManagerOption[]>([]);
  useEffect(() => {
    let cancelled = false;
    getManagers()
      .then((data) => {
        if (!cancelled) setManagers(data);
      })
      .catch((err) => {
        console.error("[HeaderFilters] Failed to load managers:", err);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const ownerOptions: ComboboxOption[] = useMemo(
    () =>
      managers.map((m) => ({ id: String(m.id), name: m.displayName })),
    [managers],
  );

  return (
    <div className="flex items-center gap-2 overflow-x-auto">
      {/* Search input */}
      {config.search && (
        <div className="relative w-[200px] xl:w-[280px] shrink-0 group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-[15px] h-[15px] text-gray-400 group-focus-within:text-blue-500 transition-colors" />
          <input
            type="text"
            placeholder="검색 (Client/Service)..."
            value={localSearch}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full h-9 pl-9 pr-8 text-[13px] border border-gray-200 rounded-lg bg-white text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 transition"
          />
          {localSearch && (
            <button
              type="button"
              onClick={handleSearchClear}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-[11px] h-[11px]" />
            </button>
          )}
        </div>
      )}

      {/* Tier filter */}
      {config.tier && (
        <div className="w-28 shrink-0">
          <Combobox
            options={TIER_OPTIONS}
            value={filters.tier || null}
            onChange={(id) => setFilter("tier", id ?? "")}
            allLabel="매중도"
            searchable={false}
          />
        </div>
      )}

      {/* Owner filter */}
      {config.owner && (
        <div className="w-28 shrink-0">
          <Combobox
            options={ownerOptions}
            value={filters.owner || null}
            onChange={(id) => setFilter("owner", id ?? "")}
            allLabel="담당자"
            searchable={false}
          />
        </div>
      )}

      {/* Stage filter */}
      {config.stage && (
        <div className="w-28 shrink-0">
          <Combobox
            options={STAGE_OPTIONS}
            value={filters.stage || null}
            onChange={(id) => setFilter("stage", id ?? "")}
            allLabel="Stage"
            searchable={false}
          />
        </div>
      )}

      {/* Reset all filters */}
      {config.reset && (
        <button
          type="button"
          onClick={resetAll}
          title="모든 필터 초기화"
          className="w-9 h-9 flex items-center justify-center border border-gray-200 rounded-lg bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-800 shrink-0 transition"
        >
          <RotateCcw className="w-[18px] h-[18px]" />
        </button>
      )}

      {/* Follow-up filter toggle */}
      {config.followup && (
        <button
          type="button"
          title="Follow-up 필터"
          onClick={() =>
            setFilter("followup", filters.followup === "1" ? "" : "1")
          }
          className={cn(
            "w-9 h-9 flex items-center justify-center border rounded-lg shrink-0 transition ml-1",
            filters.followup === "1"
              ? "bg-red-50 border-red-300 text-red-600"
              : "bg-white border-gray-200 text-gray-600 hover:bg-red-50 hover:border-red-300 hover:text-red-600",
          )}
        >
          <Bell className="w-[18px] h-[18px]" />
        </button>
      )}
    </div>
  );
}
