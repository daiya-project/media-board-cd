/**
 * Table display utilities — className string factories for table elements.
 *
 * Responsibility: return CSS class strings only.
 * Label/text conversions belong in string-display-utils.ts.
 * Numeric value coloring belongs in number-display-utils.ts.
 */

import type { CSSProperties } from "react";
import type { DayType } from "@/lib/utils/date-utils";
import type { DataFilterType } from "@/types/app-db.types";

// ---------------------------------------------------------------------------
// Structural constants
// ---------------------------------------------------------------------------

/** Sticky table header row (thead). */
export const TABLE_THEAD_CLASS =
  "sticky top-0 z-10 bg-white border-b border-gray-200 shadow-[0_1px_0_0_#e5e7eb]";

/** Base class for sortable header cells (th). */
export const TABLE_TH_CLASS =
  "py-2 px-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wide cursor-pointer select-none hover:text-gray-800 transition-colors";

/** Skeleton placeholder cell content (div inside td). */
export const SKELETON_CELL_CLASS = "h-3 bg-gray-100 rounded animate-pulse";

/** Base class for table data cells (td). */
export const TABLE_TD_CLASS = "py-2.5 px-4";

/** Full-area empty state container shown when a table has no rows. */
export const EMPTY_STATE_CLASS =
  "flex-1 flex items-center justify-center text-sm text-gray-400";

// ---------------------------------------------------------------------------
// Sticky left columns
// ---------------------------------------------------------------------------

/** Fixed widths (px) for identifier columns that stick to the left edge. */
export const STICKY_COL_WIDTH = {
  client: 200,
  service: 180,
  widget_id: 100,
  widget_name: 160,
} as const;

export type StickyColName = keyof typeof STICKY_COL_WIDTH;

const STICKY_COL_ORDER: StickyColName[] = [
  "client",
  "service",
  "widget_id",
  "widget_name",
];

function isStickyColVisible(
  col: StickyColName,
  filterType: DataFilterType,
): boolean {
  if (col === "client") return true;
  if (col === "service") return filterType !== "client";
  return filterType === "widget";
}

/**
 * Returns inline styles for a sticky left column (th or td).
 * Header cells get a higher z-index so they stay above both sticky body cells
 * and the regular header row.
 *
 * @param filterType - Current filter mode (determines visible columns)
 * @param column     - Which identifier column
 * @param isHeader   - true for th cells, false for td cells
 */
export function getStickyColStyle(
  filterType: DataFilterType,
  column: StickyColName,
  isHeader: boolean,
): CSSProperties {
  let left = 0;
  for (const col of STICKY_COL_ORDER) {
    if (col === column) break;
    if (isStickyColVisible(col, filterType)) {
      left += STICKY_COL_WIDTH[col];
    }
  }
  return {
    position: "sticky",
    left,
    width: STICKY_COL_WIDTH[column],
    minWidth: STICKY_COL_WIDTH[column],
    maxWidth: STICKY_COL_WIDTH[column],
    zIndex: isHeader ? 20 : 2,
  };
}

/**
 * Returns true when this column is the last visible sticky column
 * (used to render the right-edge shadow separator).
 */
export function isLastStickyCol(
  filterType: DataFilterType,
  column: StickyColName,
): boolean {
  if (filterType === "client") return column === "client";
  if (filterType === "service") return column === "service";
  return column === "widget_name";
}

// ---------------------------------------------------------------------------
// Sort
// ---------------------------------------------------------------------------

/**
 * Returns the Tailwind text-color class for a sort icon.
 *
 * @param isActive - Whether this column is the currently sorted column
 * @returns `"text-blue-500"` when active, `"text-gray-300"` otherwise
 */
export function getSortIconColor(isActive: boolean): string {
  return isActive ? "text-blue-500" : "text-gray-300";
}

// ---------------------------------------------------------------------------
// Tier badge
// ---------------------------------------------------------------------------

const TIER_BADGE_BASE =
  "text-[0.65rem] px-2 py-0.5 rounded-full font-bold border";

const TIER_BADGE_MAP: Record<string, string> = {
  상: "bg-red-50 text-red-600 border-red-200",
  중: "bg-yellow-50 text-yellow-600 border-yellow-200",
  하: "bg-blue-50 text-blue-500 border-blue-200",
  기타: "bg-gray-100 text-gray-500 border-gray-200",
};

/**
 * Returns the full className string for a tier badge.
 * Falls back to "기타" style for unknown or null values.
 *
 * @param tier - Tier value from DB ("상" | "중" | "하" | "기타" | null)
 */
export function getTierBadgeClass(tier: string | null): string {
  const specific = TIER_BADGE_MAP[tier ?? ""] ?? TIER_BADGE_MAP["기타"];
  return `${TIER_BADGE_BASE} ${specific}`;
}

// ---------------------------------------------------------------------------
// Stage badge
// ---------------------------------------------------------------------------

/**
 * Returns the className string for a stage badge cell.
 *
 * - done / propose: pill with background
 * - meeting / contact: text-only
 * - null / unknown: muted gray
 *
 * @param stage - Stage value from DB ("done" | "propose" | "meeting" | "contact" | null)
 */
export function getStageBadgeClass(stage: string | null): string {
  if (!stage) return "text-gray-400";
  switch (stage) {
    case "done":
      return "text-xs font-medium bg-green-100 text-green-700 px-2 py-0.5 rounded";
    case "propose":
      return "text-xs font-medium bg-red-100 text-red-600 px-2 py-0.5 rounded";
    case "meeting":
      return "text-xs font-medium text-blue-500";
    case "contact":
      return "text-xs font-medium text-gray-500";
    case "memo":
      return "text-xs font-medium text-purple-500";
    default:
      return "text-xs text-gray-400";
  }
}

// ---------------------------------------------------------------------------
// Owner (manager) badge
// ---------------------------------------------------------------------------

const OWNER_BADGE_BASE =
  "text-[0.65rem] px-2 py-0.5 rounded-full border inline-block";

const OWNER_COLOR_MAP: Record<number, string> = {
  51: "text-green-700 bg-green-50 border-green-200",
  52: "text-yellow-700 bg-yellow-50 border-yellow-200",
  53: "text-blue-700 bg-blue-50 border-blue-200",
  54: "text-purple-700 bg-purple-50 border-purple-200",
};

/**
 * Returns the full className string for an owner (manager) badge.
 * Falls back to a neutral gray style for unrecognised manager IDs.
 *
 * @param managerId - Numeric manager ID from DB, or null
 */
export function getOwnerBadgeClass(managerId: number | null): string {
  const specific =
    managerId !== null && OWNER_COLOR_MAP[managerId]
      ? OWNER_COLOR_MAP[managerId]
      : "text-gray-500 bg-gray-50 border-gray-200";
  return `${OWNER_BADGE_BASE} ${specific}`;
}

// ---------------------------------------------------------------------------
// Follow-up button
// ---------------------------------------------------------------------------

/**
 * Returns the className string for the follow-up indicator button/span.
 *
 * @param hasFollowup - Whether the client has pending follow-ups
 */
export function getFollowupButtonClass(hasFollowup: boolean): string {
  return hasFollowup
    ? "inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-100 text-red-600 hover:bg-red-200 transition-colors cursor-pointer"
    : "inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 text-gray-400";
}

// ---------------------------------------------------------------------------
// Contact status badge
// ---------------------------------------------------------------------------

const CONTACT_STATUS_MAP: Record<string, { dot: string; text: string; bg: string }> = {
  overdue:  { dot: "bg-red-500",    text: "text-red-600",    bg: "bg-red-50" },
  urgent:   { dot: "bg-amber-500",  text: "text-amber-600",  bg: "bg-amber-50" },
  upcoming: { dot: "bg-blue-500",   text: "text-blue-600",   bg: "bg-blue-50" },
  ok:       { dot: "bg-gray-300",   text: "text-gray-500",   bg: "bg-gray-50" },
};

/**
 * Returns styling classes for a contact status indicator dot.
 *
 * @param status - Contact status value
 * @returns Object with dot, text, and bg className strings
 */
export function getContactStatusStyle(status: string | null): { dot: string; text: string; bg: string } {
  if (!status || !CONTACT_STATUS_MAP[status]) {
    return { dot: "bg-gray-200", text: "text-gray-300", bg: "" };
  }
  return CONTACT_STATUS_MAP[status];
}

// ---------------------------------------------------------------------------
// Row / item selection
// ---------------------------------------------------------------------------

/**
 * Returns the border + background className for a selectable list item or row.
 * Used in TrendList and similar interactive list components.
 *
 * @param isSelected - Whether this item is currently selected
 */
export function getRowSelectionClass(isSelected: boolean): string {
  return isSelected
    ? "border-2 border-blue-500 bg-blue-50"
    : "border border-gray-200 hover:shadow-sm hover:border-gray-300";
}

// ---------------------------------------------------------------------------
// Date column colors
// ---------------------------------------------------------------------------

/**
 * Returns the text-color class for a date column header (th).
 *
 * - Saturday → blue
 * - Sunday / public holiday → red (destructive)
 * - Weekday → "" (inherits default header color)
 *
 * @param dayType - Day type from getDayType()
 */
export function getDateHeaderColorClass(dayType: DayType): string {
  if (dayType === "saturday") return "text-blue-500";
  if (dayType === "sunday_or_holiday") return "text-destructive/80";
  return "";
}

/**
 * Returns the text-color class for a date data cell (td).
 *
 * - Zero / empty value → muted
 * - Saturday → blue (muted)
 * - Sunday / public holiday → muted foreground
 * - Weekday → default foreground
 *
 * @param dayType - Day type from getDayType()
 * @param isZero  - Whether the cell value is zero or absent
 */
export function getDateCellColorClass(dayType: DayType, isZero: boolean): string {
  if (isZero) return "text-muted-foreground/30";
  if (dayType === "saturday") return "text-blue-500/70";
  if (dayType === "sunday_or_holiday") return "text-muted-foreground/70";
  return "text-foreground/80";
}
