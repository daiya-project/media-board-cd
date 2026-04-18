"use client";

import type {
  MetricKey,
  TodayBoard,
} from "@/lib/features/dashboard-today/aggregate";
import { TODAY_METRICS } from "./today-chart-constants";
import { TodayBigChart } from "./TodayBigChart";
import { TodayMiniChart } from "./TodayMiniChart";

interface Props {
  series: TodayBoard["series"];
  selectedMetric: MetricKey;
  onSelect: (metric: MetricKey) => void;
}

/** 큰 차트 (선택된 metric) + 우측 2x2 미니 차트 (나머지 4개). */
export function TodayStatusChartArea({
  series,
  selectedMetric,
  onSelect,
}: Props) {
  const minis = TODAY_METRICS.filter((m) => m.key !== selectedMetric);

  return (
    <div className="grid h-[420px] grid-cols-1 gap-4 lg:grid-cols-[65fr_35fr]">
      <div className="min-h-0">
        <TodayBigChart metric={selectedMetric} series={series[selectedMetric]} />
      </div>
      <div className="grid min-h-0 grid-cols-2 grid-rows-2 gap-3">
        {minis.map((m) => (
          <TodayMiniChart
            key={m.key}
            metric={m.key}
            series={series[m.key]}
            onClick={() => onSelect(m.key)}
          />
        ))}
      </div>
    </div>
  );
}
