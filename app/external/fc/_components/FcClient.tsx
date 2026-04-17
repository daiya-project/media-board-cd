"use client";

import { useMemo, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { toYearMonth, addMonths } from "@/lib/utils/date-utils";
import { deriveFcRows } from "@/lib/logic/external-fc-logic";
import WidgetPicker from "./WidgetPicker";
import FcTable from "./FcTable";
import type { ExternalFcPagePayload } from "@/types/fc";

interface Props {
  payload: ExternalFcPagePayload;
}

export default function FcClient({ payload }: Props) {
  const router = useRouter();
  const sp = useSearchParams();

  const latestMonth = toYearMonth(payload.latestDate);
  const currentMonth = payload.monthStart.slice(0, 7);
  const canGoPrev = currentMonth > "2025-01";
  const canGoNext = currentMonth < latestMonth;

  const navigate = useCallback(
    (patch: { widget?: string; month?: string }) => {
      const params = new URLSearchParams(sp.toString());
      if (patch.widget !== undefined) params.set("widget", patch.widget);
      if (patch.month !== undefined) params.set("month", patch.month);
      router.push(`/external/fc?${params.toString()}`);
    },
    [router, sp],
  );

  const rows = useMemo(() => {
    if (!payload.widgetId) return [];
    return deriveFcRows(
      payload.autoInputs,
      payload.unitPrices,
      payload.constants,
      payload.widgetId,
    );
  }, [payload]);

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-gray-800">FC 리포트</h2>
            <span className="text-xs font-medium text-gray-400 tabular-nums">
              {rows.length}일
            </span>
          </div>
          <WidgetPicker
            widgets={payload.widgets}
            selectedId={payload.widgetId}
            onSelect={(wid) => navigate({ widget: wid })}
          />
          <div className="flex items-center gap-1">
            <button
              onClick={() =>
                canGoPrev && navigate({ month: addMonths(currentMonth, -1) })
              }
              disabled={!canGoPrev}
              className="p-1.5 rounded-lg hover:bg-slate-200 disabled:opacity-30"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="h-9 px-4 rounded-lg border border-slate-200 bg-white text-sm font-semibold tabular-nums flex items-center">
              {currentMonth}
            </span>
            <button
              onClick={() =>
                canGoNext && navigate({ month: addMonths(currentMonth, 1) })
              }
              disabled={!canGoNext}
              className="p-1.5 rounded-lg hover:bg-slate-200 disabled:opacity-30"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
        <Link
          href="/external/fc/admin"
          className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center"
        >
          관리
        </Link>
      </div>

      {!payload.widgetId ? (
        <div className="flex items-center justify-center h-60 text-sm text-gray-500">
          좌측에서 widget 을 선택하세요
        </div>
      ) : (
        <FcTable rows={rows} />
      )}
    </>
  );
}
