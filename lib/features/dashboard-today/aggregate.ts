/**
 * media.hourly_snapshot rows → Today Status Board view model 변환.
 *
 * 입력: KR_native 매체 합산의 시간별 row (오늘 + 직전 7~10 영업일).
 * 출력: TodayBoard — metric 별 cards + series + currentHour + referenceTime.
 *
 * 원칙 (ads-data-board 패턴 준용):
 *  - weekday = mon-fri (공휴일 미제외)
 *  - cumulative metric (revenue, vimp): 0..h 합
 *  - rate metric (mfr, cpc, vctr): hour h 의 raw 값 (누적 X)
 *  - vctr / mfr 는 percent 단위 (0.28 == 0.28%)
 *  - projection (cumulative metric, hours currentHour+1..23):
 *      scale = currCum / pastWeekdayAvg[currentHour] (fallback 24/(currentHour+1))
 *      projectedToday[h] = scale × pastWeekdayAvg[h]
 */

export type MetricKey = "revenue" | "vimp" | "cpc" | "vctr" | "mfr";

/** DB row shape — media.hourly_snapshot 의 필요 컬럼만. */
export interface HourlySnapshotRow {
  date_kst: string;
  hour_kst: number;
  revenue_krw: number;
  vimp: number;
  cpc: number | null;
  vctr_pct: number | null;
  mfr_pct: number | null;
}

const CUMULATIVE_METRICS: ReadonlySet<MetricKey> = new Set<MetricKey>([
  "revenue",
  "vimp",
]);

const METRICS: MetricKey[] = ["revenue", "vimp", "cpc", "vctr", "mfr"];

export interface CardData {
  current: number;
  yesterdaySameHour: number;
  pastWeekdayAvgSameHour: number;
}

export interface SeriesData {
  /** length 24, currentHour 이후는 null */
  today: (number | null)[];
  /** length 24, cumulative metric 의 currentHour+1..23 만 채움 */
  projectedToday: (number | null)[];
  /** length 24 */
  yesterday: number[];
  /** length 24 */
  pastWeekdayAvg: number[];
}

export interface TodayBoard {
  cards: Record<MetricKey, CardData>;
  series: Record<MetricKey, SeriesData>;
  currentHour: number;
  referenceTime: string;
}

function isWeekday(dateStr: string): boolean {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return dow >= 1 && dow <= 5;
}

function previousKstDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const prev = new Date(Date.UTC(y, m - 1, d));
  prev.setUTCDate(prev.getUTCDate() - 1);
  return `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, "0")}-${String(prev.getUTCDate()).padStart(2, "0")}`;
}

function metricRawValue(r: HourlySnapshotRow, metric: MetricKey): number {
  switch (metric) {
    case "revenue":
      return r.revenue_krw;
    case "vimp":
      return r.vimp;
    case "cpc":
      return r.cpc ?? 0;
    case "vctr":
      return r.vctr_pct ?? 0;
    case "mfr":
      return r.mfr_pct ?? 0;
  }
}

function hourArrayFor(
  rows: HourlySnapshotRow[],
  date: string,
  metric: MetricKey,
): number[] {
  const arr = new Array<number>(24).fill(0);
  for (const r of rows) {
    if (r.date_kst !== date) continue;
    const h = r.hour_kst;
    if (h >= 0 && h <= 23) {
      const v = metricRawValue(r, metric);
      if (Number.isFinite(v)) arr[h] = v;
    }
  }
  return arr;
}

function toCumulative(arr: number[]): number[] {
  const out = new Array<number>(24);
  let s = 0;
  for (let i = 0; i < 24; i++) {
    s += arr[i];
    out[i] = s;
  }
  return out;
}

function averageArrays(arrs: number[][]): number[] {
  const out = new Array<number>(24).fill(0);
  const n = arrs.length;
  if (n === 0) return out;
  for (let h = 0; h < 24; h++) {
    let s = 0;
    for (const a of arrs) s += a[h];
    out[h] = s / n;
  }
  return out;
}

/**
 * Pure transformation: flat Supabase rows → TodayBoard.
 *
 * @param rows      14일 이내 KR_native 매체 hourly snapshot row
 * @param todayDate KST 기준 today YYYY-MM-DD
 */
export function aggregateHourlyBoard(
  rows: HourlySnapshotRow[],
  todayDate: string,
): TodayBoard {
  const yesterdayDate = previousKstDate(todayDate);

  const allDates = new Set<string>();
  for (const r of rows) allDates.add(r.date_kst);
  const pastWeekdayDates: string[] = [];
  for (const d of allDates) {
    if (d !== todayDate && isWeekday(d)) pastWeekdayDates.push(d);
  }

  // currentHour — revenue 가 마지막으로 0 보다 컸던 hour
  const todayRevRaw = hourArrayFor(rows, todayDate, "revenue");
  let currentHour = -1;
  for (let h = 23; h >= 0; h--) {
    if (todayRevRaw[h] > 0) {
      currentHour = h;
      break;
    }
  }

  const series = {} as Record<MetricKey, SeriesData>;
  const cards = {} as Record<MetricKey, CardData>;

  for (const metric of METRICS) {
    const cumulative = CUMULATIVE_METRICS.has(metric);
    const todayRaw = hourArrayFor(rows, todayDate, metric);
    const yesterdayRaw = hourArrayFor(rows, yesterdayDate, metric);
    const weekdayRaws = pastWeekdayDates.map((d) =>
      hourArrayFor(rows, d, metric),
    );

    const todayDisplay = cumulative ? toCumulative(todayRaw) : todayRaw.slice();
    const yesterdayDisplay = cumulative
      ? toCumulative(yesterdayRaw)
      : yesterdayRaw.slice();
    const weekdayDisplays = weekdayRaws.map((a) =>
      cumulative ? toCumulative(a) : a.slice(),
    );
    const pastWeekdayAvg = averageArrays(weekdayDisplays);

    const today: (number | null)[] = todayDisplay.map((v, h) =>
      currentHour >= 0 && h <= currentHour ? v : null,
    );

    const projectedToday: (number | null)[] = new Array(24).fill(null);
    if (cumulative && currentHour >= 0 && currentHour < 23) {
      const currCum = todayDisplay[currentHour];
      const pastAtCurrent = pastWeekdayAvg[currentHour];
      const scale =
        pastAtCurrent > 0 ? currCum / pastAtCurrent : 24 / (currentHour + 1);
      projectedToday[currentHour] = currCum;
      for (let h = currentHour + 1; h <= 23; h++) {
        projectedToday[h] = scale * pastWeekdayAvg[h];
      }
    }

    series[metric] = {
      today,
      projectedToday,
      yesterday: yesterdayDisplay,
      pastWeekdayAvg,
    };

    const sampleHour = currentHour >= 0 ? currentHour : 0;
    cards[metric] = {
      current: todayDisplay[sampleHour],
      yesterdaySameHour: yesterdayDisplay[sampleHour],
      pastWeekdayAvgSameHour: pastWeekdayAvg[sampleHour],
    };
  }

  const referenceTime =
    currentHour >= 0 ? `${String(currentHour).padStart(2, "0")}:00` : "--:--";

  return { cards, series, currentHour, referenceTime };
}
