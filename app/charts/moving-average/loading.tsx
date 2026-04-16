import { ChartSkeleton } from "@/components/common/PageSkeleton";

/**
 * Route-level loading UI for /charts/moving-average.
 * Next.js renders this immediately (inside layout) while page.tsx awaits data,
 * so sidebar + header appear instantly with a skeleton placeholder.
 */
export default function MovingAverageLoading() {
  return (
    <div className="flex flex-col h-full max-w-[1920px] mx-auto">
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
    </div>
  );
}
