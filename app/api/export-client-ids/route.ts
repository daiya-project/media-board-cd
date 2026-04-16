/**
 * API Route: Export client_id list to Markdown.
 *
 * GET /api/export-client-ids
 * Fetches all client_id from media.client and writes them to docs/client-ids.md
 * in "a,b,c,d" format. Intended for local/dev use (filesystem write).
 */

import { NextResponse } from "next/server";
import { createMediaClient } from "@/lib/supabase/media-server";
import { writeFileSync } from "fs";
import path from "path";

export async function GET() {
  try {
    const supabase = await createMediaClient();
    const { data, error } = await supabase
      .from("client")
      .select("client_id")
      .order("client_id", { ascending: true });

    if (error) throw error;

    const ids = (data ?? []).map((row: { client_id: string }) => row.client_id);
    const line = ids.join(",");

    const content = `# Client ID 목록

\`media.client\` 테이블에 등록된 \`client_id\` 목록입니다.

\`\`\`
${line}
\`\`\`

쉼표 구분: ${line}
`;

    const outPath = path.join(process.cwd(), "docs", "client-ids.md");
    writeFileSync(outPath, content, "utf8");

    return NextResponse.json({
      ok: true,
      path: "docs/client-ids.md",
      count: ids.length,
      preview: line.slice(0, 80) + (line.length > 80 ? "…" : ""),
    });
  } catch (err) {
    console.error("[API /api/export-client-ids] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Export failed" },
      { status: 500 }
    );
  }
}
