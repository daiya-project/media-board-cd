import { Suspense } from "react";
import { TableSkeleton } from "@/components/common/PageSkeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { getExternalFcPayload } from "@/lib/api/externalFcService";
import FcClient from "./_components/FcClient";

export const dynamic = "force-dynamic";

export default async function ExternalFcPage({
  searchParams,
}: {
  searchParams: Promise<{ widget?: string; month?: string }>;
}) {
  const { widget, month } = await searchParams;

  const payload = await getExternalFcPayload({
    widgetId: widget ?? null,
    monthYm: month,
  }).catch((err) => {
    console.error("[ExternalFcPage] payload fetch failed:", err);
    return null;
  });

  if (!payload) {
    return <EmptyState message="FC 리포트 데이터를 불러올 수 없습니다." />;
  }

  return (
    <div className="flex flex-col gap-4 p-6 h-full max-w-[1920px] mx-auto">
      <Suspense fallback={<TableSkeleton cols={33} rows={15} />}>
        <FcClient payload={payload} />
      </Suspense>
    </div>
  );
}
