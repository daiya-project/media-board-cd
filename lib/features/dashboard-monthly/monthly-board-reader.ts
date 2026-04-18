/**
 * Dashboard Monthly reader — 매니저 필터 + Team/매니저 vIMP 목표 결합.
 *
 * 데이터 소스:
 *  - media.v_daily_by_service (client_id 단위 일별 합계)
 *  - media.client (client_id → manager_id 매핑)
 *  - media.goal (월간 vimp_target — manager_id IS NULL = team)
 *
 * managerId === null → 팀 전체 (모든 client + team goal).
 * managerId === number → 해당 매니저 담당 client 만 + 해당 매니저 monthly goal.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { createCronSupabase } from "@/lib/supabase/cron-client";
import {
  aggregateMonthlyBoard,
  getMonthRange,
  previousMonthKey,
  type DailyTotalRow,
  type MonthlyBoard,
} from "./aggregate";

const PAGE_SIZE = 1000;

interface ServiceRow {
  date: string;
  client_id: string;
  cost_spent: number | null;
  ad_revenue: number | null;
  vimp: number | null;
}

/**
 * v_daily_by_service 의 PostgREST 기본 1k row 한도를 우회하여 전 페이지 fetch.
 * 60일 × 일 ~1k 매체 = ~60k rows 까지 안전.
 */
async function fetchAllServiceRows(
  supabase: SupabaseClient<Database, "media">,
  start: string,
  end: string,
): Promise<ServiceRow[]> {
  const out: ServiceRow[] = [];
  for (let page = 0; page < 200; page++) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from("v_daily_by_service")
      .select("date,client_id,cost_spent,ad_revenue,vimp")
      .gte("date", start)
      .lte("date", end)
      .order("date", { ascending: true })
      .order("client_id", { ascending: true })
      .range(from, to);
    if (error) throw new Error(`v_daily_by_service 조회 실패: ${error.message}`);
    const batch = (data ?? []) as ServiceRow[];
    out.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return out;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function todayKstMonthKey(): string {
  const utc = new Date();
  const kst = new Date(utc.getTime() + 9 * 60 * 60 * 1000);
  return `${kst.getUTCFullYear()}-${pad2(kst.getUTCMonth() + 1)}`;
}

interface FetchOpts {
  monthKey?: string;
  /** null = 팀 전체. number = 해당 매니저. */
  managerId?: number | null;
}

export async function fetchMonthlyBoard(
  opts: FetchOpts = {},
): Promise<MonthlyBoard> {
  const supabase = createCronSupabase();
  const targetMonth = opts.monthKey ?? todayKstMonthKey();
  const prevMonth = previousMonthKey(targetMonth);
  const managerId = opts.managerId ?? null;

  const targetRange = getMonthRange(targetMonth);
  const prevRange = getMonthRange(prevMonth);

  // 병렬 fetch — v_daily_by_service 는 일별 ~1k 행 × 60일 = ~60k 행이라
  // PostgREST 기본 1k limit 회피 위해 페이지네이션 필요.
  const [serviceRows, clientResult, goalResult] = await Promise.all([
    fetchAllServiceRows(supabase, prevRange.start, targetRange.end),
    supabase.from("client").select("client_id,manager_id"),
    supabase
      .from("goal")
      .select("manager_id,vimp_target,date_start")
      .eq("goal_type", "monthly")
      .eq("date_start", targetRange.start),
  ]);

  const { data: clientRows, error: clientErr } = clientResult;
  const { data: goalRows, error: goalErr } = goalResult;

  if (clientErr) throw new Error(`client 조회 실패: ${clientErr.message}`);
  if (goalErr) throw new Error(`goal 조회 실패: ${goalErr.message}`);

  // client_id → manager_id 맵
  const clientToManager = new Map<string, number | null>();
  for (const c of clientRows ?? []) {
    clientToManager.set(c.client_id as string, (c.manager_id ?? null) as number | null);
  }

  // 매니저 필터 + 일별 합산
  const dailyMap = new Map<string, DailyTotalRow>();
  for (const r of serviceRows) {
    const cid = r.client_id as string;
    const mid = clientToManager.get(cid) ?? null;
    if (managerId !== null && mid !== managerId) continue;

    const cur = dailyMap.get(r.date as string);
    const cost = Number(r.cost_spent ?? 0);
    const ad = Number(r.ad_revenue ?? 0);
    const vimp = Number(r.vimp ?? 0);
    if (cur) {
      cur.cost_spent += cost;
      cur.ad_revenue += ad;
      cur.vimp += vimp;
    } else {
      dailyMap.set(r.date as string, {
        date: r.date as string,
        cost_spent: cost,
        ad_revenue: ad,
        vimp,
      });
    }
  }
  const rows = Array.from(dailyMap.values()).sort((a, b) =>
    a.date.localeCompare(b.date),
  );

  // 목표 매칭: managerId === null → manager_id IS NULL (team), else manager_id === managerId
  const matchingGoal = (goalRows ?? []).find((g) =>
    managerId === null ? g.manager_id === null : g.manager_id === managerId,
  );
  const vimpGoal = matchingGoal
    ? Number(matchingGoal.vimp_target ?? 0) || null
    : null;

  return aggregateMonthlyBoard({
    rows,
    monthKey: targetMonth,
    vimpGoal,
  });
}
