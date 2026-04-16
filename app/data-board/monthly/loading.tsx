import { TableSkeleton } from "@/components/common/PageSkeleton";

export default function MonthlyLoading() {
  return (
    <div className="flex flex-col h-full max-w-[1920px] mx-auto">
      <TableSkeleton cols={10} rows={15} />
    </div>
  );
}
