"use client";

import { Eye, DollarSign, TrendingDown } from "lucide-react";
import type { MonthlyKpis } from "@/lib/features/dashboard-monthly/aggregate";
import { MonthlyKpiCard } from "./MonthlyKpiCard";

interface Props {
  kpis: MonthlyKpis;
}

export function MonthlyKpiCardGrid({ kpis }: Props) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <MonthlyKpiCard
        label="vIMP"
        icon={Eye}
        iconColor="oklch(0.696 0.17 162.48)"
        format="integer"
        isHigherBetter
        data={kpis.vimp}
      />
      <MonthlyKpiCard
        label="매출 (Ad Revenue)"
        icon={DollarSign}
        iconColor="#2563eb"
        format="integer"
        isHigherBetter
        data={kpis.revenue}
      />
      <MonthlyKpiCard
        label="MFR"
        icon={TrendingDown}
        iconColor="oklch(0.769 0.188 70.08)"
        format="percent"
        isHigherBetter={false}
        data={kpis.mfr}
      />
    </div>
  );
}
