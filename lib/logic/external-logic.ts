/**
 * External report business logic.
 *
 * Combines internal daily data with external settlement data
 * using the external_mapping table for widget_id matching.
 */

import type {
  ExternalDailyRow,
  ExternalMappingRow,
  ExternalCombinedRow,
  ExternalValueRow,
  UnitPriceValue,
  MetricGroup,
  ExternalSource,
} from "@/types/external";
import type { DailyRawRow } from "@/types/app-db.types";
import { findUnitPriceForDate } from "./external-unit-price";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ZERO_METRICS: MetricGroup = { imp: 0, revenue: 0, ctr: 0 };

/** Calculates CTR as percentage. */
function calcCtr(click: number, imp: number): number {
  if (imp === 0) return 0;
  return Number(((click / imp) * 100).toFixed(2));
}

/** Builds a metric group from imp/click/revenue. */
function buildMetrics(
  imp: number,
  click: number,
  revenue: number,
): MetricGroup {
  return { imp, revenue, ctr: calcCtr(click, imp) };
}

/**
 * Creates a composite key for matching external rows to mappings.
 * KL Media: source + external_widget_name
 * SyncMedia: source + external_service_name (matched via company_uid in mapping)
 */
function externalRowKey(row: ExternalDailyRow): string {
  if (row.source === "klmedia") {
    return `klmedia:${row.external_widget_name || row.external_service_name}`;
  }
  return `syncmedia:${row.external_service_name}`;
}

// ---------------------------------------------------------------------------
// Combine Logic
// ---------------------------------------------------------------------------

/**
 * Combines external daily data with internal daily data using mapping table.
 *
 * @param externalRows - Rows from media.external_daily
 * @param mappings - Rows from media.external_mapping
 * @param internalRows - Rows from media.v_daily (internal widget-level data)
 * @returns Combined rows with internal, external, and total metric groups
 */
export function combineExternalWithInternal(
  externalRows: ExternalDailyRow[],
  mappings: ExternalMappingRow[],
  internalRows: DailyRawRow[],
  unitPrices: ExternalValueRow[] = [],
): ExternalCombinedRow[] {
  // Build mapping lookup: "source:external_key" -> mapping row
  const mappingMap = new Map<string, ExternalMappingRow>();
  for (const m of mappings) {
    mappingMap.set(`${m.source}:${m.external_key}`, m);
  }

  // Build internal data lookup: "date:widget_id" -> aggregated metrics
  const internalMap = new Map<
    string,
    { imp: number; click: number; revenue: number }
  >();
  for (const row of internalRows) {
    if (!row.widget_id) continue;
    const key = `${row.date}:${row.widget_id}`;
    const existing = internalMap.get(key);
    if (existing) {
      existing.imp += row.imp ?? 0;
      existing.click += row.cnt_click ?? 0;
      existing.revenue += row.ad_revenue ?? 0;
    } else {
      internalMap.set(key, {
        imp: row.imp ?? 0,
        click: row.cnt_click ?? 0,
        revenue: row.ad_revenue ?? 0,
      });
    }
  }

  // Build unit price lookup: widget_id -> prices (sorted by start_date asc)
  const pricesByWidget = new Map<string, ExternalValueRow[]>();
  for (const p of unitPrices) {
    const arr = pricesByWidget.get(p.widget_id) ?? [];
    arr.push(p);
    pricesByWidget.set(p.widget_id, arr);
  }

  // Combine: iterate external rows, find matching internal via mapping
  const results: ExternalCombinedRow[] = [];

  for (const ext of externalRows) {
    const rowKey = externalRowKey(ext);
    const mapping = mappingMap.get(rowKey);
    const widgetId = mapping?.widget_id ?? null;
    const label =
      mapping?.label ||
      ext.external_widget_name ||
      ext.external_service_name;

    // External metrics
    const extMetrics = buildMetrics(ext.imp, ext.click, ext.revenue);

    // Internal metrics (if mapped)
    let intMetrics = { ...ZERO_METRICS };
    let intClick = 0;
    if (widgetId) {
      const intData = internalMap.get(`${ext.date}:${widgetId}`);
      if (intData) {
        intMetrics = buildMetrics(intData.imp, intData.click, intData.revenue);
        intClick = intData.click;
      }
    }

    // Total metrics
    const totalImp = intMetrics.imp + ext.imp;
    const totalClick = intClick + ext.click;
    const totalRevenue = intMetrics.revenue + ext.revenue;
    const totalMetrics = buildMetrics(totalImp, totalClick, totalRevenue);

    // Unit price matching
    const prices = widgetId ? pricesByWidget.get(widgetId) ?? [] : [];
    const priceValue = findUnitPriceForDate(prices, ext.date);
    const unitPrice =
      Object.keys(priceValue).length === 0 ? undefined : priceValue;

    results.push({
      date: ext.date,
      label,
      source: ext.source,
      widget_id: widgetId,
      internal: intMetrics,
      external: extMetrics,
      total: totalMetrics,
      unitPrice,
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// CPM Period Detection
// ---------------------------------------------------------------------------

/** Detected CPM period for a widget. */
export interface DetectedCpmPeriod {
  widget_id: string;
  source: ExternalSource;
  cpm: number;
  start_date: string;
  end_date: string | null;
}

/**
 * Rounds a CPM value to the nearest 10 KRW.
 * Unit prices change in increments of at least 10 KRW.
 */
function roundCpm10(cpm: number): number {
  return Math.round(cpm / 10) * 10;
}

/**
 * Detects CPM change periods from external daily data.
 *
 * For each mapped widget, calculates daily CPM (revenue / imp * 1000),
 * rounds to nearest 10 KRW, and groups consecutive days with the same CPM
 * into periods. The last period for each widget has end_date = null.
 *
 * @param externalRows - Rows from media.external_daily
 * @param mappings - Rows from media.external_mapping (only those with widget_id)
 * @returns Array of detected CPM periods, sorted by widget_id then start_date
 */
export function detectCpmPeriods(
  externalRows: ExternalDailyRow[],
  mappings: ExternalMappingRow[],
): DetectedCpmPeriod[] {
  // Build mapping lookup: "source:external_key" -> { widget_id, source }
  const mappingMap = new Map<string, { widget_id: string; source: ExternalSource }>();
  for (const m of mappings) {
    if (!m.widget_id) continue;
    mappingMap.set(`${m.source}:${m.external_key}`, {
      widget_id: m.widget_id,
      source: m.source,
    });
  }

  // Group daily data by widget_id, aggregate imp/revenue per date
  const widgetDailyMap = new Map<
    string,
    { source: ExternalSource; days: Map<string, { imp: number; revenue: number }> }
  >();

  for (const row of externalRows) {
    const key =
      row.source === "klmedia"
        ? `klmedia:${row.external_widget_name || row.external_service_name}`
        : `syncmedia:${row.external_service_name}`;

    const mapping = mappingMap.get(key);
    if (!mapping) continue;

    let entry = widgetDailyMap.get(mapping.widget_id);
    if (!entry) {
      entry = { source: mapping.source, days: new Map() };
      widgetDailyMap.set(mapping.widget_id, entry);
    }

    const existing = entry.days.get(row.date);
    if (existing) {
      existing.imp += row.imp;
      existing.revenue += row.revenue;
    } else {
      entry.days.set(row.date, { imp: row.imp, revenue: row.revenue });
    }
  }

  // Detect CPM periods per widget
  const results: DetectedCpmPeriod[] = [];

  for (const [widgetId, entry] of widgetDailyMap) {
    // Sort dates ascending
    const sortedDates = [...entry.days.keys()].sort();

    let currentCpm: number | null = null;
    let periodStart: string | null = null;
    let prevDate: string | null = null;

    for (const date of sortedDates) {
      const day = entry.days.get(date)!;
      // Skip days with no impressions (can't calculate CPM)
      if (day.imp === 0) continue;

      const cpm = roundCpm10((day.revenue / day.imp) * 1000);

      if (currentCpm === null || cpm !== currentCpm) {
        // Close previous period
        if (currentCpm !== null && periodStart !== null && prevDate !== null) {
          results.push({
            widget_id: widgetId,
            source: entry.source,
            cpm: currentCpm,
            start_date: periodStart,
            end_date: prevDate,
          });
        }
        // Start new period
        currentCpm = cpm;
        periodStart = date;
      }
      prevDate = date;
    }

    // Close final period (end_date = null → currently active)
    if (currentCpm !== null && periodStart !== null) {
      results.push({
        widget_id: widgetId,
        source: entry.source,
        cpm: currentCpm,
        start_date: periodStart,
        end_date: null,
      });
    }
  }

  // Sort by widget_id, then start_date
  results.sort((a, b) =>
    a.widget_id !== b.widget_id
      ? a.widget_id.localeCompare(b.widget_id)
      : a.start_date.localeCompare(b.start_date),
  );

  return results;
}

/**
 * Converts detected CPM periods to external_value insert rows.
 * Sets the source-specific key in the JSONB value field.
 */
export function cpmPeriodsToValueRows(
  periods: DetectedCpmPeriod[],
): Array<{
  widget_id: string;
  value: UnitPriceValue;
  start_date: string;
  end_date: string | null;
}> {
  return periods.map((p) => ({
    widget_id: p.widget_id,
    value: { [p.source]: p.cpm } as UnitPriceValue,
    start_date: p.start_date,
    end_date: p.end_date,
  }));
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

/** Per-source (company) summary. */
export interface SourceSummary {
  imp: number;
  revenue: number;
  labelCount: number;
}

/** Overall summary returned by computeExternalSummary. */
export interface ExternalSummary {
  totalImp: number;
  totalRevenue: number;
  widgetCount: number;
  bySource: Record<string, SourceSummary>;
}

/**
 * Computes summary KPI totals from combined rows, with per-source breakdown.
 */
export function computeExternalSummary(rows: ExternalCombinedRow[]): ExternalSummary {
  let totalImp = 0;
  let totalRevenue = 0;
  const labelSet = new Set<string>();

  const sourceMap = new Map<string, { imp: number; revenue: number; labels: Set<string> }>();

  for (const row of rows) {
    totalImp += row.total.imp;
    totalRevenue += row.total.revenue;
    labelSet.add(row.label);

    const entry = sourceMap.get(row.source);
    if (entry) {
      entry.imp += row.external.imp;
      entry.revenue += row.external.revenue;
      entry.labels.add(row.label);
    } else {
      sourceMap.set(row.source, {
        imp: row.external.imp,
        revenue: row.external.revenue,
        labels: new Set([row.label]),
      });
    }
  }

  const bySource: Record<string, SourceSummary> = {};
  for (const [source, entry] of sourceMap) {
    bySource[source] = {
      imp: entry.imp,
      revenue: entry.revenue,
      labelCount: entry.labels.size,
    };
  }

  return { totalImp, totalRevenue, widgetCount: labelSet.size, bySource };
}
