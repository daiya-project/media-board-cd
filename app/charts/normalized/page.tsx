/**
 * Normalized chart page (Server Component).
 *
 * Min-max normalizes Ad Revenue, vIMP, and MFR to a 0–100 scale,
 * allowing cross-metric trend comparison on a single chart.
 */

import { Suspense } from "react";
import { getBoardQuickPayload } from "@/lib/api/boardService";
import { ChartSkeleton } from "@/components/common/PageSkeleton";
import { EmptyState } from "@/components/common/EmptyState";
import NormalizedClient from "./_components/NormalizedClient";

export const dynamic = "force-dynamic";

function NormPageSkeleton() {
  return (
    <div className="px-6 space-y-4 py-2">
      <div className="h-8 w-64 bg-gray-100 rounded animate-pulse" />
      <ChartSkeleton />
    </div>
  );
}

export default async function NormalizedPage() {
  const payload = await getBoardQuickPayload({}).catch(() => null);

  if (!payload || payload.allDates.length === 0) {
    return <EmptyState className="flex-1" />;
  }

  return (
    <div className="flex flex-col h-full max-w-[1920px] mx-auto">
      <Suspense fallback={<NormPageSkeleton />}>
        <NormalizedClient totalData={payload.totalData} />
      </Suspense>
    </div>
  );
}
