/**
 * Today Status Board metric metadata + 비교 라인 색 + 차트 공통 상수.
 *
 * - format: "integer" → 큰 정수 (revenue/vimp), "decimal1" → CPC 같은 소수 1자리,
 *           "percent" → vCTR/MFR 처럼 percent suffix
 * - projection: cumulative 지표 (revenue/vimp) 만 true
 */

import type { MetricKey } from "@/lib/features/dashboard-today/aggregate";

export type ValueFormat = "integer" | "decimal1" | "percent";

export interface MetricConfig {
  key: MetricKey;
  label: string;
  color: string;
  format: ValueFormat;
  projection: boolean;
}

export const TODAY_METRICS: readonly MetricConfig[] = [
  { key: "revenue", label: "Revenue", color: "var(--primary)", format: "integer",  projection: true  },
  { key: "vimp",    label: "vIMP",    color: "var(--chart-2)", format: "integer",  projection: true  },
  { key: "cpc",     label: "CPC",     color: "var(--chart-3)", format: "integer",  projection: false },
  { key: "vctr",    label: "vCTR",    color: "var(--chart-4)", format: "percent",  projection: false },
  { key: "mfr",     label: "MFR",     color: "var(--chart-5)", format: "percent",  projection: false },
] as const;

/** 모든 차트가 공유하는 비교 라인 색 — 오늘/전일/지난 평일 평균.
 *  오늘 = 파랑 (브랜드, 주인공 라인), 전일 = 오렌지 (보색 대비), 평균 = 회색 (배경). */
export const COMPARISON_LINE_COLORS = {
  today: "#2563eb",
  yesterday: "oklch(0.7 0.15 55)",
  pastWeekdayAvg: "oklch(0.85 0.005 286)",
} as const;

export function getMetricConfig(key: MetricKey): MetricConfig {
  const found = TODAY_METRICS.find((m) => m.key === key);
  if (!found) throw new Error(`Unknown metric key: ${key}`);
  return found;
}

export function formatMetricValue(value: number, format: ValueFormat): string {
  if (!Number.isFinite(value)) return "–";
  if (format === "integer") return Math.round(value).toLocaleString("ko-KR");
  if (format === "decimal1") return value.toFixed(1);
  return `${value.toFixed(2)}%`;
}

/** 큰 수치를 한국식 축약 (1.2억 / 3.4만). 차트 Y축 tick formatter 용. */
export function formatKoreanAmount(value: number, decimals = 1): string {
  if (!Number.isFinite(value)) return "–";
  const abs = Math.abs(value);
  if (abs >= 100_000_000) return `${(value / 100_000_000).toFixed(decimals)}억`;
  if (abs >= 10_000) return `${(value / 10_000).toFixed(decimals)}만`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return Math.round(value).toLocaleString("ko-KR");
}

/** 변화율 (%) — base 가 0/null 이거나 NaN 이면 null. */
export function calcChangeRate(current: number, base: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(base) || base === 0) return null;
  return ((current - base) / base) * 100;
}

/** 차트 공통 상수 — Monthly/Weekly 차트와 시각적 일관성. */
export const DASHBOARD_CHART_TICK_FONT_SIZE = 11 as const;
export const DASHBOARD_CHART_MARGIN = { top: 8, right: 8, left: 0, bottom: 0 } as const;
export const DASHBOARD_CHART_ANIMATION_DURATION = 700 as const;
