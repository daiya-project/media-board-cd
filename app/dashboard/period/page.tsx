/**
 * Dashboard page — Board section (Server Component).
 *
 * Two-phase loading:
 *   Phase 2 (await, ~300ms): getBoardQuickPayload() → KPI cards render immediately.
 *   Phase 3 (client-side):   DashboardClient fetches service data via API route.
 *
 * Phase 3 is NOT passed as a Promise prop to avoid RSC stream blocking
 * (which would prevent navigation to other sections until the stream completes).
 *
 * force-dynamic: required because getBoardQuickPayload() reads cookies via
 * the Supabase SSR client, which is incompatible with static prerendering.
 */

import { Suspense } from "react";
import { getBoardQuickPayload } from "@/lib/api/boardService";
import {
  PageSkeleton,
  CardRowSkeleton,
  ChartSkeleton,
} from "@/components/common/PageSkeleton";
import { ErrorFallback } from "@/components/common/ErrorFallback";
import DashboardClient from "../_components/DashboardClient";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function DashboardSkeleton() {
  return (
    <PageSkeleton>
      <CardRowSkeleton count={3} />
      <ChartSkeleton />
      <ChartSkeleton />
      <ChartSkeleton />
    </PageSkeleton>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

interface DashboardPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function DashboardPage({
  searchParams,
}: DashboardPageProps) {
  const params = await searchParams;

  const filters = {
    search: typeof params.search === "string" ? params.search : undefined,
    tier: typeof params.tier === "string" ? params.tier : undefined,
    owner: typeof params.owner === "string" ? params.owner : undefined,
  };

  const hasFilters = !!(filters.search || filters.tier || filters.owner);

  // Phase 1: await fast payload (allDates + totalData + weeks, ~300ms)
  const quickPayload = await getBoardQuickPayload(filters).catch(
    (err: unknown) => {
      const e = err as Record<string, unknown>;
      console.error(
        "[DashboardPage] getBoardQuickPayload error:",
        JSON.stringify({
          message: e?.message,
          code: e?.code,
          details: e?.details,
          hint: e?.hint,
        }),
      );
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
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardClient
          quickPayload={quickPayload}
          hasFilters={hasFilters}
        />
      </Suspense>
    </div>
  );
}
