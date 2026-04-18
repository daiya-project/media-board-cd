# Daily Data Auto-Import 구조

이 문서는 `media.daily` 테이블에 매일 자동으로 데이터를 적재하는 **서버사이드 자동화 파이프라인**의 구조를 설명한다.

이전의 Google Sheets + CSV 붙여넣기 방식(`05-data-dailyimport.md`) 은 "브라우저에서 CSV 를 읽어 수동 import" 하는 흐름이었지만, 현재는 **Next.js 서버 프로세스 안에서 `node-cron` 이 매일 정시에 Redash API 를 호출 → Supabase 로 batch upsert** 하는 서버사이드 자동 파이프라인으로 대체되었다. 모달(수동 import) 경로도 같은 내부 모듈을 공유한다.

---

## 1. 한눈에 보기 — 자동화된 3개 잡

`instrumentation.ts` 가 Next.js 서버 부팅 시점에 아래 3개 cron 을 등록한다. 모두 **Asia/Seoul 타임존 기준** 이며 `node-cron` 의 in-process 타이머로 동작한다.

| 잡 이름 | 실행 시각 (KST) | 원천 | 적재 대상 |
|---|---|---|---|
| **daily-redash-import** | **매일 06:00** | Redash 쿼리 11939 (`redash.dable.io`) | `media.daily` (본 문서 주 대상) |
| fc-value-sync | 매일 07:00 | Redash DW snapshot + FC map | `media.external_value` (단가 diff 시 신규 row) |
| fc-metrics-sync | 매일 07:30 | Redash FC metrics + `media.external_daily` | `media.external_total_daily` |

등록 진입점: [instrumentation.ts:9-25](../instrumentation.ts#L9)

> **단일 리플리카 전제**: `hpa_enabled: false`, `replicas: 1` 이어야 중복 실행이 없다. HPA 활성 시 [deploy-llm-schedule.md §7.1](~/.claude/rules/deploy-llm-schedule.md) 의 advisory lock 패턴을 도입해야 한다.

---

## 2. 주 파이프라인 — `daily-redash-import`

### 2.1 데이터 원천

- **Redash** (`https://redash.dable.io`) 쿼리 ID **11939**
- Dable 데이터 웨어하우스(DW)의 광고 성과 데이터를 client / service / widget 단위 × 날짜 단위로 집계한 쿼리
- POST `/api/queries/11939/results` 호출 → 캐시 hit 시 즉시 반환, miss 시 job 발급 후 2초 간격 최대 10분 폴링

관련 코드: [lib/features/daily-redash-import/redash-fetch.ts](../lib/features/daily-redash-import/redash-fetch.ts)

### 2.2 사용 기술 스택

| 계층 | 기술 / 라이브러리 | 역할 |
|---|---|---|
| 스케줄러 | `node-cron` (FastAPI/Celery 등 외부 의존 없음) | Next.js 서버 프로세스 내부 타이머 |
| 서버 부팅 훅 | Next.js `instrumentation.ts` | Pod 기동 시 cron 1회 등록 |
| HTTP 클라이언트 | `fetch` (내장) | Redash REST API 호출 + 2초 폴링 |
| DB 클라이언트 | `@supabase/supabase-js` (cookie-free) | `request scope` 밖에서 동작하는 전용 클라이언트 |
| 인증 | `REDASH_API_KEY` (server-only env var) | Redash user-level API key — `Authorization: Key <token>` |
| 타임존 처리 | 순수 함수(KST=UTC+9) | DST 없음, cron `{ timezone: "Asia/Seoul" }` |

### 2.3 실행 흐름

```
[06:00 KST tick]
    │
    ▼
cron.ts  ← node-cron 콜백 (try/catch 최상위)
    │    runDailyImportJob({ mode: "incremental" })
    ▼
job.ts   ← 오케스트레이션 진입점
    │   1) createCronSupabase()            ── cookie-free client
    │   2) getLastImportedDate()           ── gap recovery 용
    │   3) computeSyncRange()              ── start..end 계산 (date-range.ts)
    │   4) fetchAllClientIds()             ── media.client 화이트리스트
    │   5) fetchRedashRecords()            ── POST + 폴링 (redash-fetch.ts)
    │   6) redashRowToParsedCSVRow map     ── adapter.ts
    │   7) importParsedRows()              ── 검증/dedup/entity 등록/배치 upsert
    │   8) refresh_daily_views() RPC       ── MV 5종 CONCURRENTLY REFRESH
    ▼
media.daily                                 ── upsert (date, widget_id) conflict
    + media.service / media.widget          ── 신규 발견 시 자동 등록
    + Materialized Views                    ── v_daily / v_daily_by_service / ...
```

관련 코드:
- [lib/features/daily-redash-import/cron.ts:21-40](../lib/features/daily-redash-import/cron.ts#L21) — `cron.schedule("0 6 * * *", ..., { timezone: "Asia/Seoul" })`
- [lib/features/daily-redash-import/job.ts:53-128](../lib/features/daily-redash-import/job.ts#L53) — `runDailyImportJob()`
- [lib/features/daily-redash-import/date-range.ts:53-74](../lib/features/daily-redash-import/date-range.ts#L53) — `computeSyncRange()`
- [lib/logic/importOrchestration.ts:326-335](../lib/logic/importOrchestration.ts#L326) — 성공 후 `refreshDailyViews()` 호출
- [lib/api/importDbOps.ts:155-158](../lib/api/importDbOps.ts#L155) — `refresh_daily_views` RPC wrapper

### 2.4 Gap Recovery (자가 복구)

cron 이 며칠 누락되어도 자동 보충되도록 **범위 계산이 `latestDate` 기반** 으로 설계되어 있다:

```
end    = KST 기준 D-1
start  = latestDateInDb ? latestDateInDb + 1일 : end
latestDateInDb >= end → skip
```

- Pod 재시작, 빌드 실패, 네트워크 장애 등으로 n일 누락돼도 다음 정상 tick 에서 한 번에 보충
- 별도 backfill 인프라 불필요
- 테스트: [lib/features/daily-redash-import/\_\_tests\_\_/](../lib/features/daily-redash-import/__tests__/)

### 2.5 수동 트리거 (모달 보정용)

정기 cron 외에 **수동 재적재** 경로도 같은 내부 모듈을 공유한다:

- 진입: 헤더 "Import" 버튼 → `ImportModal`
- API: [app/api/import/redash/route.ts](../app/api/import/redash/route.ts)
- 내부: 동일 `runDailyImportJob({ mode: "force", range })` 호출
- 차이: 사용자가 지정한 기간을 그대로 사용 (gap recovery 무시), 진행률 progress 이벤트 스트림 반환

---

## 3. 보조 파이프라인 — FC 자동화 (참고용)

`media.daily` 와는 별개로, FC(가격/메트릭) 관련 데이터를 유지하는 2개의 cron 이 같은 서버에서 동작한다. `media.daily` 가 적재된 **직후** 시간대에 배치되어 의존성을 순서대로 처리한다.

### 3.1 `fc-value-sync` — 매일 07:00 KST

- 코드: [lib/features/fc-value-sync/cron.ts](../lib/features/fc-value-sync/cron.ts)
- 원천: Redash DW snapshot + FC map 조회
- 로직: 관리 대상 widget 별 현재 단가 vs 마지막 저장값 diff → 변경 시 `media.external_value` 에 새 row insert (`start_date=today`)
- 특징: FC prefetch 는 실패 시 fail-open — S/T 데이터는 계속 처리

### 3.2 `fc-metrics-sync` — 매일 07:30 KST

- 코드: [lib/features/fc-metrics-sync/cron.ts](../lib/features/fc-metrics-sync/cron.ts)
- 원천: Redash FC metrics + `media.external_daily` vendor API 데이터
- 로직: widget × date 단위 ExternalFcAutoInputs 스냅샷을 `media.external_total_daily` 에 upsert
- `external_total_daily` 테이블 정의: [\_docs/sql/20260417\_external\_total\_daily.sql](./sql/20260417_external_total_daily.sql)

---

## 4. 환경변수 / Credential

LiteLLM Code Deploy Custom Credential 로 등록되어 Pod 에 주입된다.

| 키 | 범위 | 용도 |
|---|---|---|
| `REDASH_API_KEY` | server-only | Redash user-level API key (`Authorization: Key ...`) |
| `NEXT_PUBLIC_SUPABASE_URL` | 빌드+런타임 | Supabase REST 엔드포인트 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 빌드+런타임 | anon 키 — RLS 통과하여 `media.daily` 등에 upsert |

> **중요**: `REDASH_API_KEY` 는 **user-level personal API key** 여야 한다. query-level API key 는 파라미터가 없는 cached read 전용이라 POST + polling 이 불가능하다.

> **주의**: `NEXT_PUBLIC_*` 변수는 빌드 타임에 클라이언트 번들에도 inline 되므로 Dockerfile builder 스테이지의 `ENV` 선언이 필요하다. 런타임만 주입되면 빌드 결과가 반영되지 않는다 ([deploy-llm-schedule.md §5](~/.claude/rules/deploy-llm-schedule.md)).

---

## 5. 로그 / 모니터링

모든 cron 은 표준 prefix 로 로깅한다:

```
[daily-redash-import] registered (0 6 * * * Asia/Seoul)
[daily-redash-import] ok     { range, redashRows, importedRows, failedRows, durationMs, ... }
[daily-redash-import] failed { error, stack, durationMs }
```

LiteLLM 런타임 로그에서 필터:

```bash
curl -s "https://litellm.internal.dable.io/v1/code-deployments/9605fb4a-80be-4c1a-b5f7-49d572b2f42a/logs?type=runtime" \
  -H "Authorization: Bearer $LITELLM_PAT" \
  | jq -r .runtime_log \
  | grep -E '\[daily-redash-import\]|\[fc-value-sync\]|\[fc-metrics-sync\]'
```

기대값:
- 매일 06:00 KST ±1분 내 `[daily-redash-import] ok` 1건
- `failedRows > 0` 이 반복되면 Redash 쿼리 / adapter 매핑 점검
- `refresh_daily_views failed` 경고는 non-fatal 로 처리되지만, 빈번하면 MV 의존 페이지 체감 성능 저하 → 함수 별 REFRESH 시간을 검토

---

## 6. 관련 파일 인덱스

| 파일 | 역할 |
|---|---|
| [instrumentation.ts](../instrumentation.ts) | 서버 부팅 시 cron 3개 등록 |
| [lib/features/daily-redash-import/cron.ts](../lib/features/daily-redash-import/cron.ts) | `0 6 * * *` 스케줄 + 최상위 try/catch |
| [lib/features/daily-redash-import/job.ts](../lib/features/daily-redash-import/job.ts) | 오케스트레이션 진입점 (자동/수동 공용) |
| [lib/features/daily-redash-import/date-range.ts](../lib/features/daily-redash-import/date-range.ts) | gap recovery 범위 계산 (순수 함수) |
| [lib/features/daily-redash-import/redash-fetch.ts](../lib/features/daily-redash-import/redash-fetch.ts) | Redash POST + polling |
| [lib/features/daily-redash-import/adapter.ts](../lib/features/daily-redash-import/adapter.ts) | Redash row → ParsedCSVRow 변환 |
| [lib/logic/importOrchestration.ts](../lib/logic/importOrchestration.ts) | 검증 / dedup / entity 자동 등록 / batch upsert / MV refresh |
| [lib/api/importDbOps.ts](../lib/api/importDbOps.ts) | low-level Supabase 조작 + `refresh_daily_views` RPC wrapper |
| [lib/supabase/cron-client.ts](../lib/supabase/cron-client.ts) | cookie-free Supabase 클라이언트 (request scope 밖에서 동작) |
| [app/api/import/redash/route.ts](../app/api/import/redash/route.ts) | 모달 수동 트리거 진입점 (내부적으로 같은 job 호출) |

---

## 7. 운영 체크리스트 (간단 요약)

- [ ] `REDASH_API_KEY` 는 user-level personal key 인지 (query-level 은 불가)
- [ ] `hpa_enabled: false`, `replicas: 1` 유지 — 다중 인스턴스 시 중복 실행
- [ ] 빌드 실패 시 기존 Pod 유지되어 cron 은 계속 동작하지만, 변경된 cron 로직은 반영 안 됨
- [ ] Pod 재시작 직후 다음 정시 tick 까지는 공백 — 단, gap recovery 가 자동 보충
- [ ] 수동 trigger 경로의 `force` 모드는 gap recovery 를 **우회** 하므로 기간을 명확히 지정해야 함
- [ ] `refresh_daily_views()` 는 30초 앱 timeout + 120초 DB timeout — MV 규모가 커지면 상향 검토 ([supabase/migrations/2026041801-materialized-view-v-daily.sql](../supabase/migrations/2026041801-materialized-view-v-daily.sql))
