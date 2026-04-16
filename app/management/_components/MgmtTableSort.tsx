"use client";

import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getSortIconColor,
  TABLE_TH_CLASS,
} from "@/lib/utils/table-display-utils";
import {
  compareNullable,
  type SortState,
} from "@/lib/utils/sort-utils";
import { extractPlainText } from "@/lib/utils/blocknote-utils";
import type { MgmtTableRow } from "@/types/app-db.types";

// ---------------------------------------------------------------------------
// Sort types
// ---------------------------------------------------------------------------

export type SortField =
  | "contactStatus"
  | "lastDate"
  | "product"
  | "client"
  | "count"
  | "followup"
  | "owner"
  | "currentStage"
  | "lastMemo"
  | "contactName"
  | "contactPhone"
  | "contactEmail"
  | "daysRemaining";

// ---------------------------------------------------------------------------
// Sort logic (mirrors mgmt-state.ts from reference)
// ---------------------------------------------------------------------------

const TIER_ORDER: Record<string, number> = { 상: 1, 중: 2, 하: 3, 기타: 4 };
const STAGE_ORDER: Record<string, number> = {
  contact: 1,
  meeting: 2,
  propose: 3,
  done: 4,
};

/**
 * Sorts MGMT table rows by the given field and direction.
 */
export function sortRows(
  data: MgmtTableRow[],
  sort: SortState<SortField>,
): MgmtTableRow[] {
  if (sort.direction === "none" || sort.field === null) return data;

  const multiplier = sort.direction === "asc" ? 1 : -1;

  return [...data].sort((a, b) => {
    let va: string | number | null;
    let vb: string | number | null;

    switch (sort.field) {
      case "contactStatus": {
        const STATUS_ORDER: Record<string, number> = { overdue: 1, urgent: 2, upcoming: 3, ok: 4 };
        va = STATUS_ORDER[a.contactStatus ?? ""] ?? 5;
        vb = STATUS_ORDER[b.contactStatus ?? ""] ?? 5;
        break;
      }
      case "daysRemaining":
        va = a.daysRemaining ?? 9999;
        vb = b.daysRemaining ?? 9999;
        break;
      case "lastDate":
        va = a.lastDate ?? "";
        vb = b.lastDate ?? "";
        break;
      case "product":
        va = TIER_ORDER[a.tier ?? ""] ?? 5;
        vb = TIER_ORDER[b.tier ?? ""] ?? 5;
        break;
      case "client":
        va = a.client_name.toLowerCase();
        vb = b.client_name.toLowerCase();
        break;
      case "count":
        va = a.actionCount;
        vb = b.actionCount;
        break;
      case "followup":
        va = a.followupCount;
        vb = b.followupCount;
        break;
      case "owner":
        va = a.managerName?.toLowerCase() ?? "";
        vb = b.managerName?.toLowerCase() ?? "";
        break;
      case "currentStage":
        va = STAGE_ORDER[a.currentStage ?? ""] ?? 5;
        vb = STAGE_ORDER[b.currentStage ?? ""] ?? 5;
        break;
      case "lastMemo":
        va = extractPlainText(a.lastMemo).toLowerCase();
        vb = extractPlainText(b.lastMemo).toLowerCase();
        break;
      case "contactName":
        va = a.contact_name?.toLowerCase() ?? "";
        vb = b.contact_name?.toLowerCase() ?? "";
        break;
      case "contactPhone":
        va = a.contact_phone ?? "";
        vb = b.contact_phone ?? "";
        break;
      case "contactEmail":
        va = a.contact_email?.toLowerCase() ?? "";
        vb = b.contact_email?.toLowerCase() ?? "";
        break;
      default:
        return 0;
    }

    return compareNullable(va, vb, multiplier);
  });
}

// ---------------------------------------------------------------------------
// SortIcon
// ---------------------------------------------------------------------------

function SortIcon({ field, sort }: { field: SortField; sort: SortState<SortField> }) {
  const isActive = sort.field === field && sort.direction !== "none";
  const colorClass = getSortIconColor(isActive);
  if (isActive && sort.direction === "asc")
    return <ChevronUp className={cn("w-3 h-3 ml-0.5", colorClass)} />;
  if (isActive && sort.direction === "desc")
    return <ChevronDown className={cn("w-3 h-3 ml-0.5", colorClass)} />;
  return <ChevronsUpDown className={cn("w-3 h-3 ml-0.5", colorClass)} />;
}

// ---------------------------------------------------------------------------
// Sortable header cell
// ---------------------------------------------------------------------------

interface ThProps {
  field: SortField;
  sort: SortState<SortField>;
  onSort: (f: SortField) => void;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Sortable table header cell with click-to-sort and sort icon.
 */
export function Th({ field, sort, onSort, children, className, style }: ThProps) {
  return (
    <th
      className={cn(TABLE_TH_CLASS, className)}
      style={style}
      onClick={() => onSort(field)}
    >
      <div className="flex items-center justify-center gap-0.5">
        {children}
        <SortIcon field={field} sort={sort} />
      </div>
    </th>
  );
}
