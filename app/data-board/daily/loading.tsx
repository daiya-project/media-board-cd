import { TableSkeleton } from "@/components/common/PageSkeleton";

export default function DailyLoading() {
  return (
    <div className="flex flex-col h-full max-w-[1920px] mx-auto">
      <TableSkeleton cols={20} rows={15} />
    </div>
  );
}
