/**
 * Data Board — Daily page (Server Component).
 *
 * Two-phase loading:
 *   Phase 2 (awaited): service-level data for initial 14 days + metadata.
 *   Phase 3 (client): widget-level data for all 90 days via API route.
 *
 * force-dynamic: required because Supabase SSR client reads cookies.
 */

import { Suspense } from "react";
import { getDataBoardQuickPayload } from "@/lib/api/dataBoardService";
import { TableSkeleton } from "@/components/common/PageSkeleton";
import { ErrorFallback } from "@/components/common/ErrorFallback";
import DataBoardClient from "../_components/DataBoardClient";

export const dynamic = "force-dynamic";

export default async function DailyPage() {
  const quickPayload = await getDataBoardQuickPayload().catch(
    (err: unknown) => {
      console.error("[DailyPage] getDataBoardQuickPayload error:", err);
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
      <Suspense fallback={<TableSkeleton cols={20} rows={15} />}>
        <DataBoardClient quickPayload={quickPayload} />
      </Suspense>
    </div>
  );
}
