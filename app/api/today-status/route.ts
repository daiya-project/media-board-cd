/**
 * Today Status — 브라우저 React Query refetch 프록시.
 *
 * SSR 의 fetchTodayStatus() 와 같은 reader 를 호출하여 일관성 보장.
 * dynamic="force-dynamic" — Next.js route 캐싱 개입 방지 (오래된 값 반환 회피).
 *
 * 인증 없음 — 사내 대시보드 전제. 외부 노출 시 reader 호출 전 세션 체크 추가 필요.
 */

import { NextResponse } from "next/server";
import { fetchTodayStatus } from "@/lib/features/dashboard-today/today-board-reader";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    const board = await fetchTodayStatus();
    return NextResponse.json(board, {
      headers: { "cache-control": "no-store" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[api/today-status] failed", { error: message });
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
