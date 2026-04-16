/**
 * CVR Manager page — CVR section (Server Component).
 *
 * Phase 1: Fetches CvrMonthlyPayload server-side (selected month rows + prevLevels).
 * Phase 2: Yearly level history is lazy-loaded client-side when switching to yearly view.
 *
 * force-dynamic: required because getCvrMonthlyPayload() reads cookies via the
 * Supabase SSR client, which is incompatible with static prerendering.
 */

import { Suspense } from "react";
import { TableSkeleton } from "@/components/common/PageSkeleton";
import { getCvrMonthlyPayload } from "@/lib/api/cvrService";
import { EmptyState } from "@/components/common/EmptyState";
import CvrManagerClient from "./_components/CvrManagerClient";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ month?: string }>;
}

export default async function CvrPage({ searchParams }: PageProps) {
  const { month } = await searchParams;

  const payload = await getCvrMonthlyPayload(month).catch((err: unknown) => {
    console.error("[CvrPage] getCvrMonthlyPayload error:", err);
    return null;
  });

  if (!payload || payload.availableMonths.length === 0) {
    return (
      <EmptyState
        className="flex-col h-full max-w-[1920px] mx-auto"
        message="CVR 데이터가 없습니다. 먼저 CSV를 임포트해 주세요."
      />
    );
  }

  return (
    <div className="flex flex-col h-full max-w-[1920px] mx-auto">
      {/*
        Suspense is required because CvrManagerClient uses useSearchParams(),
        which triggers CSR bailout without a boundary.
      */}
      <Suspense fallback={<TableSkeleton cols={16} rows={15} />}>
        <CvrManagerClient payload={payload} />
      </Suspense>
    </div>
  );
}
