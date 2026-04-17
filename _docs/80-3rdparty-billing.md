# 3rd-party Billing (External Total / FC 리포트)

`/external/fc` 페이지와 뒷받침하는 cron·캐시·외부 API 파이프라인의 **종합 레퍼런스**.

lineDSP / syncmedia / klmedia / friendplus 같은 passback 벤더를 통한 광고 노출·정산을 widget × date 단위로 집계한다. 참고 원본은 `_docs/260417-sample.xlsx` 시트 `FC관리` ("lineDSP 타겟CPM 관리 시트") 이고, 엑셀 33컬럼 구조를 그대로 재현한 웹 대시보드이다.

---

## 1. 시스템 구성

```
┌─────────────────┐       ┌───────────────────────┐       ┌───────────────────┐
│   DW (Trino)    │──────▶│  Cron (Next.js)       │──────▶│  Supabase (media) │
│ fact_daily.*    │ 07:30 │  fc-metrics-sync      │ upsert│  external_total_  │
│ dable.*         │       │                       │       │  daily            │
└─────────────────┘       │  fc-value-sync        │──────▶│  external_value   │
                          │  07:00                │       │  (CPM/FC 이력)    │
┌─────────────────┐       │                       │       └───────────────────┘
│ KL Media API    │──────▶│  daily-redash-import  │──────▶│  external_daily   │
│ SyncMedia API   │ 06:00 │                       │       │  (vendor imp/매출)│
└─────────────────┘       └───────────────────────┘       └───────────────────┘
                                                                  │
                                                                  │ fc-metrics-sync
                                                                  │ 내부 조인
                                                                  ▼
                                        ┌───────────────────┐
                                        │ /external/fc 페이지│
                                        │ Supabase 단일 조회 │
                                        │ + deriveFcRow 계산 │
                                        └───────────────────┘
```

**핵심 결정**: 페이지는 Redash·DW 를 직접 호출하지 않는다 (~2.5s → ~100ms). 모든 데이터는 매일 cron 이 Supabase `external_total_daily` 캐시에 누적한다.

---

## 2. 페이지 구조

`/external/fc` (리포트): widget picker + 월 네비 + 33열 테이블
`/external/fc/admin` (관리): widget 별 `external_value` (CPM/FC) 이력 CRUD + "지금 동기화" 버튼

테이블 섹션 (30 렌더 컬럼, `widget_id`/`dable_mfr_ref(AB)`/`dable_passback_imp(I, 항상 0)` 3개 필드는 UI 중복이라 제외):

| 섹션 | 컬럼 | 배경 |
|---|---|---|
| 기본 | 날짜, FC | `bg-slate-50/60` |
| 요청·응답 | 요청, 응답, 응답률, 패스백, 패스백률, **패스백 노출** | 흰색 + 얼룩말 |
| RPM·MFR | RPM, RPM(OBI), 전체MFR, 데이블MFR | `bg-amber-50/60` |
| 데이블 블록 | FN매출, 매체비, APC, 서버비, 매체매출, 광고매출, CPM, 공헌이익, 유실분 | `bg-blue-50/60` |
| 패스백 블록 | 싱크MFR, PB FN, PB 매체비, PB 서버비, PB 매체매출, PB 광고매출, 싱크 공헌 | `bg-orange-50/60` |
| 공헌이익 | 전체 공헌, 전체 RPM | `bg-emerald-50/60` |

모든 폰트는 `text-gray-900`. 금액은 ₩ 없이 숫자만, 비율은 `%`.

---

## 3. 컬럼 ↔ 데이터 원본 매핑

33 컬럼을 **출처별** 로 정리. 엑셀의 "수동 입력" 4 컬럼 (B/N/O/P) 은 설계 변경으로 **모두 자동 파생** 되었다.

### 3.1 DW 원본 (캐시에 저장 후 사용)

`lib/features/fc-value-sync/redash-fetch.ts:fetchDwFcMetrics()` 가 Redash Trino 로 3개 fact 테이블을 단일 adhoc 쿼리(CTE 3개)로 조회해서 캐시에 적재.

| 엑셀 | 내부 필드 | DW 소스 | 비고 |
|---|---|---|---|
| D | `requests` | `fact_daily.ad_stats__daily_ctr_4media_by_service_widget.impressions` | widget 총 imp (dable + passback) |
| — | (분해) | `.impressions_dsp1_2` | dable 응답분 (E 와 거의 동일, 단 시차 존재) |
| — | (분해) | `.impressions_dsp3` | passback 경로 |
| M | `rpm_dashboard` | `org_cost_spent × 1000 / impressions` | widget RPM |
| a | `dable_media_cost` | `ad_stats__daily_actual_sharing_cost_by_service_widget.media_fee_dsp1` | **dsp1==dsp2 중복저장**, dsp1 단독 사용 |
| b | `dable_revenue` | `.org_cost_spent_dsp1 + .org_cost_spent_dsp2` (1.10) | passback 제외 매출 |
| c | `pb_media_cost` | `.media_fee_dsp3` (1.1) | passback 쪽 publisher 지급 |
| G | `passback_imp` | `fact_daily.ad_stats__daily_passback_stats.impressions` (vendor_id IN {2,4,5} 합산) | Dable 측 passback 기록 |
| d | `pb_revenue` | `.org_cost_spent_krw` (passback, KRW) | 벤더가 Dable 에 지급 |
| — | `vendor_source` | `.vendor_id` (imp 최대 벤더 → slug, tie=slug 알파벳) | syncmedia / klmedia / friendplus |

### 3.2 외부 API (별도 파이프라인)

vendor 가 자체 API 로 제공하는 imp·매출 을 기존 daily import 가 `media.external_daily` 에 저장한다. `fc-metrics-sync` 가 upsert 시 widget 단위로 합산해 캐시에 같이 넣는다.

| 엑셀 | 내부 필드 | 소스 |
|---|---|---|
| J | `vendor_imp` (UI "패스백 노출") | `media.external_daily.imp` — `external_mapping` 으로 widget 매칭 후 date 합산 |

**Vendor API 엔드포인트** (기존 `lib/api/externalService.ts`):

| vendor | slug | URL 패턴 | 집계 단위 |
|---|---|---|---|
| KL Media | `klmedia` | `https://admin.klmedia.co.kr/request/report?key={KLMEDIA_API_KEY}&startDate={YYYYMMDD}&endDate={YYYYMMDD}` | `page_name` 단위 (widget-level 상세) |
| SyncMedia (3dpop) | `syncmedia` | `https://syncads.3dpop.kr/Web/Report_Partner/_API/report_json.php?company_uid={UID}&chk_year={YYYY}&chk_month={MM}` | `media_name` 단위 (URL-encoded, 월 단위 fetch) |
| FriendPlus | `friendplus` | **미구현** (향후 추가 필요) | — |

각 API 수집 cron: **06:00 KST** `daily-redash-import` (+ 수동 sync 모달).

### 3.3 Supabase 수동 입력 (관리 페이지)

`media.external_value` JSONB `value` 컬럼. `widget_id` × `start_date` period 로 이력 보존.

| JSON key | UI | 역할 |
|---|---|---|
| `internal` | 데이블 매체사 CPM (S) | Dable → publisher 계약 CPM |
| `syncmedia` / `klmedia` / `friendplus` | 벤더별 CPM (T) | Dable ↔ 외부 벤더 CPM (참고, 계산은 DW `cpm_value` 우선) |
| `fc` | FC 금액 | widget 의 floor CPM (Dable 운영자 관리) |

관리 페이지에서 수동 등록 + `fc-value-sync` cron 이 매일 07:00 KST DW snapshot 과 diff 해 변경 시 신규 row insert.

### 3.4 계산식 (23 컬럼)

엑셀 공식을 [`lib/logic/external-fc-logic.ts:deriveFcRow()`](../lib/logic/external-fc-logic.ts) 가 1:1 재현. 모든 파생 필드는 **클라이언트 렌더 시점** 에서 계산 (캐시에는 raw 만 저장, 공식 변경이 쉽게 롤아웃 가능).

---

## 4. 계산 공식 (33 컬럼 1:1)

### 4.1 상수 (`lib/logic/external-fc-defaults.ts`)

```ts
rpm_obi_ratio      = 0.34    // L = M / 0.34
server_cost_rate   = 0.047   // X = Y × 0.047
apc_rate           = 0.017   // W = Z × 0.017
fn_media_weight    = 0.75    // U = Y*0.75 + Z*0.25
fn_ad_weight       = 0.25
ad_revenue_rate    = 0.95    // Z = Y × 0.95
pb_server_discount = 0.1     // AE = AF × 0.047 × 0.1
```

### 4.2 비율

```
F = E / D                    (응답률)
H = G / D                    (패스백률)
E = max(D − G, 0)           (응답수, 음수 방어)
K = G − J − I                (유실분, I=0 고정)
L = M / 0.34                 (RPM OBI)
```

### 4.3 MFR 3종 (DW 기반 자동 — 설계 변경 후)

```
O (데이블 MFR)  = a / b
P (싱크 MFR)    = c / d
N (전체 MFR)    = (a + c) / (b + d)
```

### 4.4 데이블 블록

```
AB = O
AA = S / AB                  (데이블 CPM)
Y  = (E / 1000) × AA         (데이블 매체 매출)
Z  = Y × 0.95                (데이블 광고 매출)
V  = (E / 1000) × S          (데이블 매체비)
W  = Z × 0.017               (APC)
X  = Y × 0.047               (서버비)
U  = Y × 0.75 + Z × 0.25     (FN 매출)
R  = U − (V + W + X)         (데이블 공헌이익)
```

### 4.5 패스백 블록

```
AF = (G / 1000) × T          (PB 매체 매출)
AG = AF
AE = AF × 0.047 × 0.1        (PB 서버비)
AD = (G / 1000) × S          (PB 매체비)
AC = AF × 0.75 + AG × 0.25   (PB FN 매출)
Smargin = AC − (AD + AE)     (싱크 공헌이익)
```

### 4.6 종합

```
Q       = R + Smargin                (전체 공헌이익)
Tmargin = (Q / D) × 1000             (전체 RPM, KRW per 1000 imp)
```

---

## 5. Supabase 스키마

### 5.1 `media.external_total_daily` (리포트 캐시)

```sql
CREATE TABLE media.external_total_daily (
  widget_id         text      NOT NULL,
  date              date      NOT NULL,
  requests          integer,
  passback_imp      integer,
  vendor_imp        integer,
  dable_media_cost  numeric,
  dable_revenue     numeric,
  pb_media_cost     numeric,
  pb_revenue        numeric,
  rpm_dashboard     numeric,
  vendor_source     text,
  fetched_at        timestamp with time zone DEFAULT now(),
  PRIMARY KEY (widget_id, date)
);
CREATE INDEX external_total_daily_date_idx ON media.external_total_daily (date DESC);
```

- **RLS 미적용** (신규, 필요 시 추후 정책 추가)
- `fetched_at` 은 INSERT 시에만 채워지고 UPSERT UPDATE 경로에선 그대로 유지됨 (PostgreSQL DEFAULT 동작)
- **계산된 E/F/H/L/MFR/margin/Q 등은 저장하지 않음** — 클라이언트 `deriveFcRow` 가 수행

### 5.2 `media.external_value` (CPM·FC 이력)

```ts
interface UnitPriceValue {
  internal?: number;       // 데이블 ↔ 매체사 CPM (S)
  syncmedia?: number;      // vendor_id=2 CPM (T)
  klmedia?: number;        // vendor_id=4 CPM
  friendplus?: number;     // vendor_id=5 CPM (신규)
  fc?: number;             // FC / Floor CPM
}
```

`(widget_id, start_date)` PK, `end_date` NULL 이면 현재 활성. 기존 DB 트리거가 신규 row insert 시 이전 active row 의 `end_date` 를 자동 close.

### 5.3 `media.external_mapping` (외부 키 → widget 매핑)

```
source        text     -- 'syncmedia' | 'klmedia' | 'friendplus'
external_key  text     -- 벤더 API 의 서비스/위젯 식별자
widget_id     text     -- Dable widget_id (FK concept)
label         text     -- 표시명
```

**매칭 규칙**:
- `syncmedia` → `external_daily.external_service_name = external_key`
- `klmedia` → `external_daily.external_widget_name = external_key`

### 5.4 `media.external_daily` (vendor API 원본)

`source, date, external_service_name, external_widget_name, imp, click, revenue` — KL Media / SyncMedia API 가 반환한 raw. PK `(source, date, external_service_name, external_widget_name)`.

---

## 6. 매일 프로세스 (Cron)

모든 cron 은 Next.js `instrumentation.ts` 에서 `node-cron` 으로 등록. Pod 단일 리플리카 (`hpa_enabled: false`) 가정.

### 6.1 `daily-redash-import` — 06:00 KST

기존 파이프라인. Redash 쿼리로 내부 DW 결과를 `media.daily` 등에 적재. FC 리포트와 직접 연관은 없지만 `external_daily` (vendor API) 적재도 같은 흐름.

### 6.2 `fc-value-sync` — 07:00 KST

**목적**: widget 별 CPM/FC 변경 이력을 `external_value` 에 누적.

```
for widget in external_mapping (widget_id IS NOT NULL):
  snap = fetchDwSnapshot(widget, today)
    ├─ 1.1 share_value (share_type='cpm')                      → internal
    ├─ DAILY_PASSBACK_STATS.cpm_value (vendor_id=2)            → syncmedia
    ├─ .cpm_value (vendor_id=4)                                → klmedia
    ├─ .cpm_value (vendor_id=5)                                → friendplus
    └─ (fc 는 DW 에 없어 snapshot 에선 null)

  latest = external_value 의 end_date IS NULL row
  if unitPriceChanged(latest.value, snap):
    insert external_value { widget_id, value: merged, start_date: today }
```

`lib/features/fc-value-sync/diff.ts` 의 `unitPriceChanged` 는 snapshot 에 `undefined` 인 필드는 비교 제외 (기존 값 유지).

### 6.3 `fc-metrics-sync` — 07:30 KST (신규)

**목적**: `external_total_daily` 캐시에 widget × date 단위 메트릭 upsert.

```
for widget in external_mapping (widget_id IS NOT NULL):
  latestDate = SELECT MAX(date) FROM external_total_daily WHERE widget_id=?
  range = computeFcSyncRange(latestDate, now, override)
    ├─ 기본: (latestDate+1) ~ (KST D-1)
    ├─ 상한: 14일 (MAX_BACKFILL_DAYS)
    └─ latestDate ≥ D-1 → skip

  metrics = fetchDwFcMetrics(widget, range)   // Redash Trino, CTE 3개 단일 쿼리
  vendorImpByDate = fetchVendorImpByDate(widget, range)
    ├─ external_mapping 로부터 (source, external_key)
    └─ external_daily 에서 source × external_key 매칭 → date 별 imp 합산

  rows = metrics.map(m => {
    ...m,
    vendor_imp: vendorImpByDate.get(m.date) ?? 0,
  })
  upsert external_total_daily (widget_id, date) ← rows
```

### 6.4 수동 트리거 API

`POST /api/fc/sync` (관리 페이지 "지금 동기화" 버튼 또는 curl).

**query params**:
- `sync=true` — 블로킹 실행, 200 응답에 결과 JSON (nginx 60s 타임아웃 주의)
- 기본 (async) — 202 triggered, 백그라운드 실행
- `start=YYYY-MM-DD&end=YYYY-MM-DD` — cron 의 gap recovery 대신 **임의 기간 override**
- `widget=WIDGET_ID` — 특정 widget 만

예: 과거 2달 전체 백필:
```bash
curl -X POST "https://media-board.dllm.dable.io/api/fc/sync?start=2026-02-01&end=2026-04-16"
```

---

## 7. 백필 방법

### 7.1 신규 widget 추가

1. `media.external_mapping` 에 `(source, external_key, widget_id, label)` 등록
2. `POST /api/fc/sync?widget={widget_id}&start=YYYY-MM-DD&end=YYYY-MM-DD` (원하는 기간)
3. 또는 다음 07:30 cron 까지 기다림 (기본 14일 gap recovery)

### 7.2 특정 기간 재백필 (예: 공식 변경 후)

```bash
# 전체 widget, 3/1 ~ 어제
curl -X POST "https://media-board.dllm.dable.io/api/fc/sync?start=2026-03-01&end=2026-04-16"
```
`upsert(onConflict=widget_id,date)` 라 기존 값은 덮어써진다.

### 7.3 관찰 대상 (Supabase MCP)

```sql
-- 백필 진행도
SELECT widget_id, COUNT(*) AS rows, SUM(vendor_imp) AS v, MAX(fetched_at) AS latest
FROM media.external_total_daily
GROUP BY widget_id ORDER BY latest DESC;

-- 특정 widget 검증 (엑셀 대조용)
SELECT date, requests, passback_imp, vendor_imp, pb_revenue
FROM media.external_total_daily
WHERE widget_id = 'V7a1pGx7' AND date BETWEEN '2026-04-08' AND '2026-04-15'
ORDER BY date DESC;
```

---

## 8. 검증 샘플

### 8.1 widget `V7a1pGx7` (m.mt.co.kr "본문2번째_300x300", 머니투데이 · syncmedia)

| 날짜 | 엑셀 D | 캐시 requests | 엑셀 G | 캐시 passback_imp | 엑셀 PB매출 | 캐시 pb_revenue |
|---|---:|---:|---:|---:|---:|---:|
| 4-15 | 100,729 | 100,729 ✓ | 37,806 | 37,806 ✓ | 45,367.2 | 45,367 ✓ |
| 4-14 | 102,015 | 102,016 ✓ | 23,728 | 23,728 ✓ | 28,473.6 | 28,473 ✓ |
| 4-13 | 99,304 | 99,307 ✓ | 20,535 | 20,535 ✓ | 24,642 | 24,642 ✓ |
| 4-12 | 106,970 | 106,972 ✓ | 25,582 | 25,582 ✓ | 30,698.4 | 30,698 ✓ |

**MFR** (DW 기반 자동 계산, ±0.01 허용):
- O (데이블) = `a/b` = `81,799 / 256,280` ≈ 0.32 (엑셀 0.31)
- P (싱크) = `c/d` = `49,147 / 45,367` = 1.08 (엑셀 1.08 정확)
- N (전체) = `(a+c)/(b+d)` ≈ 0.43 (엑셀 0.43)

### 8.2 widget `wXQ2k2yo` (일간스포츠 · klmedia) — 패스백 노출 정합

| 날짜 | 1.10 dsp3 (G) | DAILY_PASSBACK_STATS.imp (Dable) | external_daily.imp (vendor API) |
|---|---:|---:|---:|
| 4-15 | 26,103 | 25,813 | **25,101** |
| 4-14 | — | 14,637 | **14,256** |
| 4-13 | — | 12,257 | **11,878** |

UI 의 "패스백 노출" (vendor_imp) 셀에 **vendor API 측 imp** 가 표시됨.

---

## 9. 미해결 이슈

### 9.1 `vendor_source` 오염 가능성
`external_daily` 에 같은 source 내 external_key 가 여러 값 존재할 수 있음. 현재는 첫 match 만 사용. widget 이 한 벤더의 여러 page/service 에 걸쳐있으면 누락 가능. → 필요 시 `external_mapping` 를 1:N 관계로 설계 확장.

### 9.2 FriendPlus API 미구현
`vendor_id=5` 는 DW `DAILY_PASSBACK_STATS` 에 있으나 외부 API 수집이 `daily-redash-import` 에 없음. friendplus 가 있는 widget 의 "패스백 노출" (`vendor_imp`) 은 항상 0. API 사양 확보 후 `externalService.fetchFriendPlusData` 추가 필요.

### 9.3 V7a1pGx7 (머니투데이) `vendor_imp` = 0
`external_mapping.external_key = "머니투데이"` 로 등록했으나 syncmedia API 가 반환하는 `media_name` 과 일치 안 됨 (실제 값은 URL-encoded 형태). external_key 를 syncmedia API 원본 값으로 업데이트 필요. 확인 방법:
```sql
SELECT DISTINCT external_service_name
FROM media.external_daily
WHERE source = 'syncmedia'
ORDER BY 1;
```

### 9.4 DW `impressions_dsp3` vs `DAILY_PASSBACK_STATS.impressions` 불일치
wXQ2k2yo 2026-04-15: 26,103 vs 25,813 (차이 290). 대부분 widget 은 일치하나 일부 widget 에서 소량 차이. ETL 타이밍 이슈 추정. 현재 G 로는 **`DAILY_PASSBACK_STATS.impressions` (vendor_id IN {2,4,5} 합산) 사용**.

### 9.5 "하우스 노출" 컬럼 (설계 예정)
`DAILY_PASSBACK_STATS.impressions − external_daily.imp` = Dable 하우스 광고 imp 후보. 별도 DW 컬럼은 없음. 추가 요구 시 `external_total_daily.house_imp` 컬럼 신설 + cron 로직 보강 필요.

### 9.6 RPM 정의 차이
엑셀 `M (RPM 대시보드)` = 운영자 수동 입력 (1,319 식). DW 계산값 `org_cost_spent × 1000 / impressions` = 2,994 (2026-04-15 V7a1pGx7). 엑셀 M 은 dable 쪽 매출/응답 imp 기준, DW 는 전체 매출/전체 imp. **DW 정의가 정확** 하므로 표시값은 DW 기준.

### 9.7 `fetched_at` 업데이트 안 됨
UPSERT UPDATE 경로에서 `DEFAULT now()` 는 적용 안 됨 (PostgreSQL 기본 동작). 모니터링에 사용할 경우 UPDATE 문의 `SET fetched_at = now()` 명시 필요 — 현재는 최초 INSERT 시점 타임스탬프만 의미.

---

## 10. 관련 파일

### 10.1 타입
- [`types/fc.ts`](../types/fc.ts) — `ExternalFcConstants`, `PassbackVendorSlug`, `ExternalFcAutoInputs`, `ExternalFcRow`, `ExternalFcPagePayload`
- [`types/external.ts`](../types/external.ts) — `UnitPriceValue`, `ExternalValueRow`, `ExternalDailyRow`, `ExternalMappingRow`

### 10.2 로직
- [`lib/logic/external-fc-logic.ts`](../lib/logic/external-fc-logic.ts) — `deriveFcRow()`, `deriveFcRows()`
- [`lib/logic/external-fc-defaults.ts`](../lib/logic/external-fc-defaults.ts) — `DEFAULT_FC_CONSTANTS`
- [`lib/logic/external-fc-vendors.ts`](../lib/logic/external-fc-vendors.ts) — `PASSBACK_VENDORS`, `vendorIdToSlug`, `pickPrimaryVendor`
- [`lib/logic/external-unit-price.ts`](../lib/logic/external-unit-price.ts) — `findUnitPriceForDate()`

### 10.3 데이터 접근
- [`lib/features/fc-value-sync/redash-fetch.ts`](../lib/features/fc-value-sync/redash-fetch.ts) — `fetchDwFcMetrics()`, `fetchDwSnapshot()`, Redash adhoc 쿼리 + polling
- [`lib/features/fc-value-sync/job.ts`](../lib/features/fc-value-sync/job.ts) — CPM/FC 이력 sync
- [`lib/features/fc-value-sync/cron.ts`](../lib/features/fc-value-sync/cron.ts) — 07:00 KST
- [`lib/features/fc-value-sync/diff.ts`](../lib/features/fc-value-sync/diff.ts) — `unitPriceChanged()`, `mergeSnapshot()`
- [`lib/features/fc-metrics-sync/job.ts`](../lib/features/fc-metrics-sync/job.ts) — 캐시 메트릭 sync + vendor_imp 병합
- [`lib/features/fc-metrics-sync/cron.ts`](../lib/features/fc-metrics-sync/cron.ts) — 07:30 KST
- [`lib/features/fc-metrics-sync/date-range.ts`](../lib/features/fc-metrics-sync/date-range.ts) — `computeFcSyncRange()` (14일 gap)
- [`lib/api/externalFcService.ts`](../lib/api/externalFcService.ts) — `getExternalFcPayload()`, `listManagedWidgets()`, `readFcMetricsFromCache()`
- [`lib/api/externalService.ts`](../lib/api/externalService.ts) — KL Media / SyncMedia API fetch + `external_daily` upsert

### 10.4 UI
- [`app/external/fc/page.tsx`](../app/external/fc/page.tsx) — 서버 컴포넌트
- [`app/external/fc/_components/FcClient.tsx`](../app/external/fc/_components/FcClient.tsx) — widget picker + 월 네비
- [`app/external/fc/_components/FcTable.tsx`](../app/external/fc/_components/FcTable.tsx) — 30 렌더 컬럼
- [`app/external/fc/_components/WidgetPicker.tsx`](../app/external/fc/_components/WidgetPicker.tsx) — 검색 + 외부 클릭/ESC 닫기
- [`app/external/fc/admin/page.tsx`](../app/external/fc/admin/page.tsx) — 관리 페이지
- [`app/external/fc/admin/_components/UnitPriceEditor.tsx`](../app/external/fc/admin/_components/UnitPriceEditor.tsx) — external_value CRUD
- [`app/api/fc/sync/route.ts`](../app/api/fc/sync/route.ts) — 수동 sync 트리거
- [`app/api/fc/value/route.ts`](../app/api/fc/value/route.ts) — external_value CRUD API

### 10.5 스키마·설정
- [`_docs/sql/20260417_external_total_daily.sql`](./sql/20260417_external_total_daily.sql) — 캐시 테이블 DDL
- [`types/database.types.ts`](../types/database.types.ts) — Supabase generated + `external_total_daily` 수동 추가
- [`instrumentation.ts`](../instrumentation.ts) — 3 cron 등록 (`daily-redash-import`, `fc-value-sync`, `fc-metrics-sync`)

### 10.6 원본 참고
- [`_docs/260417-sample.xlsx`](./260417-sample.xlsx) 시트 `FC관리`
- [`docs/superpowers/specs/2026-04-17-external-fc-design.md`](../docs/superpowers/specs/2026-04-17-external-fc-design.md)
- [`docs/superpowers/plans/2026-04-17-external-fc-implementation.md`](../docs/superpowers/plans/2026-04-17-external-fc-implementation.md)

---

## 11. 운영 체크리스트

**새 widget 등록 시**:
- [ ] `media.external_mapping` insert (source + external_key + widget_id)
- [ ] external_key 가 vendor API 의 실제 응답 값과 일치하는지 확인 (`external_daily` 조회)
- [ ] `external_value` 에 internal/vendor CPM + fc 초기값 등록 (관리 페이지)
- [ ] `POST /api/fc/sync?widget=WIDGET_ID&start=...&end=...` 로 수동 백필
- [ ] 브라우저 smoke: `/external/fc?widget=WIDGET_ID` 에서 값 확인

**공식 변경 시**:
- [ ] `lib/logic/external-fc-logic.ts` 수정 → 단위 테스트 통과
- [ ] 캐시 raw 값은 그대로 사용 가능 (재백필 불필요) — 클라이언트 재렌더만으로 반영

**캐시 raw 변경 시** (예: DW 컬럼 추가):
- [ ] `media.external_total_daily` 컬럼 ALTER
- [ ] `types/database.types.ts` 수동 업데이트 (Supabase CLI 대안)
- [ ] `fc-metrics-sync/redash-fetch.ts::fetchDwFcMetrics` SQL 수정
- [ ] `fc-metrics-sync/job.ts` upsert 매핑 추가
- [ ] `types/fc.ts::ExternalFcAutoInputs` 필드 추가
- [ ] 전체 widget 재백필 (`POST /api/fc/sync?start=&end=`)
