"use client";

import { RefreshCw } from "lucide-react";
import { useModalStore } from "@/stores/useModalStore";

/**
 * Header button that triggers the data import flow.
 * Opens the import modal via Zustand store.
 */
export function ImportTriggerButton() {
  const open = useModalStore((s) => s.open);

  return (
    <button
      type="button"
      onClick={() => open("import")}
      title="데이터 업데이트"
      className="w-10 h-10 bg-white border border-gray-200 hover:border-green-400 hover:text-green-700 text-gray-500 rounded-lg shadow-sm transition-all flex items-center justify-center"
    >
      <RefreshCw className="w-[18px] h-[18px]" />
    </button>
  );
}
