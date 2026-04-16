import { TableSkeleton } from "@/components/common/PageSkeleton";

export default function ManagementLoading() {
  return (
    <div className="flex flex-col h-full max-w-[1920px] mx-auto">
      <TableSkeleton cols={11} rows={12} />
    </div>
  );
}
