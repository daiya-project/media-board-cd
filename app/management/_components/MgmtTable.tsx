"use client";

import { useState, useMemo } from "react";
import {
  TABLE_THEAD_CLASS,
  SKELETON_CELL_CLASS,
} from "@/lib/utils/table-display-utils";
import {
  cycleSortDirection,
  type SortState,
} from "@/lib/utils/sort-utils";
import type { MgmtTableRow } from "@/types/app-db.types";
import { EmptyTableRow } from "@/components/common/EmptyState";
import MgmtTableRowComponent, {
  MgmtTableRowSkeleton,
} from "./MgmtTableRow";
import { type SortField, sortRows, Th } from "./MgmtTableSort";

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface Props {
  initialData: MgmtTableRow[];
}

/**
 * MGMT management table with client-side column sorting.
 * Receives server-fetched data as props; sort state lives in useState.
 */
export default function MgmtTable({ initialData }: Props) {
  const [sort, setSort] = useState<SortState<SortField>>({
    field: null,
    direction: "none",
  });

  function handleSort(field: SortField) {
    setSort((prev) => cycleSortDirection(prev, field));
  }

  const rows = useMemo(
    () => sortRows(initialData, sort),
    [initialData, sort],
  );

  const thProps = { sort, onSort: handleSort };

  return (
    <div className="flex-1 overflow-auto m-4 rounded-xl border border-border shadow-sm">
      <table className="w-max min-w-full border-collapse text-sm">
        <thead className={TABLE_THEAD_CLASS}>
          <tr>
            <Th
              {...thProps}
              field="contactStatus"
              style={{ width: 60, minWidth: 60 }}
            >
              상태
            </Th>
            <Th
              {...thProps}
              field="lastDate"
              style={{ width: 100, minWidth: 100 }}
            >
              DATE
            </Th>
            <Th
              {...thProps}
              field="product"
              style={{ width: 80, minWidth: 80 }}
            >
              매중도
            </Th>
            <Th
              {...thProps}
              field="client"
              style={{ width: 250, minWidth: 250 }}
            >
              CLIENT
            </Th>
            <Th
              {...thProps}
              field="count"
              style={{ width: 80, minWidth: 80 }}
            >
              History
            </Th>
            <Th
              {...thProps}
              field="followup"
              style={{ width: 80, minWidth: 80 }}
            >
              F/up
            </Th>
            <Th
              {...thProps}
              field="owner"
              style={{ width: 100, minWidth: 100 }}
            >
              담당자
            </Th>
            <Th
              {...thProps}
              field="currentStage"
              style={{ width: 120, minWidth: 120 }}
            >
              STAGE
            </Th>
            <Th
              {...thProps}
              field="lastMemo"
              style={{ width: 300, minWidth: 300 }}
            >
              MEMO
            </Th>
            <Th
              {...thProps}
              field="contactName"
              style={{ width: 150, minWidth: 150 }}
            >
              NAME
            </Th>
            <Th
              {...thProps}
              field="contactPhone"
              style={{ width: 150, minWidth: 150 }}
            >
              PHONE
            </Th>
            <Th
              {...thProps}
              field="contactEmail"
              style={{ width: 200, minWidth: 200 }}
            >
              E-MAIL
            </Th>
            <Th
              {...thProps}
              field="daysRemaining"
              style={{ width: 80, minWidth: 80 }}
            >
              D-Day
            </Th>
          </tr>
        </thead>

        <tbody>
          {rows.length === 0 ? (
            <EmptyTableRow colSpan={13} />
          ) : (
            rows.map((row) => (
              <MgmtTableRowComponent key={row.client_id} row={row} />
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

export function MgmtTableSkeleton() {
  return (
    <div className="flex-1 overflow-auto m-4 rounded-xl border border-border shadow-sm">
      <table className="w-max min-w-full border-collapse text-sm">
        <thead className={TABLE_THEAD_CLASS}>
          <tr>
            {[60, 100, 80, 250, 80, 80, 100, 120, 300, 150, 150, 200, 80].map(
              (w, i) => (
                <th key={i} style={{ width: w, minWidth: w }} className="py-2 px-2">
                  <div className={SKELETON_CELL_CLASS} />
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 12 }).map((_, i) => (
            <MgmtTableRowSkeleton key={i} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
