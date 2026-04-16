import {
  PageSkeleton,
  CardRowSkeleton,
  TableSkeleton,
} from "@/components/common/PageSkeleton";

export default function GoalMonthlyLoading() {
  return (
    <PageSkeleton>
      <CardRowSkeleton count={4} />
      <TableSkeleton cols={14} rows={15} />
    </PageSkeleton>
  );
}
