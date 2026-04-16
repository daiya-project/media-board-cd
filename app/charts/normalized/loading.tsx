import { ChartSkeleton } from "@/components/common/PageSkeleton";

/**
 * Route-level loading UI for /charts/normalized.
 * Shows skeleton instantly while page.tsx awaits data.
 */
export default function NormalizedLoading() {
  return (
    <div className="flex flex-col h-full max-w-[1920px] mx-auto">
      <div className="px-6 space-y-4 py-2">
        <div className="h-8 w-64 bg-gray-100 rounded animate-pulse" />
        <ChartSkeleton />
      </div>
    </div>
  );
}
