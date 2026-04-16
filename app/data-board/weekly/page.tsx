/**
 * Data Board — Weekly page (Server Component).
 *
 * Two-phase loading:
 *   Phase 2 (awaited): first 8 weeks from v_weekly MV + holidays.
 *   Phase 3 (client): all weeks via /api/data-board/weekly API route.
 *
 * force-dynamic: required because Supabase SSR client reads cookies.
 */

import { Suspense } from "react";
import { getWeeklyQuickPayload } from "@/lib/api/dataBoardService";
import { TableSkeleton } from "@/components/common/PageSkeleton";
import { ErrorFallback } from "@/components/common/ErrorFallback";
import WeeklyClient from "../_components/WeeklyClient";

export const dynamic = "force-dynamic";

export default async function WeeklyPage() {
  const quickPayload = await getWeeklyQuickPayload().catch(
    (err: unknown) => {
      console.error("[WeeklyPage] getWeeklyQuickPayload error:", err);
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
      <Suspense fallback={<TableSkeleton cols={14} rows={15} />}>
        <WeeklyClient quickPayload={quickPayload} />
      </Suspense>
    </div>
  );
}
