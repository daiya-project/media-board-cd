/**
 * Data Board — Monthly page (Server Component).
 *
 * Two-phase loading:
 *   Phase 2 (awaited): first 3 months from v_monthly MV.
 *   Phase 3 (client): all months via /api/data-board/monthly API route.
 *
 * force-dynamic: required because Supabase SSR client reads cookies.
 */

import { Suspense } from "react";
import { getMonthlyQuickPayload } from "@/lib/api/dataBoardService";
import { TableSkeleton } from "@/components/common/PageSkeleton";
import { ErrorFallback } from "@/components/common/ErrorFallback";
import MonthlyClient from "../_components/MonthlyClient";

export const dynamic = "force-dynamic";

export default async function MonthlyPage() {
  const quickPayload = await getMonthlyQuickPayload().catch(
    (err: unknown) => {
      console.error("[MonthlyPage] getMonthlyQuickPayload error:", err);
      return null;
    },
  );

  if (!quickPayload) {
    return (
      <ErrorFallback className="flex-col h-full max-w-[1920px] mx-auto" />
    );
  }

  return (
    <div className="flex flex-col h-full max-w-[1920px] mx-auto">
      <Suspense fallback={<TableSkeleton cols={10} rows={15} />}>
        <MonthlyClient quickPayload={quickPayload} />
      </Suspense>
    </div>
  );
}
