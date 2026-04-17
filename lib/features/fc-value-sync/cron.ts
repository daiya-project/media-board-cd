import cron from "node-cron";
import { runFcValueSyncJob } from "./job";

let registered = false;

export function registerFcValueSyncCron(): void {
  if (registered) return;
  registered = true;

  cron.schedule(
    "0 7 * * *",
    async () => {
      const t0 = Date.now();
      try {
        const result = await runFcValueSyncJob();
        console.log("[fc-value-sync] ok", {
          widgetsChecked: result.widgetsChecked,
          widgetsInserted: result.widgetsInserted,
          failures: result.failures,
          fcPrefetched: result.fcPrefetched,
          fcResolved: result.fcResolved,
          durationMs: Date.now() - t0,
        });
      } catch (err) {
        console.error("[fc-value-sync] failed", {
          error: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined,
          durationMs: Date.now() - t0,
        });
      }
    },
    { timezone: "Asia/Seoul" },
  );

  console.log("[fc-value-sync] registered (0 7 * * * Asia/Seoul)");
}
