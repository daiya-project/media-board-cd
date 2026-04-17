import { NextRequest, NextResponse } from "next/server";
import { runFcValueSyncJob } from "@/lib/features/fc-value-sync/job";

export async function POST(req: NextRequest) {
  const sync = req.nextUrl.searchParams.get("sync") === "true";

  if (sync) {
    try {
      const result = await runFcValueSyncJob();
      return NextResponse.json({ status: "completed", result });
    } catch (err) {
      return NextResponse.json(
        {
          status: "failed",
          error: err instanceof Error ? err.message : String(err),
        },
        { status: 500 },
      );
    }
  }

  // async: 백그라운드 실행, 즉시 202 반환
  runFcValueSyncJob().catch((err) => {
    console.error("[fc-value-sync async] failed:", err);
  });
  return NextResponse.json({ status: "triggered" }, { status: 202 });
}
