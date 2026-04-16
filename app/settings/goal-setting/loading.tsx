import { TableSkeleton } from "@/components/common/PageSkeleton";

export default function GoalSettingLoading() {
  return (
    <div className="flex flex-col h-full max-w-[1920px] mx-auto">
      <TableSkeleton cols={8} rows={12} />
    </div>
  );
}
