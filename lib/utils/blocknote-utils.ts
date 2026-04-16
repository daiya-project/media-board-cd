import type { BlockNoteContent } from "@/types/app-db.types";

/**
 * Shared BlockNote editor theme for MemoEditor and MemoViewModal.
 * Provides consistent typography and color palette across all memo views.
 * Applied via the `theme` prop on BlockNoteView.
 */
export const memoEditorTheme = {
  colors: {
    editor: {
      text: "#111827",
      background: "#ffffff",
    },
    menu: {
      text: "#374151",
      background: "#ffffff",
    },
    tooltip: {
      text: "#374151",
      background: "#f9fafb",
    },
    hovered: {
      text: "#111827",
      background: "#f3f4f6",
    },
    selected: {
      text: "#ffffff",
      background: "#3b82f6",
    },
    disabled: {
      text: "#9ca3af",
      background: "#f3f4f6",
    },
    shadow: "#e5e7eb",
    border: "#e5e7eb",
    sideMenu: "#9ca3af",
  },
  borderRadius: 6,
  fontFamily: "inherit",
};

/**
 * Extracts plain text from BlockNote JSONB content.
 * Used for table cell previews, tooltips, and sorting comparisons.
 * @param blocks - BlockNote document blocks (JSONB from DB)
 * @returns Concatenated plain text string, or empty string if null/empty
 */
export function extractPlainText(blocks: BlockNoteContent | null): string {
  if (!blocks || !Array.isArray(blocks)) return "";

  const parts: string[] = [];

  for (const block of blocks) {
    const content = block.content;
    if (Array.isArray(content)) {
      for (const inline of content) {
        if (typeof inline === "object" && inline !== null) {
          const node = inline as Record<string, unknown>;
          if (node.type === "text" && typeof node.text === "string") {
            parts.push(node.text);
          } else if (node.type === "link" && Array.isArray(node.content)) {
            for (const linkChild of node.content) {
              const child = linkChild as Record<string, unknown>;
              if (typeof child.text === "string") parts.push(child.text);
            }
          }
        }
      }
    }

    // Recurse into nested children blocks
    if (Array.isArray(block.children) && block.children.length > 0) {
      const childText = extractPlainText(
        block.children as BlockNoteContent,
      );
      if (childText) parts.push(childText);
    }
  }

  return parts.join(" ").trim();
}

/**
 * Extracts only the first heading (level 3) from BlockNote content.
 * If no heading exists, falls back to extracting plain text.
 * Used for memo preview in tables.
 * @param blocks - BlockNote document blocks (JSONB from DB)
 * @param maxLength - Maximum length for preview (default 60)
 * @returns First heading text or plain text with ellipsis if truncated
 */
export function extractHeadingPreview(
  blocks: BlockNoteContent | null,
  maxLength: number = 60
): string {
  if (!blocks || !Array.isArray(blocks)) return "";

  // Find first heading block (type: "heading")
  for (const block of blocks) {
    if (block.type === "heading") {
      const content = block.content;
      if (Array.isArray(content)) {
        const parts: string[] = [];
        for (const inline of content) {
          if (typeof inline === "object" && inline !== null) {
            const node = inline as Record<string, unknown>;
            if (node.type === "text" && typeof node.text === "string") {
              parts.push(node.text);
            }
          }
        }
        const text = parts.join("").trim();
        if (text) {
          return text.length > maxLength
            ? text.substring(0, maxLength) + "..."
            : text;
        }
      }
    }
  }

  // Fallback: if no heading found, use plain text
  const plainText = extractPlainText(blocks);
  if (plainText) {
    return plainText.length > maxLength
      ? plainText.substring(0, maxLength) + "..."
      : plainText;
  }

  return "";
}
