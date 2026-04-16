"use client";

import { PlusCircle, ClipboardPen } from "lucide-react";
import { usePathname } from "next/navigation";
import { useModalStore } from "@/stores/useModalStore";
import { getHeaderConfig } from "@/lib/config/header-filter-config";

/**
 * Header buttons for creating records: "등록" (New Pipeline) and "세일즈" (Record Action).
 * Visibility is driven by `getHeaderConfig()` based on the current route.
 */
export function HeaderActionButtons() {
  const open = useModalStore((s) => s.open);
  const pathname = usePathname();
  const config = getHeaderConfig(pathname);

  if (!config.registerButton && !config.salesButton) return null;

  return (
    <>
      {config.registerButton && (
        <button
          type="button"
          onClick={() => open("newPipeline")}
          className="px-4 h-10 bg-white border border-gray-200 hover:border-blue-400 hover:text-blue-600 text-gray-600 rounded-lg text-sm font-semibold shadow-sm transition-colors flex items-center gap-2"
        >
          <PlusCircle className="w-[13px] h-[13px] text-gray-400 group-hover:text-blue-500" />
          등록
        </button>
      )}
      {config.salesButton && (
        <button
          type="button"
          onClick={() => open("recordAction")}
          className="px-4 h-10 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow-md shadow-blue-500/20 transition-colors flex items-center gap-2"
        >
          <ClipboardPen className="w-[18px] h-[18px]" />
          세일즈
        </button>
      )}
    </>
  );
}
