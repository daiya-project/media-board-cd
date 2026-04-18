/**
 * One-shot 백필 — media.hourly_snapshot 을 Redash 에서 다시 채운다.
 *
 * 사용:
 *   npx tsx --env-file=.env.local scripts/backfill-hourly.ts
 *   npx tsx --env-file=.env.local scripts/backfill-hourly.ts 2026-04-15 2026-04-18
 *
 * 인자 생략 시 default (today - 13일 ~ today).
 * 필수 env: REDASH_API_KEY, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
 */

import { runHourlySyncJob } from "@/lib/features/hourly-sync/job";

async function main() {
  const [, , dateStart, dateEnd] = process.argv;
  console.log("[backfill] start", { dateStart, dateEnd });
  const t0 = Date.now();
  const result = await runHourlySyncJob({ dateStart, dateEnd });
  console.log("[backfill] done", {
    ...result,
    totalMs: Date.now() - t0,
  });
}

main().catch((err) => {
  console.error("[backfill] failed", err);
  process.exit(1);
});
