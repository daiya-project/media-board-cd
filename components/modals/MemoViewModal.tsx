"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { X } from "lucide-react";
import { useModalStore } from "@/stores/useModalStore";
import type { BlockNoteContent } from "@/types/app-db.types";
import { EmptyState } from "@/components/common/EmptyState";

/**
 * Lazy-load BlockNote viewer to keep initial bundle small (~200KB+ deferred).
 */
const BlockNoteViewer = dynamic(
  () => import("./MemoViewModalContent").then((m) => m.MemoViewBlockNote),
  { ssr: false },
);

/**
 * Small modal for viewing full memo content with BlockNote formatting.
 * Opens when useModalStore.openModal === "memoView".
 */
export function MemoViewModal() {
  const { openModal, payload, close } = useModalStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isOpen = openModal === "memoView";
  const memo = payload?.memo as BlockNoteContent | null | undefined;

  if (!isOpen) return null;
  if (!mounted) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm"
        onClick={close}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="메모 전체 보기"
        className="fixed inset-0 z-[71] flex items-center justify-center p-4 pointer-events-none"
      >
        <div className="pointer-events-auto bg-white rounded-2xl shadow-2xl border border-border w-full max-w-2xl flex flex-col max-h-[70vh]">
          <div className="flex items-center justify-between px-6 pt-4 pb-3 shrink-0 border-b border-border">
            <h2 className="text-sm font-bold text-foreground">메모</h2>
            <button
              type="button"
              onClick={close}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="닫기"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {memo && memo.length > 0 ? (
              <BlockNoteViewer memo={memo} />
            ) : (
              <EmptyState className="py-8" message="메모가 없습니다" />
            )}
          </div>
        </div>
      </div>
    </>
  );
}
