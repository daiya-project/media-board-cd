"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  MetricKey,
  TodayBoard,
} from "@/lib/features/dashboard-today/aggregate";
import { TodayStatusCards } from "./TodayStatusCards";
import { TodayStatusChartArea } from "./TodayStatusChartArea";

interface Props {
  initialData: TodayBoard | null;
  errorMessage?: string | null;
}

export function TodayStatusBoard({ initialData, errorMessage }: Props) {
  const [selectedMetric, setSelectedMetric] = useState<MetricKey>("revenue");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleRefresh() {
    startTransition(() => router.refresh());
  }

  const board = initialData;

  return (
    <section className="rounded-lg border border-gray-200 bg-gray-50/50 p-6">
      <header className="mb-4 flex items-center justify-between">
        <div className="flex items-baseline gap-3">
          <h2 className="text-xl font-bold text-gray-800">Today Status</h2>
          {board && (
            <span className="text-sm text-gray-500">
              {board.referenceTime} 기준
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          aria-label="새로고침"
          disabled={isPending}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm transition-colors",
            "hover:bg-gray-50 disabled:opacity-50",
          )}
        >
          <RefreshCw className={cn("size-4", isPending && "animate-spin")} />
          새로고침
        </button>
      </header>

      {errorMessage && !board && (
        <div className="flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <AlertCircle className="size-4 shrink-0" />
          오늘 데이터를 가져올 수 없습니다: {errorMessage}
        </div>
      )}

      {board && (
        <div className="space-y-6">
          <TodayStatusCards cards={board.cards} />
          <TodayStatusChartArea
            series={board.series}
            selectedMetric={selectedMetric}
            onSelect={setSelectedMetric}
          />
        </div>
      )}
    </section>
  );
}
