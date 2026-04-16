import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// EmptyState — centered message for empty data
// ---------------------------------------------------------------------------

interface EmptyStateProps {
  /** Display message. */
  message?: string;
  /** Extra Tailwind classes (e.g. "flex-1", "py-8"). */
  className?: string;
}

/**
 * Inline empty-state block with centered text.
 * Add `className="flex-1"` when it should fill remaining vertical space.
 */
export function EmptyState({
  message = "데이터가 없습니다.",
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-center text-sm text-muted-foreground",
        className,
      )}
    >
      {message}
    </div>
  );
}

// ---------------------------------------------------------------------------
// EmptyTableRow — empty-state row for <tbody>
// ---------------------------------------------------------------------------

interface EmptyTableRowProps {
  /** Number of columns the cell should span. */
  colSpan: number;
  /** Display message. */
  message?: string;
}

/**
 * A `<tr>` with a single centered cell spanning the full table width.
 */
export function EmptyTableRow({
  colSpan,
  message = "데이터가 없습니다.",
}: EmptyTableRowProps) {
  return (
    <tr>
      <td
        colSpan={colSpan}
        className="py-16 text-center text-sm text-muted-foreground"
      >
        {message}
      </td>
    </tr>
  );
}
