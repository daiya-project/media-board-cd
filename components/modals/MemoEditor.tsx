"use client";

import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import { en } from "@blocknote/core/locales";
import "@blocknote/mantine/style.css";
import type { BlockNoteContent } from "@/types/app-db.types";
import { memoEditorTheme } from "@/lib/utils/blocknote-utils";

interface MemoEditorProps {
  onChange: (content: BlockNoteContent | null) => void;
  initialContent?: BlockNoteContent | null;
}

/**
 * BlockNote rich-text memo editor.
 * Must be loaded via next/dynamic with { ssr: false }.
 */
export default function MemoEditor({ onChange, initialContent }: MemoEditorProps) {
  const editor = useCreateBlockNote({
    initialContent: initialContent ?? [
      {
        type: "heading",
        props: { level: 3 },
        content: [],
      },
      {
        type: "paragraph",
        content: [],
      },
    ],
    dictionary: {
      ...en,
      placeholders: {
        ...en.placeholders,
        heading: "이 줄에 작성 된 내용이 미리보기에 보여집니다",
        default: "",
      },
    },
  });

  function handleChange() {
    const blocks = editor.document;
    // Convert to plain serializable array
    const content = JSON.parse(JSON.stringify(blocks)) as BlockNoteContent;

    // Treat empty document (single empty paragraph) as null
    const isEmpty =
      content.length === 0 ||
      (content.length === 1 &&
        Array.isArray((content[0] as Record<string, unknown>).content) &&
        ((content[0] as Record<string, unknown>).content as unknown[])
          .length === 0);

    onChange(isEmpty ? null : content);
  }

  return (
    <div className="h-full max-h-[400px] rounded-lg border border-gray-200 overflow-y-auto [&_.bn-default-styles]:!text-[12px]">
      <BlockNoteView editor={editor} onChange={handleChange} theme={memoEditorTheme} />
    </div>
  );
}
