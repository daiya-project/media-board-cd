"use client";

/**
 * BlockNote viewer extracted for dynamic import (code-split ~200KB+).
 * Loaded lazily by MemoViewModal via next/dynamic.
 */

import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import type { BlockNoteContent } from "@/types/app-db.types";
import { memoEditorTheme } from "@/lib/utils/blocknote-utils";

interface Props {
  memo: BlockNoteContent;
}

/**
 * Read-only BlockNote renderer for memo content.
 */
export function MemoViewBlockNote({ memo }: Props) {
  const editor = useCreateBlockNote(
    {
      initialContent: memo,
    },
    [memo],
  );

  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden [&_.bn-default-styles]:!text-[12px]">
      <BlockNoteView
        editor={editor}
        editable={false}
        theme={memoEditorTheme}
        formattingToolbar={false}
      />
    </div>
  );
}
