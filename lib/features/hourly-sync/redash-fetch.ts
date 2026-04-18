/**
 * hourly-sync Redash ad-hoc 쿼리 모듈.
 *
 * KR_native 매체 전사 합산의 시간대별 성과 (date_kst, hour_kst) row 를 한 번에 반환.
 *
 * Trino 데이터 소스 (data_source_id=307) 에 ad-hoc SQL POST 후 polling.
 * SQL 은 _hourly-reference/260418-media-hourly_service_snapshot.sql 의 enhanced 버전:
 *  - revenue_self_dsp (1.15 hourly_ctr_4media_by_service)
 *  - media_fee_self_dsp (1.13 hourly_media_fee_by_widget)
 *  - revenue_passback / media_fee_passback (1.12-a hourly imp × 1.12 widget-daily 수신 CPM
 *    / 1.12-b setting 지급 CPM, 두 CPM 분리)
 *  - fill_rate (1.18 hourly_fill_rate)
 *  - cutoff_kst_hour 메타
 * 모두 KR_native 만 (s.country='KR', ADX4 자동 제외).
 *
 * REDASH_API_KEY 환경변수 필수 (server-only). 응답 캐시 미존재 시 2초 간격 polling
 * (최대 300회 = 10분).
 */

const REDASH_BASE_URL = "https://redash.dable.io";
const DATA_SOURCE_ID = 307;
const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 300;

export interface TrinoHourlyRow {
  date_kst: string;
  hour_kst: number;
  revenue_self_dsp_krw: number;
  revenue_passback_krw: number;
  revenue_krw: number;
  media_fee_self_dsp_krw: number;
  media_fee_passback_krw: number;
  media_fee_krw: number;
  impressions: number;
  vimp: number;
  clicks: number;
  passback_imp: number;
  ad_request_items: number | null;
  ad_response_items: number | null;
  cutoff_kst_hour: number | null;
}

interface JobResponse {
  job?: {
    id: string;
    status: number;
    error?: string;
    query_result_id?: number;
  };
  query_result?: { data: { rows: Record<string, unknown>[] } };
}

interface ResultResponse {
  query_result: { data: { rows: Record<string, unknown>[] } };
}

function headers(): HeadersInit {
  const apiKey = process.env.REDASH_API_KEY;
  if (!apiKey) {
    throw new Error("REDASH_API_KEY 환경변수가 설정되지 않았습니다.");
  }
  return {
    Authorization: `Key ${apiKey}`,
    "Content-Type": "application/json",
  };
}

async function pollJob(jobId: string): Promise<number> {
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const res = await fetch(`${REDASH_BASE_URL}/api/jobs/${jobId}`, {
      headers: headers(),
    });
    if (!res.ok) throw new Error(`Job 상태 조회 실패: HTTP ${res.status}`);
    const { job } = (await res.json()) as JobResponse;
    if (!job) throw new Error("job 필드 없음");
    if (job.status === 3 && job.query_result_id) return job.query_result_id;
    if (job.status === 4) {
      throw new Error(`쿼리 실행 실패: ${job.error ?? "unknown"} (job=${jobId})`);
    }
    if (job.status === 5) {
      throw new Error(`쿼리 실행 취소됨 (job=${jobId})`);
    }
  }
  throw new Error(`쿼리 실행 시간 초과 (10분, job=${jobId})`);
}

async function fetchResult(queryResultId: number): Promise<Record<string, unknown>[]> {
  const res = await fetch(
    `${REDASH_BASE_URL}/api/query_results/${queryResultId}`,
    { headers: headers() },
  );
  if (!res.ok) throw new Error(`결과 조회 실패: HTTP ${res.status}`);
  const data = (await res.json()) as ResultResponse;
  return data.query_result.data.rows;
}

async function runAdhoc(sql: string): Promise<Record<string, unknown>[]> {
  const executeRes = await fetch(`${REDASH_BASE_URL}/api/query_results`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      query: sql,
      data_source_id: DATA_SOURCE_ID,
      max_age: 0,
    }),
  });
  if (!executeRes.ok) {
    if (executeRes.status === 401 || executeRes.status === 403) {
      throw new Error("Redash 인증 실패 — REDASH_API_KEY 확인");
    }
    throw new Error(`Redash 요청 실패: HTTP ${executeRes.status}`);
  }
  const body = (await executeRes.json()) as JobResponse;
  if (body.query_result) return body.query_result.data.rows;
  if (body.job) {
    const resultId = await pollJob(body.job.id);
    return fetchResult(resultId);
  }
  throw new Error("예상치 못한 Redash 응답 형식");
}

/**
 * KR_native 매체 hourly snapshot SQL 빌드.
 *
 * 두 CPM 분리 — passback CTE 의 가장 중요한 로직:
 *  - vendor_to_dable_cpm = SUM(org_cost_spent_krw) × 1000 / SUM(impressions)
 *      → revenue_passback_krw 재구성에만 사용
 *  - dable_to_media_cpm  = SUM(impressions × setting.value) / SUM(impressions)
 *      → media_fee_passback_krw 재구성에만 사용
 *
 * 두 CPM 을 혼용하면 mfr 이 100% 가 됨 (구버전 SQL 의 명명 버그).
 *
 * widget_daily_cpm 은 (date, service, widget) 단위 weighted 평균. vendor 는
 * group by 에서 제외하고 imp 로 가중평균하여 widget 당 1행으로 축약 — passback_hourly
 * 의 LEFT JOIN 이 1:1 이 되도록.
 */
function buildSnapshotSql(dateStart: string, dateEnd: string): string {
  return `
WITH params AS (
  SELECT DATE '${dateStart}' AS date_start, DATE '${dateEnd}' AS date_end
),
utc_bounds AS (
  SELECT
    CAST(date_start - INTERVAL '1' DAY AS varchar) || '-15' AS utc_start,
    CAST(date_end   AS varchar)                    || '-14' AS utc_end
  FROM params
),
revenue_hourly AS (
  SELECT
    CAST(date_add('hour', 9, date_parse(f.utc_basic_time, '%Y-%m-%d-%H')) AS DATE) AS date_kst,
    hour(date_add('hour', 9, date_parse(f.utc_basic_time, '%Y-%m-%d-%H')))         AS hour_kst,
    f.service_id,
    SUM(f.org_cost_spent) AS revenue_self_dsp_krw,
    SUM(f.impressions)    AS impressions,
    SUM(f.exposes)        AS exposes,
    SUM(f.clicks)         AS clicks
  FROM fact_hourly.ad_stats__hourly_ctr_4media_by_service f, utc_bounds u
  WHERE f.utc_basic_time BETWEEN u.utc_start AND u.utc_end
  GROUP BY 1, 2, 3
),
self_dsp_fee_hourly AS (
  SELECT
    CAST(date_add('hour', 9, date_parse(h.utc_basic_time, '%Y-%m-%d-%H')) AS DATE) AS date_kst,
    hour(date_add('hour', 9, date_parse(h.utc_basic_time, '%Y-%m-%d-%H')))         AS hour_kst,
    h.service_id,
    SUM(h.media_fee_krw) AS media_fee_self_dsp_krw
  FROM fact_hourly.ad_stats__hourly_media_fee_by_widget h, utc_bounds u
  WHERE h.utc_basic_time BETWEEN u.utc_start AND u.utc_end
  GROUP BY 1, 2, 3
),
widget_daily_cpm AS (
  SELECT
    CAST(p.local_basic_time AS DATE) AS date_kst,
    p.service_id,
    p.widget_id,
    SUM(p.org_cost_spent_krw) * 1000.0 / NULLIF(SUM(p.impressions), 0) AS vendor_to_dable_cpm,
    SUM(p.impressions * COALESCE(st.value, 0)) * 1.0 / NULLIF(SUM(p.impressions), 0) AS dable_to_media_cpm
  FROM fact_daily.ad_stats__daily_passback_stats p
  LEFT JOIN dimensional_reco.dable_media_income__passback_setting__latest st
    ON p.widget_id = st.widget_id
   AND p.vendor_id = st.vendor_id
   AND st.deleted = 0
   AND st.start_time <= CAST(p.local_basic_time AS timestamp)
   AND st.end_time   >  CAST(p.local_basic_time AS timestamp)
  CROSS JOIN params pm
  WHERE p.local_basic_time BETWEEN CAST(pm.date_start AS varchar) AND CAST(pm.date_end AS varchar)
    AND p.vendor_id > 0
    AND p.impressions > 0
  GROUP BY 1, 2, 3
),
passback_hourly AS (
  SELECT
    CAST(date_add('hour', 9, date_parse(pb.utc_basic_time, '%Y-%m-%d-%H')) AS DATE) AS date_kst,
    hour(date_add('hour', 9, date_parse(pb.utc_basic_time, '%Y-%m-%d-%H')))         AS hour_kst,
    pb.service_id,
    SUM(pb.ad_widget_impressions)                                                  AS passback_imp,
    SUM(pb.ad_widget_impressions * COALESCE(c.vendor_to_dable_cpm, 0) / 1000.0)    AS revenue_passback_krw,
    SUM(pb.ad_widget_impressions * COALESCE(c.dable_to_media_cpm, 0) / 1000.0)     AS media_fee_passback_krw
  FROM fact_hourly.ad_passback_summary pb
  LEFT JOIN widget_daily_cpm c
    ON CAST(date_add('hour', 9, date_parse(pb.utc_basic_time, '%Y-%m-%d-%H')) AS DATE) = c.date_kst
   AND pb.service_id = c.service_id
   AND pb.widget_id  = c.widget_id
  CROSS JOIN utc_bounds u
  WHERE pb.utc_basic_time BETWEEN u.utc_start AND u.utc_end
  GROUP BY 1, 2, 3
),
fill_rate_hourly AS (
  SELECT
    CAST(date_add('hour', 9, date_parse(f.utc_basic_time, '%Y-%m-%d-%H')) AS DATE) AS date_kst,
    hour(date_add('hour', 9, date_parse(f.utc_basic_time, '%Y-%m-%d-%H')))         AS hour_kst,
    f.service_id,
    SUM(f.ad_request_items)  AS ad_request_items,
    SUM(f.ad_response_items) AS ad_response_items
  FROM fact_hourly.ad_stats__hourly_fill_rate f, utc_bounds u
  WHERE f.utc_basic_time BETWEEN u.utc_start AND u.utc_end
  GROUP BY 1, 2, 3
),
cutoff AS (
  SELECT
    hour(date_add('hour', 9, date_parse(MAX(f.utc_basic_time), '%Y-%m-%d-%H'))) AS cutoff_kst_hour
  FROM fact_hourly.ad_stats__hourly_ctr_4media_by_service f, utc_bounds u, params pm
  WHERE f.utc_basic_time BETWEEN u.utc_start AND u.utc_end
    AND CAST(date_add('hour', 9, date_parse(f.utc_basic_time, '%Y-%m-%d-%H')) AS DATE) = pm.date_end
)
SELECT
  CAST(r.date_kst AS varchar) AS date_kst,
  r.hour_kst,
  CAST(SUM(r.revenue_self_dsp_krw) AS BIGINT) AS revenue_self_dsp_krw,
  CAST(SUM(COALESCE(ph.revenue_passback_krw, 0)) AS BIGINT) AS revenue_passback_krw,
  CAST(SUM(r.revenue_self_dsp_krw + COALESCE(ph.revenue_passback_krw, 0)) AS BIGINT) AS revenue_krw,
  CAST(SUM(COALESCE(sd.media_fee_self_dsp_krw, 0)) AS BIGINT) AS media_fee_self_dsp_krw,
  CAST(SUM(COALESCE(ph.media_fee_passback_krw, 0)) AS BIGINT) AS media_fee_passback_krw,
  CAST(SUM(COALESCE(sd.media_fee_self_dsp_krw, 0) + COALESCE(ph.media_fee_passback_krw, 0)) AS BIGINT) AS media_fee_krw,
  CAST(SUM(r.impressions) AS BIGINT) AS impressions,
  CAST(SUM(r.exposes) AS BIGINT) AS vimp,
  CAST(SUM(r.clicks) AS BIGINT) AS clicks,
  CAST(SUM(COALESCE(ph.passback_imp, 0)) AS BIGINT) AS passback_imp,
  CAST(SUM(COALESCE(fr.ad_request_items, 0)) AS BIGINT) AS ad_request_items,
  CAST(SUM(COALESCE(fr.ad_response_items, 0)) AS BIGINT) AS ad_response_items,
  co.cutoff_kst_hour
FROM revenue_hourly r
LEFT JOIN self_dsp_fee_hourly sd
  ON r.date_kst = sd.date_kst AND r.hour_kst = sd.hour_kst AND r.service_id = sd.service_id
LEFT JOIN passback_hourly ph
  ON r.date_kst = ph.date_kst AND r.hour_kst = ph.hour_kst AND r.service_id = ph.service_id
LEFT JOIN fill_rate_hourly fr
  ON r.date_kst = fr.date_kst AND r.hour_kst = fr.hour_kst AND r.service_id = fr.service_id
JOIN dimensional_reco.dable__service__latest s ON r.service_id = s.service_id
CROSS JOIN cutoff co
WHERE s.country = 'KR'
GROUP BY 1, 2, co.cutoff_kst_hour
ORDER BY 1 DESC, 2 DESC
`.trim();
}

function toDateKst(v: unknown): string {
  return String(v ?? "").slice(0, 10);
}

function toInt(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function toIntOrNull(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * KR_native 매체 시간별 snapshot 조회.
 *
 * @param dateStart YYYY-MM-DD KST inclusive
 * @param dateEnd   YYYY-MM-DD KST inclusive
 * @throws REDASH_API_KEY 미설정 / Redash 인증 실패 / 쿼리 폴링 타임아웃 / HTTP 오류
 */
export async function fetchHourlySnapshot(
  dateStart: string,
  dateEnd: string,
): Promise<TrinoHourlyRow[]> {
  const rows = await runAdhoc(buildSnapshotSql(dateStart, dateEnd));
  return rows.map((r) => ({
    date_kst: toDateKst(r.date_kst),
    hour_kst: toInt(r.hour_kst),
    revenue_self_dsp_krw: toInt(r.revenue_self_dsp_krw),
    revenue_passback_krw: toInt(r.revenue_passback_krw),
    revenue_krw: toInt(r.revenue_krw),
    media_fee_self_dsp_krw: toInt(r.media_fee_self_dsp_krw),
    media_fee_passback_krw: toInt(r.media_fee_passback_krw),
    media_fee_krw: toInt(r.media_fee_krw),
    impressions: toInt(r.impressions),
    vimp: toInt(r.vimp),
    clicks: toInt(r.clicks),
    passback_imp: toInt(r.passback_imp),
    ad_request_items: toIntOrNull(r.ad_request_items),
    ad_response_items: toIntOrNull(r.ad_response_items),
    cutoff_kst_hour: toIntOrNull(r.cutoff_kst_hour),
  }));
}
