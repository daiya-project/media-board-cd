/**
 * Daily Redash import 모달 entry.
 *
 * 인증: Supabase SSR client + 세션 cookie. 미인증 → 401.
 * 데이터 upsert: cron-client (anon, persistSession:false). 권한 게이트 두 겹.
 * 응답: NDJSON streaming (Transfer-Encoding: chunked).
 *   - { type: 'phase', phase, message? }
 *   - { type: 'progress', ...ImportProgress }
 *   - { type: 'result', ...ImportResult-ish }
 *   - { type: 'error', message, jobId? }
 */

import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runDailyImportJob, type RunImportOptions } from "@/lib/features/daily-redash-import/job";
import type { ImportProgress } from "@/types/app-db.types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FORCE_RANGE_DAYS = 31;

interface ModalRequest {
  mode: "incremental" | "force";
  startDate?: string;
  endDate?: string;
}

function isYmd(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function daysBetween(start: string, end: string): number {
  const [sy, sm, sd] = start.split("-").map(Number);
  const [ey, em, ed] = end.split("-").map(Number);
  const sUtc = Date.UTC(sy, sm - 1, sd);
  const eUtc = Date.UTC(ey, em - 1, ed);
  return Math.round((eUtc - sUtc) / 86400000);
}

function todayKst(): string {
  const utc = new Date();
  const kst = new Date(utc.getTime() + 9 * 60 * 60 * 1000);
  return `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(2, "0")}-${String(kst.getUTCDate()).padStart(2, "0")}`;
}

export async function POST(req: NextRequest): Promise<Response> {
  // 1. 인증 (세션만 확인, 데이터 작업에는 사용 안 함)
  const authClient = await createClient();
  const { data: { user }, error: authErr } = await authClient.auth.getUser();
  if (authErr || !user) {
    return new Response("Unauthorized", { status: 401 });
  }

  // 2. body 파싱·검증
  let body: ModalRequest;
  try {
    body = (await req.json()) as ModalRequest;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  if (body.mode !== "incremental" && body.mode !== "force") {
    return new Response(JSON.stringify({ error: "mode 는 'incremental' 또는 'force'" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  let runOpts: RunImportOptions;
  if (body.mode === "force") {
    if (!isYmd(body.startDate) || !isYmd(body.endDate)) {
      return new Response(
        JSON.stringify({ error: "force 모드는 startDate/endDate (YYYY-MM-DD) 필수" }),
        { status: 400, headers: { "content-type": "application/json" } },
      );
    }
    if (body.startDate > body.endDate) {
      return new Response(
        JSON.stringify({ error: "startDate 가 endDate 보다 큽니다" }),
        { status: 400, headers: { "content-type": "application/json" } },
      );
    }
    if (body.endDate > todayKst()) {
      return new Response(
        JSON.stringify({ error: "endDate 가 오늘보다 미래입니다" }),
        { status: 400, headers: { "content-type": "application/json" } },
      );
    }
    if (daysBetween(body.startDate, body.endDate) >= MAX_FORCE_RANGE_DAYS) {
      return new Response(
        JSON.stringify({ error: `force 범위는 ${MAX_FORCE_RANGE_DAYS}일 이하만 허용` }),
        { status: 400, headers: { "content-type": "application/json" } },
      );
    }
    runOpts = {
      mode: "force",
      range: { start: body.startDate, end: body.endDate },
    };
  } else {
    runOpts = { mode: "incremental" };
  }

  // 3. NDJSON streaming
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const writeLine = (obj: unknown) =>
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));

      try {
        writeLine({ type: "phase", phase: "fetch_redash" });

        const result = await runDailyImportJob({
          ...runOpts,
          onProgress: (p: ImportProgress) => {
            writeLine({ type: "progress", ...p });
          },
        });

        writeLine({ type: "result", ...result });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const jobIdMatch = /job=([a-zA-Z0-9-]+)/.exec(message);
        writeLine({
          type: "error",
          message,
          ...(jobIdMatch ? { jobId: jobIdMatch[1] } : {}),
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "content-type": "application/x-ndjson",
      "cache-control": "no-store",
    },
  });
}
