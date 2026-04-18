"use client";

import type { TodayBoard } from "@/lib/features/dashboard-today/aggregate";
import { TODAY_METRICS } from "./today-chart-constants";
import { TodayStatusCard } from "./TodayStatusCard";

interface Props {
  cards: TodayBoard["cards"];
}

/** 카드 5개 — 모바일 2열, md 3열, lg 5열. */
export function TodayStatusCards({ cards }: Props) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
      {TODAY_METRICS.map((m) => (
        <TodayStatusCard key={m.key} metric={m.key} data={cards[m.key]} />
      ))}
    </div>
  );
}
