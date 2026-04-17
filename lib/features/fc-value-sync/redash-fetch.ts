/**
 * FC sync 용 Redash Trino (EDA) 쿼리 실행.
 *
 * 세 가지 조회:
 *  - fetchDwFcMetrics(widget, range): 리포트 페이지용 일자별 메트릭
 *    (D, G, a, b, c, d, M, vendor_source)
 *  - fetchDwSnapshot(widget, date): cron 이력화용 S/T 현재값 (UnitPriceValue)
 *  - fetchDwFcMap(widgetIds): FC prefetch (WIDGET_SETTING override > WIDGET.default_settings JSON)
 *
 * 기존 `lib/features/daily-redash-import/redash-fetch.ts` 의 POST+Polling 패턴 기반.
 * 단, 해당 모듈은 사전-정의된 Redash 쿼리 id 를 호출하지만 여기는
 * adhoc SQL(런타임 조립) 을 실행한다 → `/api/query_results` 엔드포인트 사용.
 *
 * DATA_SOURCE_ID 는 307 (EDA Trino) — smoke test(2026-04-17) 로 확인.
 */

import type { ExternalFcAutoInputs } from "@/types/fc";
import type { UnitPriceValue } from "@/types/external";
import { vendorIdToSlug } from "@/lib/logic/external-fc-vendors";

// ---------------------------------------------------------------------------
// Test injection hook
// ---------------------------------------------------------------------------
let fetchImpl: typeof fetch | undefined;
export function __setFetchForTesting(f: typeof fetch | undefined): void {
  fetchImpl = f;
}
function $fetch(
  ...args: Parameters<typeof fetch>
): ReturnType<typeof fetch> {
  return (fetchImpl ?? globalThis.fetch)(...args);
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const REDASH_BASE = "https://redash.dable.io";
const EDA_TRINO_DATA_SOURCE_ID = 307;
const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 300; // 2초 × 300 = 10분

interface RedashJobEnvelope {
  job: {
    id: string;
    status: number; // 1=pending, 2=started, 3=success, 4=failure, 5=cancelled
    error?: string;
    query_result_id?: number;
  };
}

interface RedashResultEnvelope<Row> {
  query_result: {
    data: {
      rows: Row[];
    };
  };
}

function redashHeaders(apiKey: string): HeadersInit {
  return {
    Authorization: `Key ${apiKey}`,
    "Content-Type": "application/json",
  };
}

async function pollJob(jobId: string, apiKey: string): Promise<number> {
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    const res = await $fetch(`${REDASH_BASE}/api/jobs/${jobId}`, {
      headers: redashHeaders(apiKey),
    });
    if (!res.ok) {
      throw new Error(`Redash job 상태 조회 실패: HTTP ${res.status}`);
    }
    const data = (await res.json()) as RedashJobEnvelope;
    const { status, error, query_result_id } = data.job;
    if (status === 3 && query_result_id) return query_result_id;
    if (status === 4) {
      throw new Error(
        `Redash 쿼리 실행 실패: ${error ?? "알 수 없는 오류"} (job=${jobId})`,
      );
    }
    if (status === 5) {
      throw new Error(`Redash 쿼리 실행 취소됨 (job=${jobId})`);
    }
  }
  throw new Error(`Redash 쿼리 실행 시간 초과 (10분, job=${jobId})`);
}

async function fetchQueryResult<Row>(
  queryResultId: number,
  apiKey: string,
): Promise<Row[]> {
  const res = await $fetch(
    `${REDASH_BASE}/api/query_results/${queryResultId}`,
    { headers: redashHeaders(apiKey) },
  );
  if (!res.ok) {
    throw new Error(`Redash 결과 조회 실패: HTTP ${res.status}`);
  }
  const data = (await res.json()) as RedashResultEnvelope<Row>;
  return data.query_result.data.rows;
}

/**
 * Adhoc SQL 을 EDA Trino 에서 실행하고 행 배열 반환.
 *
 * 주의: `sql` 은 런타임에 조립되므로, 파라미터 값(`widgetId`, 날짜 등) 은
 * 호출자 책임으로 trusted source (내부 DB) 에서 와야 한다. 외부 입력을
 * 그대로 이 함수에 전달하면 SQL injection 위험.
 */
async function runAdhocQuery<Row>(sql: string, apiKey: string): Promise<Row[]> {
  const res = await $fetch(`${REDASH_BASE}/api/query_results`, {
    method: "POST",
    headers: redashHeaders(apiKey),
    body: JSON.stringify({
      query: sql,
      data_source_id: EDA_TRINO_DATA_SOURCE_ID,
      max_age: 0,
    }),
  });
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new Error("Redash 인증 실패 — REDASH_API_KEY 확인");
    }
    throw new Error(`Redash adhoc query failed: HTTP ${res.status}`);
  }
  const json = (await res.json()) as
    | RedashResultEnvelope<Row>
    | RedashJobEnvelope;

  if ("query_result" in json) {
    return json.query_result.data.rows;
  }
  if ("job" in json) {
    const resultId = await pollJob(json.job.id, apiKey);
    return fetchQueryResult<Row>(resultId, apiKey);
  }
  throw new Error("예상치 못한 Redash 응답 형식");
}

// ---------------------------------------------------------------------------
// fetchDwFcMetrics: 일자별 메트릭 (리포트 페이지용)
// ---------------------------------------------------------------------------

export interface FetchDwFcMetricsOpts {
  widgetId: string;
  startDate: string; // YYYY-MM-DD inclusive
  endDate: string;   // YYYY-MM-DD inclusive
  apiKey: string;
}

interface MetricRow {
  date: string;
  requests: number | null;
  passback_imp: number | null;
  dable_media_cost: number | null;
  dable_revenue: number | null;
  pb_media_cost: number | null;
  pb_revenue: number | null;
  rpm_dashboard: number | null;
  primary_vendor_id: number | null;
  vendor_imp: number | null;
}

/**
 * Widget 단위 일자별 FC 메트릭 조회 (리포트 페이지용).
 *
 * Trino 조인 3건:
 *  - ctr_4media: D(impressions), b(dsp1+dsp2), M(rpm)
 *  - actual_sharing_cost: a(media_fee_dsp1), c(media_fee_dsp3)
 *  - passback_stats: G(passback imp 합), d(passback revenue), primary_vendor_id
 */
export async function fetchDwFcMetrics(
  opts: FetchDwFcMetricsOpts,
): Promise<ExternalFcAutoInputs[]> {
  const sql = `
    WITH params AS (
      SELECT
        CAST('${opts.widgetId}' AS varchar) AS widget_id,
        CAST('${opts.startDate}' AS varchar) AS date_start,
        CAST('${opts.endDate}'   AS varchar) AS date_end
    ),
    ctr AS (
      SELECT
        local_basic_time AS date,
        widget_id,
        impressions AS requests,
        org_cost_spent_dsp1 + org_cost_spent_dsp2 AS dable_revenue,
        org_cost_spent,
        org_cost_spent * 1000.0 / NULLIF(impressions, 0) AS rpm_dashboard
      FROM fact_daily.ad_stats__daily_ctr_4media_by_service_widget
      WHERE widget_id = (SELECT widget_id FROM params)
        AND local_basic_time BETWEEN (SELECT date_start FROM params) AND (SELECT date_end FROM params)
    ),
    fee AS (
      SELECT
        local_basic_time AS date,
        widget_id,
        media_fee_dsp1 AS dable_media_cost,
        media_fee_dsp3 AS pb_media_cost
      FROM fact_daily.ad_stats__daily_actual_sharing_cost_by_service_widget
      WHERE widget_id = (SELECT widget_id FROM params)
        AND local_basic_time BETWEEN (SELECT date_start FROM params) AND (SELECT date_end FROM params)
    ),
    pb_agg AS (
      SELECT
        local_basic_time AS date,
        widget_id,
        SUM(CASE WHEN vendor_id IN (2,4,5) THEN impressions ELSE 0 END) AS passback_imp,
        SUM(CASE WHEN vendor_id IN (2,4,5) THEN COALESCE(org_cost_spent_krw,0) ELSE 0 END) AS pb_revenue
      FROM fact_daily.ad_stats__daily_passback_stats
      WHERE widget_id = (SELECT widget_id FROM params)
        AND local_basic_time BETWEEN (SELECT date_start FROM params) AND (SELECT date_end FROM params)
      GROUP BY local_basic_time, widget_id
    ),
    pb_primary AS (
      SELECT
        local_basic_time AS date,
        widget_id,
        vendor_id AS primary_vendor_id,
        ROW_NUMBER() OVER (
          PARTITION BY local_basic_time, widget_id
          ORDER BY impressions DESC,
                   CASE vendor_id WHEN 5 THEN 1 WHEN 4 THEN 2 WHEN 2 THEN 3 ELSE 4 END ASC
        ) AS rn
      FROM fact_daily.ad_stats__daily_passback_stats
      WHERE widget_id = (SELECT widget_id FROM params)
        AND local_basic_time BETWEEN (SELECT date_start FROM params) AND (SELECT date_end FROM params)
        AND vendor_id IN (2,4,5)
        AND impressions > 0
    )
    SELECT
      ctr.date,
      COALESCE(ctr.requests, 0)         AS requests,
      COALESCE(pb_agg.passback_imp, 0)  AS passback_imp,
      COALESCE(fee.dable_media_cost, 0) AS dable_media_cost,
      COALESCE(ctr.dable_revenue, 0)    AS dable_revenue,
      COALESCE(fee.pb_media_cost, 0)    AS pb_media_cost,
      COALESCE(pb_agg.pb_revenue, 0)    AS pb_revenue,
      COALESCE(ctr.rpm_dashboard, 0)    AS rpm_dashboard,
      pb_primary.primary_vendor_id      AS primary_vendor_id,
      0                                 AS vendor_imp
    FROM ctr
    LEFT JOIN fee     ON fee.date = ctr.date AND fee.widget_id = ctr.widget_id
    LEFT JOIN pb_agg  ON pb_agg.date = ctr.date AND pb_agg.widget_id = ctr.widget_id
    LEFT JOIN pb_primary
      ON pb_primary.date = ctr.date
      AND pb_primary.widget_id = ctr.widget_id
      AND pb_primary.rn = 1
    ORDER BY ctr.date
  `;

  const rows = await runAdhocQuery<MetricRow>(sql, opts.apiKey);
  return rows.map((r) => ({
    date: String(r.date),
    requests: Number(r.requests) || 0,
    passback_imp: Number(r.passback_imp) || 0,
    vendor_imp: Number(r.vendor_imp) || 0,
    dable_media_cost: Number(r.dable_media_cost) || 0,
    dable_revenue: Number(r.dable_revenue) || 0,
    pb_media_cost: Number(r.pb_media_cost) || 0,
    pb_revenue: Number(r.pb_revenue) || 0,
    rpm_dashboard: Number(r.rpm_dashboard) || 0,
    vendor_source:
      r.primary_vendor_id != null
        ? vendorIdToSlug(Number(r.primary_vendor_id))
        : null,
  }));
}

// ---------------------------------------------------------------------------
// fetchDwSnapshot: cron 용 현재 S/T/FC 스냅샷
// ---------------------------------------------------------------------------

export interface FetchDwSnapshotOpts {
  widgetId: string;
  date: string;
  apiKey: string;
}

interface SnapshotRow {
  internal_cpm: number | null;
  vendor_2_cpm: number | null;
  vendor_4_cpm: number | null;
  vendor_5_cpm: number | null;
}

/**
 * 지정 date 의 widget 당 S(internal) / T(per-vendor CPM) 스냅샷 조회.
 *
 * cron 이력화 용도: Redash 결과를 `UnitPriceValue` 로 그대로 합성해서
 * `media.external_value` 테이블에 upsert 할 때 diff 비교에 사용.
 *
 * `FC` 는 fetchDwFcMap 으로 별도 prefetch 후 호출부에서 메모리 주입.
 */
export async function fetchDwSnapshot(
  opts: FetchDwSnapshotOpts,
): Promise<UnitPriceValue> {
  const sql = `
    WITH params AS (
      SELECT
        CAST('${opts.widgetId}' AS varchar) AS widget_id,
        CAST('${opts.date}' AS varchar) AS d
    )
    SELECT
      (SELECT MAX(share_value)
         FROM fact_daily.ad_stats__daily_actual_sharing_cost_by_service_widget
         WHERE widget_id = (SELECT widget_id FROM params)
           AND local_basic_time = (SELECT d FROM params)
           AND share_type = 'cpm') AS internal_cpm,
      (SELECT MAX(cpm_value)
         FROM fact_daily.ad_stats__daily_passback_stats
         WHERE widget_id = (SELECT widget_id FROM params)
           AND local_basic_time = (SELECT d FROM params)
           AND vendor_id = 2) AS vendor_2_cpm,
      (SELECT MAX(cpm_value)
         FROM fact_daily.ad_stats__daily_passback_stats
         WHERE widget_id = (SELECT widget_id FROM params)
           AND local_basic_time = (SELECT d FROM params)
           AND vendor_id = 4) AS vendor_4_cpm,
      (SELECT MAX(cpm_value)
         FROM fact_daily.ad_stats__daily_passback_stats
         WHERE widget_id = (SELECT widget_id FROM params)
           AND local_basic_time = (SELECT d FROM params)
           AND vendor_id = 5) AS vendor_5_cpm
      -- fc 는 fetchDwFcMap 으로 prefetch, 호출부에서 메모리 주입
  `;

  const rows = await runAdhocQuery<SnapshotRow>(sql, opts.apiKey);
  if (rows.length === 0) return {};

  const r = rows[0];
  const result: UnitPriceValue = {};
  if (r.internal_cpm != null) result.internal = Number(r.internal_cpm);
  if (r.vendor_2_cpm != null) result.syncmedia = Number(r.vendor_2_cpm);
  if (r.vendor_4_cpm != null) result.klmedia = Number(r.vendor_4_cpm);
  if (r.vendor_5_cpm != null) result.friendplus = Number(r.vendor_5_cpm);
  return result;
}

// ---------------------------------------------------------------------------
// fetchDwFcMap: cron 용 FC prefetch (widget override > default JSON)
// ---------------------------------------------------------------------------

const VALID_WIDGET_ID = /^[A-Za-z0-9_-]{1,32}$/;

export interface FetchDwFcMapOpts {
  widgetIds: string[];
  apiKey: string;
}

/**
 * mysql_reco_re.dable.{WIDGET, WIDGET_SETTING} 에서 widget 별 현재 FC 를 1회 쿼리로 조회.
 *
 * 우선순위 (C1 2-tier):
 *   1. WIDGET_SETTING.value WHERE key='ad_low_rpm_passback'   (widget override)
 *   2. json_extract_scalar(WIDGET.default_settings, '$.passback.ad_low_rpm_passback')
 *
 * SERVICE_SETTING fallback 은 현 범위 제외 (후속 task).
 *
 * 반환: Map<widget_id, fc>.
 *   - DW 의 WIDGET 테이블에 해당 widget_id 가 없으면 Map 에 key 자체 없음
 *   - row 는 있으나 override/default 양쪽 모두 NULL 이면 key 포함 + value=null
 */
export async function fetchDwFcMap(
  opts: FetchDwFcMapOpts,
): Promise<Map<string, number | null>> {
  for (const id of opts.widgetIds) {
    if (!VALID_WIDGET_ID.test(id)) {
      throw new Error(`Invalid widget_id format: ${id}`);
    }
  }
  if (opts.widgetIds.length === 0) {
    return new Map();
  }

  const valuesList = opts.widgetIds.map((id) => `('${id}')`).join(", ");
  const sql = `
    WITH target AS (
      SELECT widget_id FROM (VALUES ${valuesList}) AS t(widget_id)
    )
    SELECT
      w.widget_id,
      COALESCE(
        TRY_CAST(ws.value AS integer),
        TRY_CAST(
          json_extract_scalar(CAST(w.default_settings AS varchar),
                              '$.passback.ad_low_rpm_passback')
          AS integer
        )
      ) AS fc
    FROM mysql_reco_re.dable.WIDGET w
    JOIN target t ON t.widget_id = w.widget_id
    LEFT JOIN mysql_reco_re.dable.WIDGET_SETTING ws
           ON w.widget_id = ws.widget_id
          AND ws.key = 'ad_low_rpm_passback'
  `;

  interface FcRow {
    widget_id: string;
    fc: number | null;
  }
  const rows = await runAdhocQuery<FcRow>(sql, opts.apiKey);

  const map = new Map<string, number | null>();
  for (const r of rows) {
    map.set(String(r.widget_id), r.fc == null ? null : Number(r.fc));
  }
  return map;
}
