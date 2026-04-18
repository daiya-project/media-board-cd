# Dashboard — Today Hourly Section (오늘 시간대 트렌드 보드)

> 작성일: 2026-04-19
> 위치: `/dashboard` 페이지 하단 (DashboardClient 의 마지막 섹션)
> 데이터 원천: `media.hourly_snapshot` (Supabase) ← Redash Trino cron 적재
> 패턴 참조: 광고주 사이드 `ads-data-board-cd` 의 Today Status Board 와 동일 구조 (스냅샷: `_hourly-reference/`)

이 문서는 **대시보드 페이지 하단의 "오늘 시간대 트렌드 vs 과거 베이스라인 비교" 섹션** 의 데이터 흐름·계산 로직·UI 구조를 권위 있게 기술한다. 매출/매체비 분해의 의미 해석은 → [`01-infra-08-data-3rd_party.md`](./01-infra-08-data-3rd_party.md) 참조.

---

## 1. 개요

### 1.1 목적

매체사 운영자가 **"오늘 어느 시간대까지의 누적 성과가 직전 N영업일 평균 대비 어떤 추세인지"** 를 한눈에 보고, 이상 추세 발생 시 즉시 인지할 수 있도록 하는 실시간 모니터링 보드.

**핵심 질문**:
- 오늘 KST 14시 누적 매출이 평소 (직전 평일 평균) 14시 누적 대비 +5%? -10%?
- MFR 이 평소보다 높지 않은가?
- Fill rate 이 갑자기 떨어지지 않았나?
- 시간대별 vimp / cpc / vctr / erpm 이 평소 곡선 모양과 다른가?

### 1.2 사용 대상

- 매체사 매니저 / 영업 담당자 — 오늘 매출 추이 모니터링
- 데이터 운영팀 — 이상 감지 후 원인 분석 (MFR/Fill Rate 진단 SOP 로 진행)
- 데이블 내부 — Passback / DSP1 비중 트래킹

### 1.3 비교 단위

- **오늘 (partial today)** vs **직전 N영업일 평균 (mon-fri 만)**
- **국가**: KR_native 매체 전사 합산 (ADX4 4개 서비스 자동 제외 — US 등록이라 hourly 팩트 1.13 미적재)
- **시간 단위**: KST 시 (0~23)

---

## 2. 데이터 흐름 전체도

```
[Trino 데이터 웨어하우스]
  ├─ fact_hourly.ad_stats__hourly_ctr_4media_by_service (1.15)        ← self DSP 매출/노출/클릭
  ├─ fact_hourly.ad_stats__hourly_media_fee_by_widget   (1.13)        ← self DSP 매체비
  ├─ fact_hourly.ad_passback_summary                    (1.12-a)      ← passback hourly imp
  ├─ fact_daily.ad_stats__daily_passback_stats          (1.12)        ← widget × vendor 일별 수신 CPM
  ├─ dimensional_reco.dable_media_income__passback_setting__latest    ← widget × vendor 지급 CPM
  ├─ fact_hourly.ad_stats__hourly_fill_rate             (1.18)        ← Fill rate
  └─ dimensional_reco.dable__service__latest                          ← KR 매체 화이트리스트
       │
       │ POST /api/queries/{id}/results (ad-hoc, Authorization: Key <REDASH_API_KEY>)
       │ Polling: 2s 간격, 최대 300회
       ↓
[hourly-sync cron job]  ── instrumentation.ts → node-cron 매시 :20 / :50 KST
  1. fetchHourlySnapshot(date.start, date.end)  ← Redash 적재 SQL 실행
  2. transformToUpsertRow                       ← 비율 지표 재계산 (ratio of sums 원칙)
  3. upsertHourlySnapshot                       ← (date_kst, hour_kst) PK conflict → 전체 컬럼 갱신
  4. deleteOlderThan14Days                      ← retention
       │
       ↓
[Supabase  media.hourly_snapshot]
  PK (date_kst, hour_kst)
  idx_hourly_snapshot_date — 14일 범위 SELECT 최적화
       │
       │ Server Component (SSR)
       ↓
[lib/features/dashboard-today/today-board-reader.ts]
  - 최근 N일 + 오늘 row read (Supabase anon key, cookie-free)
  - aggregate.ts 의 순수 함수로 view model 변환
  - cutoff_kst_hour 기준으로 baseline 정렬
       │
       ↓
[Client: <TodayStatusBoard />]
  - 카드 (revenue / mfr / vimp / cpc / vctr / erpm / fill_rate)
  - big chart (시간대별 revenue 바)
  - 2×2 mini charts (vimp / cpc / vctr / erpm)
  - React Query 로 /api/today-status refetch (포커스 시 / 5분 간격)
```

웹 앱 런타임에서 **Redash 를 직접 호출하지 않는다** — 오직 Supabase 만 읽는다. Redash 의존성은 cron job 내부에만 국한.

---

## 3. 데이터 소스 — `media.hourly_snapshot`

### 3.1 테이블 정의

**마이그레이션**: `supabase/migrations/2026041901-table-hourly-snapshot.sql`

```sql
CREATE TABLE media.hourly_snapshot (
  date_kst                 DATE          NOT NULL,
  hour_kst                 SMALLINT      NOT NULL CHECK (hour_kst BETWEEN 0 AND 23),

  -- 매출 (3분해)
  revenue_self_dsp_krw     BIGINT        NOT NULL DEFAULT 0,    -- DSP1+DSP2 (광고주매출)
  revenue_passback_krw     BIGINT        NOT NULL DEFAULT 0,    -- DSP3 (벤더 정산매출, 재구성)
  revenue_krw              BIGINT        NOT NULL DEFAULT 0,    -- 합계

  -- 매체비 (3분해)
  media_fee_self_dsp_krw   BIGINT        NOT NULL DEFAULT 0,    -- self DSP (1.13)
  media_fee_passback_krw   BIGINT        NOT NULL DEFAULT 0,    -- DSP3 (재구성)
  media_fee_krw            BIGINT        NOT NULL DEFAULT 0,    -- 합계
  mfr_pct                  NUMERIC(7,2),

  dable_margin_krw         BIGINT,                                -- = revenue - media_fee

  -- 트래픽
  impressions              BIGINT        NOT NULL DEFAULT 0,
  vimp                     BIGINT        NOT NULL DEFAULT 0,
  clicks                   BIGINT        NOT NULL DEFAULT 0,
  passback_imp             BIGINT        NOT NULL DEFAULT 0,
  vctr_pct                 NUMERIC(7,4),
  cpc                      NUMERIC(12,2),
  erpm                     NUMERIC(12,2),

  -- Fill rate
  ad_request_items         BIGINT,
  ad_response_items        BIGINT,
  fill_rate_pct            NUMERIC(7,2),

  -- 메타
  cutoff_kst_hour          SMALLINT,                              -- partial_today 표시용

  created_at / updated_at  TIMESTAMPTZ,
  PRIMARY KEY (date_kst, hour_kst)
);
```

### 3.2 Retention

- **14일 rolling**. cron job 의 `deleteOlderThan14Days()` 가 매 적재 후 `DELETE FROM media.hourly_snapshot WHERE date_kst < CURRENT_DATE - INTERVAL '14 days'` 실행.
- 14일이면 baseline 10영업일 평균 + 오늘 (총 11일) 보다 충분한 마진.
- 더 긴 보존이 필요해지면 별도 archive 테이블 또는 daily roll-up 으로 분리 (현 시점 YAGNI).

### 3.3 RLS 정책

- anon role 에 SELECT / INSERT / UPDATE / DELETE 허용 (cron 의 cookie-free Supabase 클라이언트가 anon key 로 upsert).
- 외부 노출 X — Pod 내부에서만 anon key 사용. 사내망 + Supabase RLS 로 격리.

---

## 4. 적재 파이프라인 (Pipeline)

### 4.1 파일 구조

```
lib/features/hourly-sync/
├─ redash-fetch.ts      ← Redash POST + Polling. 단일 ad-hoc SQL 실행
├─ aggregate.ts         ← Trino row[] → HourlySnapshotUpsertRow[] 변환 (비율 지표 재계산)
├─ upsert.ts            ← Supabase upsert + retention delete
├─ job.ts               ← runHourlySyncJob — 오케스트레이션
└─ cron.ts              ← node-cron 등록 (매시 :20 / :50 KST)

app/api/hourly-sync/
└─ route.ts             ← POST 수동 trigger (Bearer INTERNAL_API_TOKEN)

instrumentation.ts      ← Pod 부팅 시 cron.ts 등록 (NEXT_RUNTIME=nodejs 가드)
```

### 4.2 Cron 등록

`instrumentation.ts` 에서 daily-redash-import / fc-value-sync / fc-metrics-sync 와 함께 등록:

```typescript
// instrumentation.ts
const [
  { registerDailyImportCron },
  { registerFcValueSyncCron },
  { registerFcMetricsSyncCron },
  { registerHourlySyncCron },         // ← 신규
] = await Promise.all([...]);

registerHourlySyncCron();              // ← 매시 :20 / :50 KST
```

`cron.ts` 표준 패턴 (`~/.claude/rules/deploy-llm-schedule.md §3` 준수):
- `registered` 플래그로 idempotent 보장
- 콜백 안 최상위 try/catch + duration 로깅
- timezone: "Asia/Seoul" 명시
- log prefix `[hourly-sync]` 통일

### 4.3 적재 SQL — Trino ad-hoc

원본: `_hourly-reference/260418-media-hourly_service_snapshot.sql` (service 차원 분리 버전)
운영본: `lib/features/hourly-sync/redash-fetch.ts` 에 inline 한 **수정본** — service 차원 합산 + revenue_passback CTE 추가 + setting CPM JOIN 추가.

#### CTE 구조 (총 7개)

```
params              ← date_start, date_end (KST 입력)
utc_bounds          ← KST → UTC partition 범위 변환
revenue_hourly      ← 1.15 (hourly_ctr_4media_by_service) self DSP 매출/노출/클릭 — service 합산
self_dsp_fee_hourly ← 1.13 (hourly_media_fee_by_widget) self DSP 매체비 합산
passback_hourly     ← 1.12-a (hourly passback imp) × 1.12 vendor_to_dable_cpm × 1.12-b dable_to_media_setting_cpm 두 종류 동시 곱셈
fill_rate_hourly    ← 1.18 (hourly_fill_rate) ad_request_items / ad_response_items 합산
cutoff              ← MAX(utc_basic_time) 의 KST hour
```

#### 핵심 — passback_hourly CTE 의 두 CPM 동시 계산

```sql
-- passback_hourly CTE (핵심)
WITH widget_daily_cpm AS (
  -- 1.12 daily 에서 widget × date weighted average CPM 두 종류 동시 계산
  SELECT
    CAST(p.local_basic_time AS DATE)         AS date_kst,
    p.service_id, p.widget_id, p.vendor_id,
    -- 수신 CPM (벤더 → Dable) — revenue 재구성용
    SUM(p.org_cost_spent_krw) * 1000.0
      / NULLIF(SUM(p.impressions), 0)        AS vendor_to_dable_cpm,
    -- 지급 CPM (Dable → 매체) — media_fee 재구성용
    AVG(st.value)                            AS dable_to_media_cpm    -- ← 핵심 추가
  FROM fact_daily.ad_stats__daily_passback_stats p
  LEFT JOIN dimensional_reco.dable_media_income__passback_setting__latest st
    ON p.widget_id = st.widget_id
   AND p.vendor_id = st.vendor_id
   AND st.deleted = 0
   AND st.start_time <= CAST(p.local_basic_time AS timestamp)
   AND st.end_time   >  CAST(p.local_basic_time AS timestamp)
  WHERE p.local_basic_time BETWEEN ... AND p.vendor_id > 0
  GROUP BY 1, 2, 3, 4
),
passback_hourly AS (
  SELECT
    CAST(date_add('hour', 9, date_parse(pb.utc_basic_time, '%Y-%m-%d-%H')) AS DATE) AS date_kst,
    hour(date_add('hour', 9, date_parse(pb.utc_basic_time, '%Y-%m-%d-%H')))         AS hour_kst,
    SUM(pb.ad_widget_impressions)                                              AS passback_imp,
    -- DSP3 매출 = hourly imp × 수신 CPM
    SUM(pb.ad_widget_impressions * COALESCE(c.vendor_to_dable_cpm, 0) / 1000.0) AS revenue_passback_krw,
    -- DSP3 매체비 = hourly imp × 지급 CPM
    SUM(pb.ad_widget_impressions * COALESCE(c.dable_to_media_cpm, 0) / 1000.0)  AS media_fee_passback_krw
  FROM fact_hourly.ad_passback_summary pb
  LEFT JOIN widget_daily_cpm c
    ON CAST(date_add('hour', 9, date_parse(pb.utc_basic_time, '%Y-%m-%d-%H')) AS DATE) = c.date_kst
   AND pb.service_id = c.service_id
   AND pb.widget_id  = c.widget_id
  WHERE pb.utc_basic_time BETWEEN ...
  GROUP BY 1, 2
)
```

⚠️ **두 CPM 혼동 절대 금지** — 이전 버전 `hourly_service_snapshot.sql` 의 명명 버그가 여기서 발생했음. `vendor_to_dable_cpm` 으로 매체비 계산 시 매출과 같은 값이 들어가 mfr 이 100% 가 됨.

#### 최종 SELECT — service 차원 합산

```sql
SELECT
  CAST(r.date_kst AS varchar) AS date_kst,
  r.hour_kst,

  -- 매출
  CAST(SUM(r.revenue_krw) AS BIGINT)                                         AS revenue_self_dsp_krw,
  CAST(SUM(COALESCE(ph.revenue_passback_krw, 0)) AS BIGINT)                  AS revenue_passback_krw,
  CAST(SUM(r.revenue_krw + COALESCE(ph.revenue_passback_krw, 0)) AS BIGINT)  AS revenue_krw,

  -- 매체비
  CAST(SUM(COALESCE(sd.media_fee_self_dsp_krw, 0)) AS BIGINT)                AS media_fee_self_dsp_krw,
  CAST(SUM(COALESCE(ph.media_fee_passback_krw, 0)) AS BIGINT)                AS media_fee_passback_krw,
  CAST(SUM(COALESCE(sd.media_fee_self_dsp_krw, 0) + COALESCE(ph.media_fee_passback_krw, 0)) AS BIGINT)
                                                                              AS media_fee_krw,

  -- 트래픽
  CAST(SUM(r.impressions) AS BIGINT) AS impressions,
  CAST(SUM(r.exposes)     AS BIGINT) AS vimp,
  CAST(SUM(r.clicks)      AS BIGINT) AS clicks,
  CAST(SUM(COALESCE(ph.passback_imp, 0)) AS BIGINT) AS passback_imp,

  -- Fill rate (분자/분모 raw 만 — 비율은 후처리)
  CAST(SUM(fr.ad_request_items)  AS BIGINT) AS ad_request_items,
  CAST(SUM(fr.ad_response_items) AS BIGINT) AS ad_response_items,

  co.cutoff_kst_hour
FROM revenue_hourly r
LEFT JOIN self_dsp_fee_hourly sd
  ON r.date_kst = sd.date_kst AND r.hour_kst = sd.hour_kst AND r.service_id = sd.service_id
LEFT JOIN passback_hourly ph
  ON r.date_kst = ph.date_kst AND r.hour_kst = ph.hour_kst
LEFT JOIN fill_rate_hourly fr
  ON r.date_kst = fr.date_kst AND r.hour_kst = fr.hour_kst AND r.service_id = fr.service_id
JOIN dimensional_reco.dable__service__latest s ON r.service_id = s.service_id
CROSS JOIN cutoff co
WHERE s.country = 'KR'                  -- KR_native 만. ADX4 (US 등록) 자동 제외
GROUP BY 1, 2, co.cutoff_kst_hour
ORDER BY 1 DESC, 2 DESC
```

### 4.4 KST 변환 공식

Trino partition 컬럼이 UTC 인 테이블 (1.11/1.12-a/1.13/1.18) 와 KST 인 테이블 (1.10/1.12) 이 섞여있음. 표준 변환:

```
KST D-day 의 시간대 데이터 = UTC (D-1)-15 ~ UTC D-14 partition

UTC partition 'YYYY-MM-DD-HH' → KST 변환:
  date_add('hour', 9, date_parse(utc_basic_time, '%Y-%m-%d-%H'))
  → CAST(... AS DATE)            = date_kst
  → hour(...)                    = hour_kst (0~23)
```

### 4.5 Aggregate 단계 (TypeScript)

`aggregate.ts` 에서 Trino row → upsert row 변환 시 **비율 지표는 raw 합산 후 재계산** (ratio of sums, NOT sum of ratios):

```typescript
function transformRow(row: TrinoHourlyRow): HourlySnapshotUpsertRow {
  const revenue        = Number(row.revenue_self_dsp_krw) + Number(row.revenue_passback_krw);
  const mediaFee       = Number(row.media_fee_self_dsp_krw) + Number(row.media_fee_passback_krw);
  const vimp           = Number(row.vimp);
  const clicks         = Number(row.clicks);
  const adReq          = Number(row.ad_request_items ?? 0);
  const adResp         = Number(row.ad_response_items ?? 0);

  return {
    date_kst:               row.date_kst,
    hour_kst:               Number(row.hour_kst),

    revenue_self_dsp_krw:   Number(row.revenue_self_dsp_krw),
    revenue_passback_krw:   Number(row.revenue_passback_krw),
    revenue_krw:            revenue,

    media_fee_self_dsp_krw: Number(row.media_fee_self_dsp_krw),
    media_fee_passback_krw: Number(row.media_fee_passback_krw),
    media_fee_krw:          mediaFee,
    mfr_pct:                revenue > 0 ? (mediaFee * 100) / revenue : null,

    dable_margin_krw:       revenue - mediaFee,

    impressions:            Number(row.impressions),
    vimp,
    clicks,
    passback_imp:           Number(row.passback_imp ?? 0),
    vctr_pct:               vimp > 0 ? (clicks * 100) / vimp : null,
    cpc:                    clicks > 0 ? revenue / clicks : null,
    erpm:                   vimp > 0 ? (revenue * 1000) / vimp : null,

    ad_request_items:       adReq,
    ad_response_items:      adResp,
    fill_rate_pct:          adReq > 0 ? (adResp * 100) / adReq : null,

    cutoff_kst_hour:        Number(row.cutoff_kst_hour),
  };
}
```

⚠️ **future hour skip** — `revenue_self_dsp_krw === 0 && vimp === 0 && impressions === 0` 인 row 는 미래 시간대로 간주, upsert 에서 제외 (cron 이 매시 돌면서 unfilled 시간 빈 row 가 누적되는 것 방지).

### 4.6 Upsert

```typescript
await supabase
  .from("hourly_snapshot")
  .upsert(rows, {
    onConflict: "date_kst,hour_kst",
    ignoreDuplicates: false,                 // 항상 갱신
  });
```

### 4.7 Retention

```typescript
const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
  .toISOString().slice(0, 10);

await supabase
  .from("hourly_snapshot")
  .delete()
  .lt("date_kst", cutoff);
```

매 cron tick 마다 실행 (idempotent — 14일 이전이 없으면 0 row 삭제).

### 4.8 Gap Recovery

cron 이 며칠 누락 (Pod 재시작 직후) 되어도 다음 정시에 자동 보충:
- `date.start` = `latestDateInDb` 또는 `today - 1day` 중 작은 값
- `date.end`   = `today` (KST)
- 단 **상한 14일** 로 자르기 (전체 retention 초과 방지)

---

## 5. 베이스라인 비교 로직

### 5.1 옵션 A 채택 — hourly 끼리 비교

**원칙**: 오늘 누적 비교는 **항상 같은 `media.hourly_snapshot` 테이블 내에서** 한다. daily 원본 (1.10) 과 절대값 비교는 안 함.

이유:
- hourly 와 daily 는 -3% 수준 차이 (dsp3 누락) 가 있었으나, **passback 재구성 후 -0.5% 이내** 로 수렴.
- 그래도 동일 ETL 의 hourly 끼리 비교가 noise 가 가장 적음.
- 광고주 사이드 `ads.hourly_ad_stats` 도 동일 패턴.

### 5.2 cutoff-aligned 누적 비교

```typescript
// today-board-reader.ts 의사코드
const today = await fetchHourlyRowsByDate(latestDateKst);  // 0~cutoff hour
const cutoff = today.at(-1)?.cutoff_kst_hour ?? today.at(-1)?.hour_kst;

const baseline = await fetchHourlyRowsByDateRange(
  latestDateKst - 14日, latestDateKst - 1日,
);

// 평일만 (mon-fri) 최근 N=10
const weekdays = pickRecentWeekdays(baseline, 10);

// 동일 cutoff 까지 누적
const todayCum    = sumUntilHour(today, cutoff);                    // [revenue, vimp, clicks, ...]
const baselineCum = mean(weekdays.map(d => sumUntilHour(d, cutoff))); // 일자 mean

const delta = {
  revenue_pct: (todayCum.revenue - baselineCum.revenue) * 100 / baselineCum.revenue,
  vimp_pct:    (todayCum.vimp - baselineCum.vimp)       * 100 / baselineCum.vimp,
  cpc_pct:     ...,
  // ...
};
```

### 5.3 파생 지표 비교

```
mfr_baseline = sum(media_fee_baseline) / sum(revenue_baseline)
mfr_today    = todayCum.media_fee / todayCum.revenue
mfr_delta_pp = (mfr_today - mfr_baseline) × 100      ← percentage point
```

비율 지표는 **항상 cumulative raw 합산 후 재계산**. 평균의 평균 금지.

### 5.4 partial_today 표시

UI 상단 항상 다음 고지:

> ℹ️ **KST {cutoff_kst_hour}시 cutoff 누적 기준** · baseline = 직전 평일 {N}일 평균

`cutoff_kst_hour` 는 `media.hourly_snapshot.cutoff_kst_hour` 컬럼에서 가져옴 (`MAX(utc_basic_time)` 의 KST hour).

### 5.5 baseline 일자 선택

- **최근 14일 중 평일 (mon-fri) 만 선택, 최대 10개**
- 주말 / 공휴일은 baseline 에서 제외 (트래픽 패턴이 다름)
- 공휴일 list 는 필요 시 `media.ref_holiday` 같은 dim 으로 별도 관리 (현 시점 mon-fri 만으로 충분)

---

## 6. UI 컴포넌트 트리

### 6.1 진입점 — Server Component

`app/dashboard/_components/DashboardClient.tsx` 의 마지막에 추가:

```tsx
<DashboardClient ...>
  <SummaryCards ... />
  <DashboardControls ... />
  <BoardChart "Ad Revenue" ... />
  <BoardChart "vIMP" ... />
  <BoardChart "MFR" ... />

  {/* 신규 — 하단 섹션 */}
  <Suspense fallback={<TodaySectionSkeleton />}>
    <TodayStatusSection latestDate={latestDate} />
  </Suspense>
</DashboardClient>
```

`TodayStatusSection` (Server Component):

```tsx
// app/dashboard/_components/TodayStatusSection.tsx
import { fetchTodayStatus } from "@/lib/features/dashboard-today/today-board-reader";

export async function TodayStatusSection({ latestDate }: { latestDate: string }) {
  let initialData = null;
  let errorMessage = null;
  try {
    initialData = await fetchTodayStatus(latestDate);
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : String(err);
  }
  return (
    <TodayStatusBoard initialData={initialData} errorMessage={errorMessage} />
  );
}
```

→ **fail-open**: 에러 메시지를 client 로 전달, dashboard 의 다른 섹션은 정상 렌더 유지.

### 6.2 Client 보드

```
TodayStatusBoard.tsx                    ← 루트, React Query refetch
├─ TodayStatusCards.tsx                 ← 카드 row
│   ├─ TodayStatusCard "Revenue" (값 + delta_pct)
│   ├─ TodayStatusCard "MFR" (값 + delta_pp)
│   ├─ TodayStatusCard "vIMP"
│   ├─ TodayStatusCard "CPC"
│   ├─ TodayStatusCard "vCTR"
│   └─ TodayStatusCard "Fill Rate"
├─ TodayStatusChartArea.tsx             ← 차트 영역 wrapper
│   ├─ TodayBigChart.tsx                ← 시간대별 revenue bar (오늘 vs baseline overlay)
│   └─ 2×2 mini chart grid
│       ├─ TodayMiniChart "vIMP"
│       ├─ TodayMiniChart "CPC"
│       ├─ TodayMiniChart "vCTR"
│       └─ TodayMiniChart "eRPM"
```

### 6.3 카드 표시 규칙

| 카드 | 값 | delta 표시 |
|---|---|---|
| Revenue | `todayCum.revenue` (만원/억 한국식) | `+5.3%` (vs baseline) |
| MFR | `mfr_today` % | `+1.2%p` (percentage point) |
| vIMP | `todayCum.vimp` (천/만/억) | `+2.1%` |
| CPC | `todayCum.cpc` 원 | `-3.5%` |
| vCTR | `vctr_today` % | `+0.05%p` |
| Fill Rate | `fill_rate_today` % | `+1.8%p` |

색상:
- 매출/노출/CTR/Fill Rate 는 **상승 = 녹색** (좋음)
- MFR/CPC 는 **하락 = 녹색** (역지표)

### 6.4 Big Chart — 시간대별 revenue

- **x축**: 0~23시 (KST)
- **y축**: revenue_krw (만원 단위)
- **bar**: 오늘 (지금까지 채워진 시간대만)
- **line overlay**: baseline N영업일 평균 (24시간 모두)
- 오늘 마지막 시간대까지만 데이터 있음 → cutoff 이후 시간대는 비어있음

### 6.5 Mini Charts 2×2

각 미니 차트:
- **x축**: 0~23시
- **y축**: 해당 지표
- **line**: 오늘 (cutoff 까지) + baseline 평균 (24h 전체)

지표:
- **vIMP**: 시간대별 노출 패턴 (peak time 비교)
- **CPC**: 광고주 입찰 패턴
- **vCTR**: 트래픽 품질
- **eRPM**: 단위 노출당 매출 효율

### 6.6 React Query refetch

```typescript
// lib/queries/today-queries.ts
export const queryKeys = {
  ...,
  dashboard: {
    ...,
    today: (latestDate: string) => ["today-status", latestDate] as const,
  },
};

useQuery({
  queryKey: queryKeys.dashboard.today(latestDate),
  queryFn: () => fetch(`/api/today-status?date=${latestDate}`).then(r => r.json()),
  initialData: serverInitialData,
  refetchInterval: 5 * 60 * 1000,         // 5분
  refetchOnWindowFocus: true,
  staleTime: 60 * 1000,
});
```

`/api/today-status` route 는 SSR reader 와 같은 함수를 호출 — 코드 단일화.

---

## 7. 환경 / 의존성

### 7.1 환경변수

| 변수 | 출처 | 용도 |
|---|---|---|
| `REDASH_API_KEY` | Custom Credential (`deploy-llm.md §3`) | Redash POST/polling 인증 (server-only) |
| `INTERNAL_API_TOKEN` | Custom Credential | `/api/hourly-sync` 수동 trigger Bearer |
| `NEXT_PUBLIC_SUPABASE_URL` | env_vars | cookie-free Supabase client |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | env_vars | 동일 |

### 7.2 라이브러리 (이미 설치됨)

- `node-cron` — 타이머
- `@supabase/supabase-js` — vanilla 클라이언트 (`@supabase/ssr` 의 `cookies()` 회피)
- `@tanstack/react-query` — refetch
- `recharts` — 차트
- `lucide-react`, `clsx`, `tailwind-merge` — UI

### 7.3 인프라 제약

- `replicas: 1`, `hpa_enabled: false` — 다중 인스턴스 시 cron 중복 발생 (`deploy-llm-schedule.md §1.1`).
- Pod 메모리 — 14일 × 24시간 = 336 row 의 메모리 부담 무시 가능.

---

## 8. 검증 기준 (Accuracy)

이 보드의 데이터 정확도를 신뢰할 수 있는지 검증하는 표준 체크:

| 검증 항목 | 기준 | 검증 방법 |
|---|---|---|
| **hourly 24h 합산 vs daily revenue** | -0.5% 이내 | passback 재구성 후 daily `1.10.org_cost_spent` 와 비교. → `_docs/01-infra-08-data-3rd_party.md §3.1` |
| **hourly 24h 합산 vs daily media_fee** | -0.5% 이내 (KR_native, ADX 제외) | `1.1.actual_sharing_cost - adx 행` 와 비교 |
| **1.13 self DSP vs (actual - adx - dsp3)** | -0.15% 이내 | 1.13 의 정의 검증 |
| **revenue 분해 합산** | dsp1+dsp2+dsp3 = total | 1.10 분해 컬럼으로 sum_check |
| **passback 재구성 정확도** | imp Δ -0.3%, revenue Δ -0.5% | KR 7일 실측 (schema-core 1.12-a 주석) |
| **MFR 정상 밴드** | 30~75% | 실측 KR ~ 50~60%. 100% 초과 시 역마진 알림 |
| **cutoff_kst_hour 일관성** | row 마다 같은 값 | UTC ETL 지연으로 max hour 가 한두시간 늦을 수 있음 |

---

## 9. 안티패턴 / 트러블슈팅

### 9.1 명명 / 데이터 함정

- ❌ `1.12.cpm_value` 로 매체비 계산 (이건 수신 CPM). 매체비는 `1.12-b setting.value` (지급 CPM) 사용.
- ❌ `media_fee_dsp1 + dsp2 + dsp3` 합산 (CPM 더블카운트, 1.55× 부풀림).
- ❌ hourly `1.15 org_cost_spent` 를 단독 사용 (passback 매출 누락 -3%). passback 재구성 필수.
- ❌ ADX4 서비스 (15580/15691/15692/16250) 를 hourly 매체비 집계에 포함 (1.13 미적재).
- ❌ `widget_id='adx'` 행 필터링 (KR ADX 매체비 0% 함정).
- ❌ Xandr/Kakao 를 dsp3 로 분류 (사실은 dsp1 의 ML 모델).

### 9.2 Cron / 인프라

- ❌ HPA 켜진 환경에서 in-process cron — 인스턴스마다 중복 실행. 분산 lock 또는 single replica.
- ❌ cron 안에서 `next/headers` cookies 사용 — request scope 밖, throw.
- ❌ cron 콜백 try/catch 누락 — Pod crash.
- ❌ cron 이 자기 자신의 HTTP route 를 fetch (`/api/hourly-sync`) — 세션 인증 함정. 함수 직접 호출.

### 9.3 비교 로직

- ❌ baseline 에 주말 포함 — 트래픽 패턴 왜곡. mon-fri 만.
- ❌ 비율 지표를 sum of ratios 로 계산 (`avg(mfr_pct)`) — ratio of sums (`sum(fee)/sum(rev)`) 사용.
- ❌ 오늘 partial 데이터 vs baseline full day 비교 — cutoff 정렬 필수.

### 9.4 디버깅 체크

증상별 확인:

| 증상 | 확인 |
|---|---|
| 카드 값 0 또는 NULL | Supabase `media.hourly_snapshot` 에 row 있는지 → `[hourly-sync] ok` 로그 → Redash API 응답 |
| MFR 100% 또는 NaN | passback CPM JOIN 정합성 → setting.value 가 NULL 인지 → vendor_id=-1 sentinel 필터 |
| hourly 합산 ≠ daily | passback_hourly CTE 의 두 CPM 분리 확인 → schema-core 의 -0.5% 기준 충족 여부 |
| baseline 비어있음 | `media.hourly_snapshot` retention (14일) 확인 → 평일 최소 1일 이상 있는지 |

---

## 10. 관련 파일 / 외부 참조

### 10.1 이 프로젝트 내부

- **마이그레이션**: `supabase/migrations/2026041901-table-hourly-snapshot.sql`
- **레퍼런스 스냅샷**: `_hourly-reference/` (광고주 사이드 동일 패턴 — README + 컴포넌트 + cron 코드)
- **3rd-party 정산 구조**: `_docs/01-infra-08-data-3rd_party.md`
- **External 정산 (벤더 API 직접)**: `lib/features/.../external/*` + `media.external_*` 테이블
- **Daily Redash Import (참고 cron 패턴)**: `lib/features/daily-redash-import/`

### 10.2 글로벌 룰

- `~/.claude/rules/deploy-llm-schedule.md` — Next.js + node-cron 패턴 표준
- `~/.claude/rules/deploy-llm.md` — LiteLLM Code Deploy 인프라 일반 룰
- `~/.claude/rules/dable-obi-mcp.md` — OBI MCP 향후 전환 시 참고 (현재는 Redash 사용)
- `~/.claude/skills/dable-query/references/schema-core.md` — Trino 1.10/1.11/1.12/1.13/1.18 정의

### 10.3 SQL 검증 출력

- `output/260418-media-hourly_daily_revenue_정합성_검증.sql` — hourly vs daily revenue gap
- `output/260418-media-revenue_dsp_분해_검증.sql` — dsp1+2+3 = total 검증
- `output/260418-media-media_fee_dsp_분해_검증.sql` — dsp 합산 더블카운트 실증
- `output/260418-media-passback_vendor_분포.sql` — KR 활성 벤더 점유율

---

## 11. 변경 이력

- **2026-04-19**: 초안 작성. 광고주 사이드 `_hourly-reference/` 스냅샷 + 새로 검증된 매체 도메인 4-스트림 분해 (DSP1/2/3/ADX) + passback 재구성 (vendor → Dable 수신 CPM, Dable → 매체 지급 CPM 분리) 적용.
