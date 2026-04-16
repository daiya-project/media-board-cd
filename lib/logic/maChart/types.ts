/**
 * MA Chart — shared types, constants, and formatters.
 *
 * Used across entityLogic, chartDataLogic, miniCardLogic, and consumers.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MaMetricType = "ad_revenue" | "vimp" | "mfr" | "vctr" | "vrate";
export type MaWindow = 5 | 10 | 15 | 30 | 60;
export type MaDateRange = "15d" | "30d" | "90d" | "custom";

export interface MaEntityDailyData {
  cost_spent: number;
  ad_revenue: number;
  imp: number;
  vimp: number;
  cnt_click: number;
}

export interface MaEntitySeries {
  entityId: string;
  entityName: string;
  clientId: string;
  clientName: string;
  serviceId: string;
  serviceName: string;
  dailyData: Map<string, MaEntityDailyData>;
}

export interface MaChartDataPoint {
  date: string;
  label: string;
  actual: number | null;
  ma: number | null;
  gap: number | null;
  redBand: [number, number];
  blueBand: [number, number];
  isHoliday: boolean;
}

export interface MaMiniCardData {
  entityId: string;
  entityName: string;
  clientId: string;
  clientName: string;
  serviceId: string;
  serviceName: string;
  adRevenueSum: number;
  chartPoints: MaChartDataPoint[];
  latestActual: number | null;
  latestMa: number | null;
  latestGap: number | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const MA_METRICS: { value: MaMetricType; label: string }[] = [
  { value: "ad_revenue", label: "Rev." },
  { value: "vimp", label: "vIMP" },
  { value: "mfr", label: "MFR" },
  { value: "vctr", label: "vCTR" },
  { value: "vrate", label: "vRate" },
];

export const MA_METRIC_COLORS: Record<MaMetricType, string> = {
  ad_revenue: "#6366f1",
  vimp: "#10b981",
  mfr: "#ef4444",
  vctr: "#f59e0b",
  vrate: "#8b5cf6",
};

export const MA_METRIC_LABELS: Record<MaMetricType, string> = {
  ad_revenue: "Rev.",
  vimp: "vIMP",
  mfr: "MFR",
  vctr: "vCTR",
  vrate: "vRate",
};

export const MA_WINDOWS: MaWindow[] = [5, 10, 15, 30, 60];

export const MA_DATE_RANGES: { value: MaDateRange; label: string }[] = [
  { value: "15d", label: "15d" },
  { value: "30d", label: "30d" },
  { value: "90d", label: "90d" },
  { value: "custom", label: "ETC" },
];

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

/** Y-axis tick formatters per metric. */
export const MA_YAXIS_FORMATTERS: Record<MaMetricType, (v: number) => string> =
  {
    ad_revenue: (v) => {
      if (Math.abs(v) >= 100_000_000)
        return `${(v / 100_000_000).toFixed(0)}억`;
      if (Math.abs(v) >= 10_000) return `${(v / 10_000).toFixed(0)}만`;
      return `${v}`;
    },
    vimp: (v) => {
      if (Math.abs(v) >= 100_000_000)
        return `${(v / 100_000_000).toFixed(0)}억`;
      if (Math.abs(v) >= 10_000) return `${(v / 10_000).toFixed(0)}만`;
      return `${v}`;
    },
    mfr: (v) => `${v.toFixed(0)}%`,
    vctr: (v) => `${v.toFixed(2)}%`,
    vrate: (v) => `${v.toFixed(1)}%`,
  };

/** Tooltip / label formatters per metric. */
export const MA_METRIC_FORMATTERS: Record<
  MaMetricType,
  (v: number) => string
> = {
  ad_revenue: (v) => Math.round(v).toLocaleString("ko-KR"),
  vimp: (v) => Math.round(v).toLocaleString("ko-KR"),
  mfr: (v) => `${v.toFixed(2)}%`,
  vctr: (v) => `${v.toFixed(3)}%`,
  vrate: (v) => `${v.toFixed(2)}%`,
};

/**
 * Formats a gap percentage for display.
 * e.g. +12.3%, -5.1%
 */
export function formatGapPct(gap: number | null): string {
  if (gap == null || !isFinite(gap)) return "-";
  const sign = gap >= 0 ? "+" : "";
  return `${sign}${gap.toFixed(1)}%`;
}

/**
 * Returns a Tailwind text color class based on gap sign.
 */
export function gapColorClass(gap: number | null): string {
  if (gap == null || !isFinite(gap)) return "text-muted-foreground";
  if (gap > 0) return "text-red-500";
  if (gap < 0) return "text-blue-500";
  return "text-muted-foreground";
}

/** Formats "YYYY-MM-DD" → "MM/DD". */
export function dateLabelMD(date: string): string {
  return date.slice(5).replace("-", "/");
}
