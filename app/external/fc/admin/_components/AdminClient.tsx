"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, RefreshCw } from "lucide-react";
import UnitPriceEditor from "./UnitPriceEditor";
import type { ExternalValueRow } from "@/types/external";
import type { ExternalFcPagePayload } from "@/types/fc";

interface Props {
  widgets: ExternalFcPagePayload["widgets"];
  values: ExternalValueRow[];
}

export default function AdminClient({ widgets, values }: Props) {
  const [selected, setSelected] = useState<string | null>(
    widgets[0]?.widget_id ?? null,
  );
  const rows = useMemo(
    () => values.filter((v) => v.widget_id === selected),
    [values, selected],
  );

  return (
    <>
      <div className="flex items-center gap-3">
        <Link
          href="/external/fc"
          className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <h2 className="text-base font-bold text-gray-800">FC 관리</h2>
        <span className="text-xs text-gray-400">
          external_value 이력 / 계약 CPM / FC 금액
        </span>
        <button
          onClick={async () => {
            // NOTE: /api/fc/sync 는 Task 10 에서 구현 예정. 구현 전까지는 404 응답 예상.
            const res = await fetch("/api/fc/sync?sync=true", { method: "POST" });
            const j = await res.json().catch(() => ({}));
            alert(
              res.ok
                ? `동기화 완료: checked=${j.result?.widgetsChecked ?? "?"}, inserted=${j.result?.widgetsInserted ?? "?"}, failures=${j.result?.failures ?? "?"}`
                : `동기화 실패: ${j.error ?? res.status}`,
            );
            location.reload();
          }}
          className="ml-auto h-8 px-3 rounded-lg border border-slate-200 text-xs font-medium hover:bg-slate-50 flex items-center gap-1"
        >
          <RefreshCw className="w-3 h-3" />
          지금 동기화
        </button>
      </div>

      <div className="grid grid-cols-[280px_1fr] gap-4 h-[calc(100vh-160px)]">
        <div className="border border-slate-200 rounded-lg bg-white overflow-y-auto">
          <div className="p-2 text-xs font-semibold text-slate-500 border-b">
            관리 대상 ({widgets.length})
          </div>
          {widgets.map((w) => (
            <button
              key={w.widget_id}
              onClick={() => setSelected(w.widget_id)}
              className={
                "w-full text-left px-3 py-2 text-xs border-b border-slate-100 hover:bg-slate-50 " +
                (selected === w.widget_id ? "bg-blue-50 font-medium" : "")
              }
            >
              <div className="truncate">{w.label}</div>
              <div className="text-[10px] text-slate-400 font-mono">
                {w.widget_id}
              </div>
            </button>
          ))}
        </div>

        <div className="border border-slate-200 rounded-lg bg-white overflow-y-auto">
          {selected ? (
            <UnitPriceEditor widgetId={selected} rows={rows} />
          ) : (
            <div className="flex items-center justify-center h-full text-sm text-slate-400">
              위젯을 선택하세요
            </div>
          )}
        </div>
      </div>
    </>
  );
}
