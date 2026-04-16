import {
  PageSkeleton,
  ChartSkeleton,
} from "@/components/common/PageSkeleton";

export default function PipelineLoading() {
  return (
    <PageSkeleton>
      <div className="flex gap-6 flex-1">
        <ChartSkeleton />
        <ChartSkeleton />
      </div>
    </PageSkeleton>
  );
}
