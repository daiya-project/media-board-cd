import { TableSkeleton } from "@/components/common/PageSkeleton";

export default function CvrLoading() {
  return (
    <div className="flex flex-col h-full max-w-[1920px] mx-auto">
      <TableSkeleton cols={16} rows={15} />
    </div>
  );
}
