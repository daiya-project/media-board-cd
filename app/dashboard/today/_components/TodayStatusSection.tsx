/**
 * Today 보드 SSR 진입점.
 * fetchTodayStatus() 실패는 Client 로 errorMessage 전달 (fail-open).
 */

import { fetchTodayStatus } from "@/lib/features/dashboard-today/today-board-reader";
import type { TodayBoard } from "@/lib/features/dashboard-today/aggregate";
import { TodayStatusBoard } from "./TodayStatusBoard";

export async function TodayStatusSection() {
  let initialData: TodayBoard | null = null;
  let errorMessage: string | null = null;
  try {
    initialData = await fetchTodayStatus();
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : String(err);
    console.error("[TodayStatusSection] fetchTodayStatus failed", { error: errorMessage });
  }
  return (
    <TodayStatusBoard initialData={initialData} errorMessage={errorMessage} />
  );
}
