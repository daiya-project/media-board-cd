"use client";

import { MousePointerClick } from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";

/**
 * Logo icon button that toggles the sidebar open/collapsed state.
 */
export function LogoToggle() {
  const { toggleSidebar } = useSidebar();

  return (
    <button
      type="button"
      onClick={toggleSidebar}
      className="bg-blue-600 p-1.5 rounded-lg text-white shadow-lg shadow-blue-500/30 cursor-pointer hover:bg-blue-700 transition-colors"
      aria-label="Toggle sidebar"
    >
      <MousePointerClick className="w-[22px] h-[22px]" />
    </button>
  );
}
