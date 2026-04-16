import { cn } from "@/lib/utils";

interface ErrorFallbackProps {
  /** Primary error message. */
  message?: string;
  /** Optional secondary detail (e.g. error.message). */
  detail?: string;
  /** Extra Tailwind classes for the outer container. */
  className?: string;
}

/**
 * Error fallback with centered, destructive-colored message.
 * Add layout classes via `className` for different contexts:
 * - Page-level: `className="flex-col h-full max-w-[1920px] mx-auto"`
 * - Modal-level: `className="py-12"`
 */
export function ErrorFallback({
  message = "데이터를 불러올 수 없습니다. 잠시 후 다시 시도해 주세요.",
  detail,
  className,
}: ErrorFallbackProps) {
  return (
    <div
      className={cn("flex items-center justify-center", className)}
    >
      <div className="text-center">
        <p className="text-sm text-destructive font-medium">{message}</p>
        {detail && (
          <p className="text-xs text-muted-foreground mt-1">{detail}</p>
        )}
      </div>
    </div>
  );
}
