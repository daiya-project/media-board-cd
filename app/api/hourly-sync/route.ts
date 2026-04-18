/**
 * hourly-sync 수동 trigger.
 *
 * 인증: `Authorization: Bearer <INTERNAL_IMPORT_TOKEN>` 만 허용 (서버-서버 운영용).
 * INTERNAL_IMPORT_TOKEN 미설정 시 503 (의도적으로 비활성).
 *
 * Body (JSON, 옵션):
 *   { "dateStart"?: "YYYY-MM-DD", "dateEnd"?: "YYYY-MM-DD" }
 *   - 둘 다 생략: today - 13일 ~ today (cron 과 동일 기본 범위)
 *   - backfill 또는 특정 일자 보정 시 명시
 *
 * 응답: 성공 시 HourlySyncResult JSON, 실패 시 { error } + 4xx/5xx.
 */

import { NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { runHourlySyncJob } from "@/lib/features/hourly-sync/job";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function hasValidServiceToken(req: NextRequest): boolean {
  const expected = process.env.INTERNAL_IMPORT_TOKEN;
  if (!expected) return false;
  const header = req.headers.get("authorization");
  if (!header) return false;
  const m = /^Bearer\s+(.+)$/.exec(header);
  if (!m) return false;
  const provided = Buffer.from(m[1]);
  const secret = Buffer.from(expected);
  if (provided.length !== secret.length) return false;
  return timingSafeEqual(provided, secret);
}

function isYmd(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function jsonRes(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function POST(req: NextRequest): Promise<Response> {
  if (!process.env.INTERNAL_IMPORT_TOKEN) {
    return jsonRes(503, { error: "INTERNAL_IMPORT_TOKEN 미설정 — 수동 trigger 비활성" });
  }
  if (!hasValidServiceToken(req)) {
    return jsonRes(401, { error: "Unauthorized" });
  }

  let dateStart: string | undefined;
  let dateEnd: string | undefined;

  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    let body: { dateStart?: unknown; dateEnd?: unknown };
    try {
      body = (await req.json()) as { dateStart?: unknown; dateEnd?: unknown };
    } catch {
      return jsonRes(400, { error: "Invalid JSON" });
    }
    if (body.dateStart !== undefined) {
      if (!isYmd(body.dateStart)) {
        return jsonRes(400, { error: "dateStart 형식 오류 (YYYY-MM-DD)" });
      }
      dateStart = body.dateStart;
    }
    if (body.dateEnd !== undefined) {
      if (!isYmd(body.dateEnd)) {
        return jsonRes(400, { error: "dateEnd 형식 오류 (YYYY-MM-DD)" });
      }
      dateEnd = body.dateEnd;
    }
    if (dateStart && dateEnd && dateStart > dateEnd) {
      return jsonRes(400, { error: "dateStart 가 dateEnd 보다 큽니다" });
    }
  }

  console.log("[hourly-sync] manual trigger", { dateStart, dateEnd });
  const t0 = Date.now();
  try {
    const result = await runHourlySyncJob({ dateStart, dateEnd });
    console.log("[hourly-sync] ok (manual)", {
      ...result,
      durationMs: Date.now() - t0,
    });
    return jsonRes(200, result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[hourly-sync] failed (manual)", {
      error: message,
      durationMs: Date.now() - t0,
    });
    return jsonRes(500, { error: message });
  }
}
