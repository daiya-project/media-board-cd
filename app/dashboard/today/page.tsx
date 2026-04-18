/**
 * Dashboard — Today 섹션.
 *
 * media.hourly_snapshot 14일치 → 오늘 cutoff 누적 vs baseline 평균 비교.
 * Suspense 경계로 SSR fetch 가 다른 섹션 stream 을 막지 않게 한다.
 */

import { Suspense } from "react";
import { PageSkeleton, CardRowSkeleton, ChartSkeleton } from "@/components/common/PageSkeleton";
import { TodayStatusSection } from "./_components/TodayStatusSection";

export const dynamic = "force-dynamic";

function TodaySkeleton() {
  return (
    <PageSkeleton>
      <CardRowSkeleton count={6} />
      <ChartSkeleton />
    </PageSkeleton>
  );
}

export default function TodayPage() {
  return (
    <div className="flex flex-col h-full max-w-[1920px] mx-auto p-4 md:p-6">
      <Suspense fallback={<TodaySkeleton />}>
        <TodayStatusSection />
      </Suspense>
    </div>
  );
}
