/**
 * API Route: Get action (meeting log) records.
 *
 * GET /api/actions
 *
 * Query params:
 *   - clientId   (optional) — filter by client_id
 *   - stage      (optional) — filter by stage (e.g. "meeting", "contact")
 *   - from       (optional) — start date inclusive (YYYY-MM-DD)
 *   - to         (optional) — end date inclusive (YYYY-MM-DD)
 *   - limit      (optional) — max rows (default 100)
 *   - format     (optional) — "plain" returns memo as plain text (default: "plain")
 *
 * Response: Array of action records with client_name and plain-text memo.
 */

import { NextRequest, NextResponse } from "next/server";
import { createMediaClient } from "@/lib/supabase/media-server";
import { extractPlainText } from "@/lib/utils/blocknote-utils";
import type { ActionStage, BlockNoteContent } from "@/types/app-db.types";

const VALID_STAGES: ActionStage[] = [
  "contact",
  "meeting",
  "propose",
  "done",
  "memo",
];

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;

    const clientId = sp.get("clientId");
    const stage = sp.get("stage");
    const from = sp.get("from");
    const to = sp.get("to");
    const limitParam = Number(sp.get("limit"));
    const limit = Math.min(Number.isFinite(limitParam) ? limitParam : 100, 1000);
    const format = sp.get("format") ?? "plain";

    // Validate stage if provided
    if (stage && !VALID_STAGES.includes(stage as ActionStage)) {
      return NextResponse.json(
        {
          error: `Invalid stage "${stage}". Valid: ${VALID_STAGES.join(", ")}`,
        },
        { status: 400 },
      );
    }

    const supabase = await createMediaClient();

    let query = supabase
      .from("action")
      .select(
        "action_id, client_id, service_id, widget_id, action_date, stage, memo, has_followup, created_at",
      )
      .eq("is_deleted", false)
      .order("action_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(limit);

    if (clientId) query = query.eq("client_id", clientId);
    if (stage) query = query.eq("stage", stage);
    if (from) query = query.gte("action_date", from);
    if (to) query = query.lte("action_date", to);

    const { data, error } = await query;
    if (error) throw error;

    // Resolve client names in one batch query
    const clientIds = [
      ...new Set(
        ((data ?? []) as Array<{ client_id: string }>).map(
          (r) => r.client_id,
        ),
      ),
    ];

    let clientMap = new Map<string, string>();
    if (clientIds.length > 0) {
      const { data: clients } = await supabase
        .from("client")
        .select("client_id, client_name")
        .in("client_id", clientIds);

      for (const c of (clients ?? []) as Array<{
        client_id: string;
        client_name: string;
      }>) {
        clientMap.set(c.client_id, c.client_name);
      }
    }

    const rows = ((data ?? []) as Array<Record<string, unknown>>).map(
      (row) => {
        const memo = row.memo as BlockNoteContent | null;

        return {
          action_id: row.action_id as number,
          client_id: row.client_id as string,
          client_name:
            clientMap.get(row.client_id as string) ?? (row.client_id as string),
          service_id: (row.service_id as string) ?? null,
          widget_id: (row.widget_id as string) ?? null,
          action_date: row.action_date as string,
          stage: (row.stage as string) ?? null,
          memo: format === "plain" ? extractPlainText(memo) : memo,
          has_followup: row.has_followup as boolean,
          created_at: row.created_at as string,
        };
      },
    );

    return NextResponse.json(rows);
  } catch (error) {
    console.error("[API /api/actions] Error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch actions",
      },
      { status: 500 },
    );
  }
}
