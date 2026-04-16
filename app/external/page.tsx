import { Suspense } from "react";
import { TableSkeleton } from "@/components/common/PageSkeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { getExternalPagePayload } from "@/lib/api/externalService";
import ExternalClient from "./_components/ExternalClient";

export const dynamic = "force-dynamic";

/**
 * External Report page — server component.
 * Fetches Phase 2 payload (external daily + mappings + latestDate).
 */
export default async function ExternalPage({
  searchParams,
}: {
  searchParams: Promise<{ start?: string; end?: string }>;
}) {
  const { start, end } = await searchParams;

  const payload = await getExternalPagePayload(
    start ?? "",
    end ?? "",
  ).catch((err) => {
    console.error("[ExternalPage] payload fetch failed:", err);
    return null;
  });

  if (!payload) {
    return <EmptyState message="외부 데이터를 불러올 수 없습니다." />;
  }

  return (
    <div className="flex flex-col gap-4 p-6 h-full max-w-[1920px] mx-auto">
      <Suspense fallback={<TableSkeleton cols={12} rows={15} />}>
        <ExternalClient payload={payload} />
      </Suspense>
    </div>
  );
}
