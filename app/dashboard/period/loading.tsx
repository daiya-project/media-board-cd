import {
  PageSkeleton,
  CardRowSkeleton,
  ChartSkeleton,
} from "@/components/common/PageSkeleton";

export default function DashboardLoading() {
  return (
    <div className="flex flex-col h-full max-w-[1920px] mx-auto">
      <PageSkeleton>
        <CardRowSkeleton count={3} />
        <ChartSkeleton />
        <ChartSkeleton />
        <ChartSkeleton />
      </PageSkeleton>
    </div>
  );
}
