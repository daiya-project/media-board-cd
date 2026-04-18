/**
 * media.v_daily_total → Dashboard Monthly view model 변환.
 *
 * 입력: 일별 합계 row (cost_spent, ad_revenue, vimp).
 *  - cost_spent = 광고주 광고비 = "매출" (UI 표기)
 *  - ad_revenue = pub_profit alias = MFR 계산용 (= 매체사 수익)
 *  - MFR = ad_revenue / cost_spent × 100 (%)
 *
 * 출력:
 *  - cards: { vimp, revenue, mfr } 각각 current/prev/changeRate
 *  - monthlyChart: 선택 월의 일별 누적 vIMP (1..lastDay)
 *  - dailyChart: 선택 월의 일별 MFR + Ad Revenue (1..lastDay)
 */

export interface DailyTotalRow {
  date: string;
  cost_spent: number;
  ad_revenue: number;
  vimp: number;
}

export interface MetricKpi {
  current: number;
  previous: number;
  changeAmount: number;
  changeRate: number | null;
}

export interface MonthlyKpis {
  monthLabel: string;
  prevMonthLabel: string;
  vimp: MetricKpi;
  revenue: MetricKpi;
  mfr: MetricKpi;
}

export interface VimpMonthlyPoint {
  day: number;
  /** "MM/DD" */
  label: string;
  /** cumulative vimp through this day in selected month, null if no data (실선) */
  current: number | null;
  /** linear daily goal cumulative — 월 목표 ÷ daysInMonth × day (실선) */
  goal: number | null;
  /** projected cumulative based on average daily pace, only for days > lastDataDay (점선) */
  projected: number | null;
}

export interface DailyMfrRevenuePoint {
  day: number;
  /** "MM/DD" */
  label: string;
  revenue: number | null;
  mfr: number | null;
}

export interface MonthlyBoard {
  monthKey: string;
  prevMonthKey: string;
  daysInMonth: number;
  lastDataDay: number;
  /** 월간 vIMP 목표 (선택 매니저 또는 팀 전체). null = 미설정. */
  vimpGoal: number | null;
  kpis: MonthlyKpis;
  monthlyChart: VimpMonthlyPoint[];
  dailyChart: DailyMfrRevenuePoint[];
}

// ---------------------------------------------------------------------------
// 날짜 유틸
// ---------------------------------------------------------------------------

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function ymdFromDate(d: Date): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

export function getMonthRange(monthKey: string): { start: string; end: string; daysInMonth: number } {
  const [y, m] = monthKey.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 0)); // last day of month (UTC trick)
  return {
    start: ymdFromDate(start),
    end: ymdFromDate(end),
    daysInMonth: end.getUTCDate(),
  };
}

export function previousMonthKey(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  const prev = new Date(Date.UTC(y, m - 2, 1));
  return `${prev.getUTCFullYear()}-${pad2(prev.getUTCMonth() + 1)}`;
}

function monthLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  return `${y}년 ${m}월`;
}

// ---------------------------------------------------------------------------
// MFR 계산
// ---------------------------------------------------------------------------

function calcMfr(adRevenue: number, costSpent: number): number {
  return costSpent > 0 ? (adRevenue / costSpent) * 100 : 0;
}

function makeKpi(current: number, previous: number): MetricKpi {
  const changeAmount = current - previous;
  const changeRate = previous > 0 ? (changeAmount / previous) * 100 : null;
  return { current, previous, changeAmount, changeRate };
}

// ---------------------------------------------------------------------------
// 월별 합계
// ---------------------------------------------------------------------------

interface MonthSums {
  vimp: number;
  costSpent: number;
  adRevenue: number;
}

function sumMonth(rows: DailyTotalRow[], monthKey: string): MonthSums {
  const [y, m] = monthKey.split("-").map(Number);
  const acc: MonthSums = { vimp: 0, costSpent: 0, adRevenue: 0 };
  for (const r of rows) {
    const [ry, rm] = r.date.split("-").map(Number);
    if (ry === y && rm === m) {
      acc.vimp += r.vimp;
      acc.costSpent += r.cost_spent;
      acc.adRevenue += r.ad_revenue;
    }
  }
  return acc;
}

// ---------------------------------------------------------------------------
// Monthly chart — vIMP 일별 누적 (선택 월 + 전월 비교)
// ---------------------------------------------------------------------------

function buildVimpMonthly(
  rows: DailyTotalRow[],
  monthKey: string,
  vimpGoal: number | null,
  lastDataDay: number,
): VimpMonthlyPoint[] {
  const [cy, cm] = monthKey.split("-").map(Number);
  const currentDays = new Date(Date.UTC(cy, cm, 0)).getUTCDate();
  const goalPerDay = vimpGoal !== null ? vimpGoal / currentDays : null;

  // 일별 vimp 합계
  const currentDaily = new Array<number>(currentDays).fill(0);
  for (const r of rows) {
    const [ry, rm, rd] = r.date.split("-").map(Number);
    if (ry === cy && rm === cm) {
      currentDaily[rd - 1] = r.vimp;
    }
  }

  // 누적 + 평균 페이스 산출
  const cumByDay = new Array<number>(currentDays).fill(0);
  let curCum = 0;
  for (let d = 1; d <= currentDays; d++) {
    curCum += currentDaily[d - 1];
    cumByDay[d - 1] = curCum;
  }
  const avgDailyPace =
    lastDataDay > 0 ? cumByDay[lastDataDay - 1] / lastDataDay : 0;

  const out: VimpMonthlyPoint[] = [];
  for (let d = 1; d <= currentDays; d++) {
    const isPast = d <= lastDataDay;
    const isFuture = d > lastDataDay && lastDataDay > 0;
    const projected = isFuture
      ? cumByDay[lastDataDay - 1] + avgDailyPace * (d - lastDataDay)
      : null;
    out.push({
      day: d,
      label: `${pad2(cm)}/${pad2(d)}`,
      current: isPast ? cumByDay[d - 1] : null,
      goal: goalPerDay !== null ? Math.round(goalPerDay * d) : null,
      // 점선이 실선 끝점에서 자연스럽게 이어지도록 lastDataDay 부터 시작
      projected:
        d === lastDataDay
          ? cumByDay[lastDataDay - 1]
          : projected,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Daily chart — 선택 월의 일별 MFR + Ad Revenue
// ---------------------------------------------------------------------------

function buildDailyMfrRevenue(
  rows: DailyTotalRow[],
  monthKey: string,
  lastDataDay: number,
): DailyMfrRevenuePoint[] {
  const [cy, cm] = monthKey.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(cy, cm, 0)).getUTCDate();

  // day 별 합 (v_daily_total 은 이미 일별이지만 안전하게 reduce)
  const daily = new Array<{ revenue: number; adRevenue: number } | null>(daysInMonth).fill(null);
  for (const r of rows) {
    const [ry, rm, rd] = r.date.split("-").map(Number);
    if (ry !== cy || rm !== cm) continue;
    const idx = rd - 1;
    const cur = daily[idx];
    if (cur) {
      cur.revenue += r.cost_spent;
      cur.adRevenue += r.ad_revenue;
    } else {
      daily[idx] = { revenue: r.cost_spent, adRevenue: r.ad_revenue };
    }
  }

  const out: DailyMfrRevenuePoint[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const v = daily[d - 1];
    const hasData = v !== null && d <= (lastDataDay || daysInMonth);
    out.push({
      day: d,
      label: `${pad2(cm)}/${pad2(d)}`,
      revenue: hasData ? v.revenue : null,
      mfr: hasData && v.revenue > 0 ? calcMfr(v.adRevenue, v.revenue) : null,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// 메인 진입점
// ---------------------------------------------------------------------------

export function aggregateMonthlyBoard(opts: {
  rows: DailyTotalRow[];
  monthKey: string;
  vimpGoal: number | null;
}): MonthlyBoard {
  const { rows, monthKey, vimpGoal } = opts;
  const prev = previousMonthKey(monthKey);
  const range = getMonthRange(monthKey);

  const cur = sumMonth(rows, monthKey);
  const prevSums = sumMonth(rows, prev);

  const kpis: MonthlyKpis = {
    monthLabel: monthLabel(monthKey),
    prevMonthLabel: monthLabel(prev),
    vimp: makeKpi(cur.vimp, prevSums.vimp),
    revenue: makeKpi(cur.costSpent, prevSums.costSpent),
    mfr: makeKpi(calcMfr(cur.adRevenue, cur.costSpent), calcMfr(prevSums.adRevenue, prevSums.costSpent)),
  };

  let lastDataDay = 0;
  const [cy, cm] = monthKey.split("-").map(Number);
  for (const r of rows) {
    const [ry, rm, rd] = r.date.split("-").map(Number);
    if (ry === cy && rm === cm && r.vimp > 0 && rd > lastDataDay) lastDataDay = rd;
  }

  const monthlyChart = buildVimpMonthly(rows, monthKey, vimpGoal, lastDataDay);
  const dailyChart = buildDailyMfrRevenue(rows, monthKey, lastDataDay);

  return {
    monthKey,
    prevMonthKey: prev,
    daysInMonth: range.daysInMonth,
    lastDataDay,
    vimpGoal,
    kpis,
    monthlyChart,
    dailyChart,
  };
}
