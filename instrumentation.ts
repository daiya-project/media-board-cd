/**
 * Next.js 서버 부팅 훅.
 * Pod 가 시작될 때 node-cron 으로 daily Redash import 타이머를 등록한다.
 *
 * 가드:
 *  - NEXT_RUNTIME === 'nodejs' 가 아니면 무시 (Edge / 클라이언트 번들 오염 방지)
 *  - cron.ts 자체 registered 플래그로 중복 등록 방지
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const [{ registerDailyImportCron }, { registerFcValueSyncCron }] =
    await Promise.all([
      import("./lib/features/daily-redash-import/cron"),
      import("./lib/features/fc-value-sync/cron"),
    ]);

  registerDailyImportCron();
  registerFcValueSyncCron();
}
