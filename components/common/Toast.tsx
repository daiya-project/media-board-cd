"use client";

import { useEffect } from "react";
import { CheckCircle, XCircle, AlertTriangle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToastStore, type Toast } from "@/stores/useToastStore";

const ICONS = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
} as const;

const ACCENT_BAR = {
  success: "bg-green-500",
  error: "bg-red-500",
  warning: "bg-amber-500",
} as const;

const ICON_STYLES = {
  success: "text-green-500",
  error: "text-red-500",
  warning: "text-amber-500",
} as const;

/** Default auto-dismiss duration per toast type (ms). */
const DEFAULT_DURATION: Record<Toast["type"], number> = {
  success: 3000,
  error: 6000,
  warning: 5000,
};

function ToastItem({ toast }: { toast: Toast }) {
  const remove = useToastStore((s) => s.remove);
  const Icon = ICONS[toast.type];
  const duration = toast.duration ?? DEFAULT_DURATION[toast.type];

  useEffect(() => {
    const timer = setTimeout(() => remove(toast.id), duration);
    return () => clearTimeout(timer);
  }, [toast.id, duration, remove]);

  return (
    <div
      role="alert"
      className={cn(
        "relative flex items-start gap-3 min-w-[300px] max-w-sm",
        "pl-5 pr-4 py-3 rounded-xl",
        "bg-white border border-gray-200 shadow-lg",
        "text-sm animate-in slide-in-from-top-2 fade-in-0 duration-300",
      )}
    >
      {/* Left accent bar */}
      <div
        className={cn(
          "absolute left-0 top-3 bottom-3 w-[3px] rounded-full",
          ACCENT_BAR[toast.type],
        )}
      />

      <Icon
        className={cn("w-[18px] h-[18px] mt-0.5 shrink-0", ICON_STYLES[toast.type])}
      />

      <div className="flex-1 min-w-0">
        {toast.title && (
          <p className="text-[13px] font-semibold text-gray-900 leading-tight">
            {toast.title}
          </p>
        )}
        <p
          className={cn(
            "text-[12px] text-gray-600 leading-snug",
            toast.title && "mt-0.5",
          )}
        >
          {toast.message}
        </p>
      </div>

      <button
        type="button"
        onClick={() => remove(toast.id)}
        className="shrink-0 text-gray-400 hover:text-gray-600 transition-colors mt-0.5"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

/**
 * Global toast container.
 * Renders all active toasts in the top-right corner with macOS banner style.
 * Should be mounted once in the root layout.
 */
export function Toast() {
  const toasts = useToastStore((s) => s.toasts);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-6 right-6 z-[100] flex flex-col gap-2">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  );
}
