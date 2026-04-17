import { TableSkeleton } from "@/components/common/PageSkeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-4 p-6 h-full max-w-[1920px] mx-auto">
      <TableSkeleton cols={33} rows={15} />
    </div>
  );
}
