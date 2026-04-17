# FC DW Snapshot 자동화 — 상세 디자인 Spec

작성일: 2026-04-17
관련 문서:
- 기획서(초안): `docs/superpowers/plans/2026-04-17-fc-dw-snapshot-plan.md`
- 운영 레퍼런스: `_docs/80-3rdparty-billing.md` §12
- 외부 FC 설계 원안: `docs/superpowers/specs/2026-04-17-external-fc-design.md`

---

## 1. 목적 · 배경

`lib/features/fc-value-sync/redash-fetch.ts::fetchDwSnapshot` 는 cron 이 매일 위젯별로 S(internal CPM) · T(vendor CPM) · FC(Flooring CPM) 3종을 DW 에서 snapshot 해 `media.external_value` 에 append-only 이력으로 기록하는 구조를 목표로 한다. 현재 S 와 T 는 `fact_daily.*` 팩트 테이블에서 정상 수집 중이나, FC 컬럼은 Redash EDA Trino 에서 원본 MySQL (`dable.WIDGET`) 에 접근 가능한지 미검증 상태였기에 `CAST(NULL AS integer) AS fc` 로 하드코딩되어 있었다. 운영자는 `/external/fc/admin` 에서 수동 입력하도록 설계되었으나 실적이 없어 `external_value` 17 row 중 `fc` key 가 포함된 row 는 **0건**.

2026-04-17 스모크에서 `mysql_reco_re.dable.{WIDGET, WIDGET_SETTING}` 모두 Redash Trino 에서 직접 조회 가능 + `json_extract_scalar` 로 `default_settings.passback.ad_low_rpm_passback` 추출 정상 확인. 이 spec 은 해당 경로를 이용해 FC 를 cron 에서 자동 snapshot 하도록 하는 변경을 정의한다.

**정책 요약** (브레인스토밍에서 확정)

- FC 의 단일 진실 원본은 **DW** (`dable.WIDGET` / `WIDGET_SETTING`). 운영자 수동 입력은 S/T 와 동일하게 "익일 cron 이 덮어씀" 거동.
- 이상값(예: `fc=1`) 은 있는 그대로 기록하고 **사람이 수동으로 모니터링·관리**.
- 관리 페이지 UI 는 추후 전면 리디자인 예정 → 이번 기획 스코프에서 **분리**.

## 2. 스코프

### In scope

- `lib/features/fc-value-sync/redash-fetch.ts` 에 `fetchDwFcMap` 신설 (MySQL 카탈로그 1회 prefetch).
- `fetchDwSnapshot` 의 SQL / SnapshotRow / 결과 매핑에서 `fc` 컬럼 제거.
- `lib/features/fc-value-sync/job.ts` 의 cron 오케스트레이션에 prefetch 단계 삽입 + widget 루프 내 메모리 lookup 주입.
- `__tests__/redash-fetch.test.ts` 조정 + `__tests__/diff.test.ts` / `__tests__/job.test.ts` (존재 시) 에 신규 케이스 추가.
- 로깅 요약 필드 확장 (`fcPrefetched`, `fcResolved`, `fc_prefetch_failed` 경고).

### Out of scope

- 관리 페이지 (`app/external/fc/admin`) UI 변경 — 전면 개편 예정.
- `SERVICE_SETTING` fallback 합류 — 우선순위 정책 사내 확인 필요, 별도 task.
- 과거 시점 FC 백필 — DW 원본이 snapshot only 이라 불가.
- FC 변경 Slack 알림 / Anomaly detection — 후속 과제.

## 3. 아키텍처

### 3.1 호출 그래프

```
runFcValueSyncJob(now)
├─ createCronSupabase()
├─ 관리 대상 widgetIds[] ← external_mapping (기존)
├─ ★ fcMap = await fetchDwFcMap({ widgetIds, apiKey })   ← 신설 (1회, MySQL 카탈로그)
│    - 실패 시 catch 후 fcMap = new Map(), 경고 로그 (F1 fail-open)
└─ for widgetId in widgetIds:
   ├─ snap = await fetchDwSnapshot({ widgetId, date, apiKey })   (기존, fc 컬럼 제거)
   ├─ if (fcMap.has(widgetId)) snap.fc = fcMap.get(widgetId) ?? undefined
   ├─ latest = external_value 조회 (기존)
   └─ if (unitPriceChanged(latest, snap)) insert new row  (기존)
```

### 3.2 왜 prefetch 분리인가

브레인스토밍에서 검토한 3안 중 **A2 (FC 만 전체 prefetch)** 선택:

- 기존 snapshot SQL 에 서브쿼리를 추가(A1)하면 widget 루프마다 MySQL RDS hit → N 배 부하. Trino cross-catalog 쿼리 플래너의 예측 불가 레이턴시도 리스크.
- 별도 2차 Redash 쿼리를 widget 당 호출(A3)하면 Trino 호출 수 = 2N 으로 증가.
- A2 는 Trino 호출 수 = N + 1, MySQL 부하 = 1회 IN 쿼리. 실패 격리도 쉬움 — FC prefetch 만 try/catch 로 감싸 S/T 경로와 독립.

### 3.3 실패 모드 (F1 fail-open)

`fetchDwFcMap` 이 throw 하면 cron 은 전체 중단하지 않고 `fcMap = new Map()` 으로 폴백해 S/T 만 정상 수집한다. FC 는 그날 `undefined` 로 유지 → 기존 `value.fc` 가 보존된다. 경고 로그 `[fc-value-sync] fc_prefetch_failed` 를 별도로 남겨 후속 조치.

근거: FC 는 "보조 참고 지표"이고 S/T 가 리포트 산식의 주축이므로, MySQL RDS 일시 장애로 S/T 마저 중단하는 건 과잉.

## 4. 인터페이스

### 4.1 신설 — `fetchDwFcMap`

```typescript
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
 *   - DW 의 WIDGET 테이블에 해당 widget_id 가 없으면 Map 에 key 자체 없음 (JOIN 으로 row 누락)
 *   - row 는 있으나 override/default 양쪽 모두 NULL 이면 key 포함 + value=null
 *   - 호출부는 `fcMap.has(id) && v != null` 일 때만 snap.fc 주입, 그 외는 skip
 *     → diff.ts 의 "undefined=skip" 거동을 활용해 기존 값을 보존한다.
 *
 * widget_id 는 `^[A-Za-z0-9_-]{1,32}$` 정규식으로 사전 검증 (SQL 조립 injection 방지).
 * widgetIds.length === 0 이면 즉시 빈 Map 반환 (Trino 호출 생략).
 */
export async function fetchDwFcMap(
  opts: FetchDwFcMapOpts,
): Promise<Map<string, number | null>>;
```

### 4.2 변경 — `fetchDwSnapshot`

```diff
 interface SnapshotRow {
   internal_cpm: number | null;
   vendor_2_cpm: number | null;
   vendor_4_cpm: number | null;
   vendor_5_cpm: number | null;
-  fc: number | null;
 }

 const sql = `
   ...
-  -- fc 는 dable.WIDGET JSON. 현재 NULL fallback.
-  CAST(NULL AS integer) AS fc
+  -- fc 는 fetchDwFcMap 으로 prefetch, 호출부(job.ts)에서 메모리 주입
 `;

 ...
-  if (r.fc != null) result.fc = Number(r.fc);
```

시그니처(`FetchDwSnapshotOpts`, 반환 `UnitPriceValue`)는 변경 없음.

### 4.3 `job.ts` 오케스트레이션

```diff
 export async function runFcValueSyncJob(now: Date = new Date()): Promise<SyncResult> {
   ...
   const widgetIds = Array.from(new Set(...));
+
+  // FC prefetch — 실패 시 fail-open (S/T 는 그대로 진행)
+  let fcMap = new Map<string, number | null>();
+  let fcPrefetched = 0;
+  let fcResolved = 0;
+  try {
+    fcMap = await fetchDwFcMap({ widgetIds, apiKey });
+    fcPrefetched = widgetIds.length;
+    fcResolved = Array.from(fcMap.values()).filter((v) => v != null).length;
+  } catch (err) {
+    console.warn(
+      `[fc-value-sync] fc_prefetch_failed ${err instanceof Error ? err.message : String(err)}`,
+    );
+  }

   for (const widgetId of widgetIds) {
     try {
       const snap = await fetchDwSnapshot({ widgetId, date: today, apiKey });
+      if (fcMap.has(widgetId)) {
+        const v = fcMap.get(widgetId);
+        if (v != null) snap.fc = v;   // null/undefined 면 기존 값 유지
+      }
       ...
```

`SyncResult` 에 요약 필드 2개 추가:

```diff
 export interface SyncResult {
   widgetsChecked: number;
   widgetsInserted: number;
   failures: number;
+  fcPrefetched: number;
+  fcResolved: number;
   details: Array<{ widget_id: string; changed: boolean; error?: string }>;
   durationMs: number;
 }
```

## 5. SQL 상세

### 5.1 `fetchDwFcMap` SQL

```sql
-- ============================================================
-- FC prefetch (widget override > default JSON)
-- 구분: media
-- 용도: fc-value-sync cron 1회 prefetch 로 widget 별 현재 FC 확보
-- 주요 컬럼: widget_id, fc
-- 테이블: mysql_reco_re.dable.WIDGET, mysql_reco_re.dable.WIDGET_SETTING
-- ============================================================
WITH target AS (
  SELECT widget_id
  FROM (VALUES ('<id1>'), ('<id2>'), ('<idN>')) AS t(widget_id)
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
```

결정 근거:
- `TRY_CAST` → ws.value 나 JSON 값이 숫자가 아니면 NULL 로 떨어져 cron 전체가 깨지지 않는다.
- Trino 의 `key` 는 reserved keyword 아님 → backtick 불필요.
- `default_settings` 컬럼은 MySQL `text` 라 Trino 에서 varchar 로 보이지만, 방어적으로 `CAST(... AS varchar)` 래핑.
- `VALUES (...)` 리스트 조립은 `widget_id` 를 `^[A-Za-z0-9_-]{1,32}$` 정규식 사전 검증을 거쳐 단순 문자열 치환으로 안전.

### 5.2 변경된 `fetchDwSnapshot` SQL

```sql
WITH params AS (
  SELECT CAST('<widgetId>' AS varchar) AS widget_id,
         CAST('<date>'     AS varchar) AS d
)
SELECT
  (SELECT MAX(share_value) FROM fact_daily.ad_stats__daily_actual_sharing_cost_by_service_widget
    WHERE widget_id = (SELECT widget_id FROM params)
      AND local_basic_time = (SELECT d FROM params)
      AND share_type = 'cpm') AS internal_cpm,
  (SELECT MAX(cpm_value) FROM fact_daily.ad_stats__daily_passback_stats
    WHERE widget_id = (SELECT widget_id FROM params)
      AND local_basic_time = (SELECT d FROM params)
      AND vendor_id = 2) AS vendor_2_cpm,
  (SELECT MAX(cpm_value) FROM fact_daily.ad_stats__daily_passback_stats
    WHERE widget_id = (SELECT widget_id FROM params)
      AND local_basic_time = (SELECT d FROM params)
      AND vendor_id = 4) AS vendor_4_cpm,
  (SELECT MAX(cpm_value) FROM fact_daily.ad_stats__daily_passback_stats
    WHERE widget_id = (SELECT widget_id FROM params)
      AND local_basic_time = (SELECT d FROM params)
      AND vendor_id = 5) AS vendor_5_cpm
-- fc 는 fetchDwFcMap 에서 prefetch, 호출부에서 메모리 주입
```

(기존 SQL 에서 `CAST(NULL AS integer) AS fc` 1줄만 삭제.)

## 6. 데이터 거동 · 이력

- `media.external_value` 는 append-only. `unitPriceChanged` 가 true 인 widget 만 신규 row insert(`start_date=today, end_date=null`).
- 이 spec 배포 시점 이전의 FC 값은 어디에도 없다(`value ? 'fc' = 0건` 확인됨) — 백필 없이 배포 시점부터 자연 축적.
- DW 원본 `dable.WIDGET.default_settings` 는 snapshot only 이므로, cron 이 누락된 날의 FC 는 복원 불가. 이 리스크는 다음 정기 tick 에서 자연 복구되는 diff 구조로 수용.

### 6.1 이상값 정책 (V1 그대로 기록)

- `fc=0` · `fc=1` 같이 placeholder 로 의심되는 값도 가공 없이 저장. DW 가 단일 진실 원본이며 해석은 사람이 수동으로 수행.
- 이상 감지/UI 배지/알림은 후속 task. 이 spec 에서는 cron 요약 로그에 `fcResolved` 카운트만 노출해 사후 조회 가능성만 남긴다.

## 7. 관찰성

### 7.1 cron 요약 로그

```
[fc-value-sync] ok {
  widgetsChecked: 17,
  widgetsInserted: 2,
  failures: 0,
  fcPrefetched: 17,
  fcResolved: 14,
  durationMs: 3821
}
```

- `fcResolved === 0` 인데 `fcPrefetched > 0` 이면 JSON path 나 카탈로그 경로 의심 → 진단 트리거.
- prefetch 실패 시 별도 경고 1줄: `[fc-value-sync] fc_prefetch_failed <error_message>` (요약 로그의 `fcPrefetched=0` 과 함께).

### 7.2 Supabase spot check (운영 중)

```sql
-- 최근 fc 변경 히스토리
SELECT widget_id, value->>'fc' AS fc, start_date, created_at
FROM media.external_value
WHERE (value ? 'fc')
ORDER BY created_at DESC
LIMIT 20;
```

## 8. 테스트

단위 테스트는 기존 `lib/features/fc-value-sync/__tests__/` 에 추가·조정. 모든 외부 I/O (Redash fetch, Supabase client) 는 주입 훅(`__setFetchForTesting`) 으로 mock.

### 8.1 `fetchDwFcMap` (신규, `redash-fetch.test.ts`)

| 케이스 | 입력 mock 응답 | 기대 |
|---|---|---|
| override 있음 + default 있음 | `[{widget_id:'A', fc:'250'}]` (override 우선 COALESCE 이미 DB 단에서 처리됨) | `Map { 'A' → 250 }` |
| default 만 | `[{widget_id:'B', fc:'230'}]` | `Map { 'B' → 230 }` |
| 양쪽 모두 null | `[{widget_id:'C', fc:null}]` | `Map { 'C' → null }` |
| widget 이 DW 에 없음 | 응답에 해당 row 미포함 | `Map` 에 key 자체 없음 |
| widgetIds = [] | — | `Map` 비어있음, Trino 호출 없음 (fetch stub 호출 0회) |
| widgetIds 에 정규식 위반 값 (`"'; DROP"`) | — | `Error: Invalid widget_id format` throw, fetch stub 호출 0회 |

### 8.2 `fetchDwSnapshot` 조정 (`redash-fetch.test.ts`)

- 기존 케이스에서 `fc` 필드 단언 제거
- SnapshotRow mock 에서 `fc` 제거한 응답으로도 정상 반환됨을 확인

### 8.3 `diff.ts` 회귀 (`diff.test.ts`, 기존 유지)

- `snapshot.fc` 가 `undefined` 면 latest.fc 그대로 유지
- `snapshot.fc` 가 숫자면 덮어쓰기 대상
- 이미 커버되어 있으므로 변경 없음

### 8.4 `job.ts` 통합 (`job.test.ts` — 없으면 신설)

| 케이스 | 설정 | 기대 |
|---|---|---|
| prefetch 성공 + FC 변경 있음 | fcMap={A:230}, latest.fc=undefined | widget A 에 대해 new row insert, `value.fc=230` |
| prefetch 성공 + FC 동일 | fcMap={A:230}, latest.fc=230, S/T 도 동일 | insert 안 함 |
| prefetch 실패 (fail-open) | fetchDwFcMap mock throw | S/T diff 는 정상 진행, `fcPrefetched=0`, `fcResolved=0`, 에러는 cron 전체를 죽이지 않음 |
| widget 이 fcMap 에 없음 | widgetIds=['X'], fcMap has no 'X' | snap.fc 주입 skip, latest.fc 유지 |

## 9. 배포 · 검증

### 9.1 배포 절차

`~/.claude/rules/deploy-llm.md` 표준을 따른다.

1. 코드 변경 + 테스트 로컬 pass 확인
2. `git push origin main && git push deploy main`
3. `curl -X POST .../v1/code-deployments/9605fb4a-80be-4c1a-b5f7-49d572b2f42a/build`
4. `build_status: succeeded`, `deploy_status: running` 확인
5. 다음 06:00 KST cron tick 대기 (또는 수동 트리거 API 있을 시 즉시 검증)

### 9.2 배포 전 dry-run (선택)

로컬에서 production REDASH_API_KEY 로 `fetchDwFcMap` 만 호출해 예상 widget 몇 개 (예: V7a1pGx7 → 230) 값 일치 확인.

### 9.3 배포 후 검증

- runtime log 에서 `[fc-value-sync] ok` 줄 + `fcResolved > 0` 확인
- Supabase:
  ```sql
  SELECT widget_id, value->>'fc' AS fc, start_date
  FROM media.external_value
  WHERE (value ? 'fc')
  ORDER BY created_at DESC
  LIMIT 10;
  ```
  첫 tick 직후 다수 row 가 뜨면 정상. 전부 NULL 이면 prefetch 실패 조사.

## 10. 롤백

- **코드**: 본 spec 의 변경분(4–5장) 을 1 커밋 revert → `fetchDwSnapshot` 이 다시 `fc=NULL` 하드코딩, `fetchDwFcMap` 호출 제거
- **데이터**: 이미 insert 된 fc row 는 유지해도 무해(append-only, 사람이 관리). 필요 시 아래 SQL 로 선택 삭제:

```sql
DELETE FROM media.external_value
WHERE (value ? 'fc') AND created_at > '<배포 시각 ISO>';
```

## 11. 리스크 & 완화

| 리스크 | 가능성 | 영향 | 완화 |
|---|---|---|---|
| MySQL RDS 순간 장애로 prefetch 실패 | 중 | 낮음 | F1 fail-open — 다음 tick 자연 복구 |
| JSON path mismatch (스키마 변화) | 낮음 | 중 | `fcResolved===0` 을 지표로 감시; 첫 배포 당일 spot check |
| widget_id 형식 외 값 주입 | 낮음 | 높음 (SQL injection) | 정규식 사전 검증 (§4.1) |
| FC 이상값(1, 0) 이 리포트 해석 혼란 | 중 | 낮음 | V1 그대로 기록, 수동 관리 정책으로 수용 |
| 운영자 수동 입력이 cron 으로 덮어써짐 | 중 | 낮음 | S/T 에서도 이미 동일 거동. UI 전면 개편 시 정책 재논의 |
| Trino cross-catalog 쿼리 타임아웃 | 낮음 | 중 | `MAX_POLL_ATTEMPTS=300` (10분) 기존 설정 재사용; 실패 시 F1 |

## 12. 후속 과제

- 관리 페이지 UI 전면 리디자인 — FC 필드 위치·수동 편집 정책 재정의
- `SERVICE_SETTING` fallback 3-tier 합류 — 사내 우선순위 정책 확인 후
- FC 급변 시 Slack 알림 (예: Δ ≥ 50% 또는 0/1 ← → 정상값 전환)
- 이상값 자동 검증 배지 — UI 단에서 `fc=0/1` 에 경고 아이콘
