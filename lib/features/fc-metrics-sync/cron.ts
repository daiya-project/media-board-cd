import cron from "node-cron";
import { runFcMetricsSyncJob } from "./job";

let registered = false;

export function registerFcMetricsSyncCron(): void {
  if (registered) return;
  registered = true;

  cron.schedule(
    "30 7 * * *",
    async () => {
      const t0 = Date.now();
      try {
        const result = await runFcMetricsSyncJob();
        console.log("[fc-metrics-sync] ok", {
          widgetsChecked: result.widgetsChecked,
          widgetsUpserted: result.widgetsUpserted,
          rowsUpserted: result.rowsUpserted,
          failures: result.failures,
          durationMs: Date.now() - t0,
        });
      } catch (err) {
        console.error("[fc-metrics-sync] failed", {
          error: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined,
          durationMs: Date.now() - t0,
        });
      }
    },
    { timezone: "Asia/Seoul" },
  );

  console.log("[fc-metrics-sync] registered (30 7 * * * Asia/Seoul)");
}
