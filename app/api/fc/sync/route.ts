import { NextRequest, NextResponse } from "next/server";
import { runFcValueSyncJob } from "@/lib/features/fc-value-sync/job";
import { runFcMetricsSyncJob } from "@/lib/features/fc-metrics-sync/job";

export async function POST(req: NextRequest) {
  const sync = req.nextUrl.searchParams.get("sync") === "true";
  const start = req.nextUrl.searchParams.get("start");
  const end = req.nextUrl.searchParams.get("end");
  const widget = req.nextUrl.searchParams.get("widget");

  const override = start && end ? { start, end } : undefined;
  const widgetIds = widget ? [widget] : undefined;

  const runBoth = async () => {
    const [values, metrics] = await Promise.all([
      runFcValueSyncJob(),
      runFcMetricsSyncJob({ override, widgetIds }),
    ]);
    return { values, metrics };
  };

  if (sync) {
    try {
      const result = await runBoth();
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

  runBoth().catch((err) => {
    console.error("[fc-sync async] failed:", err);
  });
  return NextResponse.json({ status: "triggered" }, { status: 202 });
}
