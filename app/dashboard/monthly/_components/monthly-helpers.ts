/**
 * Dashboard Monthly 공용 포맷 유틸.
 * Today 보드의 today-chart-constants 의 패턴 일관성 유지.
 */

export const DASHBOARD_CHART_TICK_FONT_SIZE = 11 as const;
export const DASHBOARD_CHART_MARGIN = { top: 8, right: 8, left: 0, bottom: 0 } as const;
export const DASHBOARD_CHART_ANIMATION_DURATION = 700 as const;

export function formatKoreanAmount(value: number, decimals = 1): string {
  if (!Number.isFinite(value)) return "–";
  const abs = Math.abs(value);
  if (abs >= 100_000_000) return `${(value / 100_000_000).toFixed(decimals)}억`;
  if (abs >= 10_000) return `${(value / 10_000).toFixed(decimals)}만`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return Math.round(value).toLocaleString("ko-KR");
}

export function formatNumberWithCommas(value: number): string {
  if (!Number.isFinite(value)) return "–";
  return Math.round(value).toLocaleString("ko-KR");
}

export function formatPercent(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return "–";
  return `${value.toFixed(digits)}%`;
}

/** "+12.3%" / "-4.5%" / "–" 포맷. null/NaN/Infinity → null. */
export function formatRate(rate: number | null, digits = 1): string {
  if (rate === null || !Number.isFinite(rate)) return "–";
  const sign = rate > 0 ? "+" : "";
  return `${sign}${rate.toFixed(digits)}%`;
}

/** "+12,345" / "-4,567" 포맷. null/NaN → "–". */
export function formatChangeAmount(amount: number | null): string {
  if (amount === null || !Number.isFinite(amount)) return "–";
  const sign = amount > 0 ? "+" : "";
  return `${sign}${formatNumberWithCommas(amount)}`;
}

/** 변화율의 부호 + isHigherBetter 결합 색상 클래스. */
export function rateColorClass(
  rate: number | null,
  isHigherBetter: boolean,
): string {
  if (rate === null || rate === 0) return "bg-gray-100 text-gray-600";
  const isPositive = rate > 0;
  const isGood = isPositive === isHigherBetter;
  return isGood
    ? "bg-emerald-100 text-emerald-700"
    : "bg-rose-100 text-rose-700";
}
