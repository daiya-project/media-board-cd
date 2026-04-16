/**
 * Data Chart page (Server Component).
 *
 * Two-phase loading (reuses MA chart data service):
 *   Phase 2 (await):  35 days service data + metadata → immediate render
 *   Phase 3 (client-side API fetch): 150 days service data → background replacement
 *
 * Phase 3 is NOT passed as a Promise prop to avoid RSC stream blocking.
 * Widget-level data is loaded on demand via API route.
 */

import { Suspense } from "react";
import { getMaChartQuickPayload } from "@/lib/api/maChartService";
import { EmptyState } from "@/components/common/EmptyState";
import { ChartSkeleton } from "@/components/common/PageSkeleton";
import DataChartClient from "./_components/DataChartClient";

export const dynamic = "force-dynamic";

function DataChartPageSkeleton() {
  return (
    <div className="px-6 space-y-4 py-2">
      <div className="h-8 w-64 bg-gray-100 rounded animate-pulse" />
      <ChartSkeleton />
      <div className="grid grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="h-32 bg-gray-100 rounded-lg animate-pulse"
          />
        ))}
      </div>
    </div>
  );
}

export default async function DataChartPage() {
  // Phase 2: await — 35 days service data + metadata (fast, ~200ms)
  const quickPayload = await getMaChartQuickPayload().catch(
    (err: unknown) => {
      console.error("[DataChartPage] getMaChartQuickPayload error:", err);
      return null;
    },
  );

  if (!quickPayload || quickPayload.allDates.length === 0) {
    return <EmptyState className="flex-1" />;
  }

  return (
    <div className="flex flex-col h-full max-w-[1920px] mx-auto">
      <Suspense fallback={<DataChartPageSkeleton />}>
        <DataChartClient quickPayload={quickPayload} />
      </Suspense>
    </div>
  );
}
