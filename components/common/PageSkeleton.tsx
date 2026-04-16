import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

// ---------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------

interface CardSkeletonProps {
  className?: string;
}

/**
 * Skeleton placeholder for a single KPI / summary card.
 */
export function CardSkeleton({ className }: CardSkeletonProps) {
  return <Skeleton className={cn("h-28 rounded-xl", className)} />;
}

interface ChartSkeletonProps {
  className?: string;
}

/**
 * Skeleton placeholder for a chart area.
 */
export function ChartSkeleton({ className }: ChartSkeletonProps) {
  return <Skeleton className={cn("h-72 rounded-xl", className)} />;
}

interface TableSkeletonProps {
  /** Number of columns to render. @default 8 */
  cols?: number;
  /** Number of body rows to render. @default 10 */
  rows?: number;
  className?: string;
}

/**
 * Skeleton placeholder for a data table (thead + tbody).
 */
export function TableSkeleton({
  cols = 8,
  rows = 10,
  className,
}: TableSkeletonProps) {
  return (
    <div className={cn("flex-1 overflow-auto", className)}>
      <table className="w-max min-w-full border-collapse text-sm">
        <thead className="bg-muted/50 border-b border-border">
          <tr>
            {Array.from({ length: cols }).map((_, i) => (
              <th key={i} className="h-10 px-2" style={{ minWidth: 80 }}>
                <Skeleton className="h-3 w-full" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, ri) => (
            <tr key={ri} className="border-b border-border">
              {Array.from({ length: cols }).map((_, ci) => (
                <td key={ci} className="py-2 px-2">
                  <Skeleton
                    className="h-3 w-full"
                    style={{ animationDelay: `${ri * 50}ms` }}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page-level presets
// ---------------------------------------------------------------------------

interface PageSkeletonProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Wrapper that provides consistent page-level padding and spacing
 * for skeleton layouts.
 *
 * @example
 * ```tsx
 * <PageSkeleton>
 *   <CardSkeleton />
 *   <ChartSkeleton />
 *   <TableSkeleton cols={12} rows={8} />
 * </PageSkeleton>
 * ```
 */
export function PageSkeleton({ children, className }: PageSkeletonProps) {
  return (
    <div className={cn("p-6 space-y-6", className)}>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Common preset: cards row
// ---------------------------------------------------------------------------

interface CardRowSkeletonProps {
  /** Number of cards. @default 3 */
  count?: number;
  className?: string;
}

/**
 * A horizontal grid of CardSkeleton items — typically used for KPI rows.
 */
export function CardRowSkeleton({ count = 3, className }: CardRowSkeletonProps) {
  return (
    <div className={cn("grid gap-4", className)} style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}>
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}
