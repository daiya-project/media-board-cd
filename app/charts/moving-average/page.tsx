/**
 * Moving Average chart page (Server Component).
 *
 * Two-phase loading:
 *   Phase 2 (await):  35 days service data + metadata → immediate render
 *   Phase 3 (client-side API fetch): 150 days service data → background replacement
 *
 * Phase 3 is NOT passed as a Promise prop to avoid RSC stream blocking
 * (which would prevent navigation to other sections until the stream completes).
 *
 * Widget-level data is loaded on demand via API route.
 */

import { Suspense } from "react";
import { getMaChartQuickPayload } from "@/lib/api/maChartService";
import { EmptyState } from "@/components/common/EmptyState";
import { ChartSkeleton } from "@/components/common/PageSkeleton";
import MovingAverageClient from "./_components/MovingAverageClient";

export const dynamic = "force-dynamic";

function MAPageSkeleton() {
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

export default async function MovingAveragePage() {
  // Phase 2: await — 35 days service data + metadata (fast, ~200ms)
  const quickPayload = await getMaChartQuickPayload().catch(
    (err: unknown) => {
      console.error("[MovingAveragePage] getMaChartQuickPayload error:", err);
      return null;
    },
  );

  if (!quickPayload || quickPayload.allDates.length === 0) {
    return <EmptyState className="flex-1" />;
  }

  return (
    <div className="flex flex-col h-full max-w-[1920px] mx-auto">
      <Suspense fallback={<MAPageSkeleton />}>
        <MovingAverageClient quickPayload={quickPayload} />
      </Suspense>
    </div>
  );
}
