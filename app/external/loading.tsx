import { CardRowSkeleton, TableSkeleton } from "@/components/common/PageSkeleton";

export default function ExternalLoading() {
  return (
    <div className="flex flex-col gap-4 p-6 h-full max-w-[1920px] mx-auto">
      <CardRowSkeleton count={4} />
      <TableSkeleton cols={12} rows={15} />
    </div>
  );
}
