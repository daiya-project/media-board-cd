# Daily Redash Import — 자동화 설계

**작성일**: 2026-04-16
**대상 프로젝트**: `media-board-cd` (LiteLLM Code Deploy `9605fb4a-80be-4c1a-b5f7-49d572b2f42a`)
**관련 문서**:
- 현재 import 구조: [`_docs/05-data-dailyimport.md`](../../../_docs/05-data-dailyimport.md)
- 사내 cron 운영 룰: `~/.claude/rules/deploy-llm-schedule.md`
- 레퍼런스 프로젝트: `~/dev/ads-data-board-cd` (`lib/features/daily-sync/`)

---

## 1. 목적과 동기

운영자의 수동 작업("Redash 조회 → Google Sheets 붙여넣기 → 모달 클릭") 을 제거하고, **매일 06:00 KST 에 서버가 직접 Redash 를 호출해서 `media.daily` 를 자동 갱신** 한다.

부수적으로 매체사 추가 시마다 Redash 쿼리의 `client_id IN (...)` 파라미터를 손으로 갱신하던 작업도 사라진다 (서버가 `media.client` 에서 동적으로 빌드).

데이터 보정용 import 모달은 **UI 변경 없이** 유지하되, 내부 데이터 source 를 Google Sheets 에서 Redash 로 통일해 운영자가 보정 시에도 시트를 거치지 않도록 한다.

---

## 2. 배경 — 현재 상태

| 항목 | 현황 |
|---|---|
| 운영 흐름 | 운영자가 Redash 11939 실행 → 결과를 Google Sheets 에 붙여넣기 → 모달의 "Import" 버튼 클릭 |
| Source | Google Sheets `output=csv` URL (`NEXT_PUBLIC_IMPORT_CSV_URL`) |
| 실행 위치 | 브라우저 (`fetchCSVFromGoogleSheets` + `importCSVData` 모두 client-side) |
| Supabase 호출 | 브라우저, 사용자 세션 권한 |
| client_id 화이트리스트 | Redash 쿼리 파라미터에 박혀 있음 (수동 갱신) |

**제약을 넘은 변화의 가능성**: 과거 Netlify 배포에서는 Redash/dable obi 가 VPN 뒤라 서버가 직접 호출 불가였다. 지금은 LiteLLM 내부 인프라에 배포되어 있어 서버에서 두 시스템 모두 접근 가능 — 이 변경의 전제 조건.

---

## 3. 요구사항

### 기능
- 매일 **06:00 KST** 자동으로 어제 날짜 데이터를 `media.daily` 에 upsert
- 며칠 누락되어도 **자동 보충** (latestDate+1 ~ D-1 까지 한 번에)
- 매체사 추가 시 운영자 개입 없이 **`media.client` 에서 동적 화이트리스트** 적용
- 모달의 "데이터 보정" 흐름 (UI 동일) 도 같은 Redash 경로 사용
- 모달 force range 모드는 **31일 이내** 만 허용

### 비기능
- 단일 리플리카 (`replicas: 1`, `hpa_enabled: false`) 가정 — 검증됨
- 실패 시 로그만 남기고 다음 날 재시도. 알림은 1차 범위 외
- 영구 import 이력 테이블 없음 (런타임 로그로 충분)
- 동시 실행 방지 lock 없음 (충돌 시나리오는 매뉴얼 force 한 번으로 복구)

### 비범위 (이번 작업에서 제외)
- CVR import 자동화 — 같은 패턴으로 별도 작업 예정 (`NEXT_PUBLIC_IMPORT_CVR_CSV_URL` 그대로 유지)
- 알림 (Slack webhook 등)
- HPA 활성화 시 lock — 단일 리플리카 유지 가정

---

## 4. 아키텍처

### 4.1 데이터 흐름

```
┌─────────────────────────────┐         ┌─────────────────────────────┐
│ Cron (자동, 매일 06:00 KST)  │         │ Import Modal (보정용)        │
│ — instrumentation.ts +       │         │                             │
│   node-cron in-process       │         │  사용자 클릭                  │
│                              │         │  POST /api/import/redash    │
│ runDailyImportJob({          │         │  body: { mode: 'force',     │
│   mode: 'incremental' })     │         │          startDate, endDate}│
│ 직접 호출                     │         │  또는 mode: 'incremental'   │
└─────────────┬────────────────┘         └─────────────┬───────────────┘
              │                                        │
              │                                        ↓
              │                 ┌──────────────────────────────────────┐
              │                 │ app/api/import/redash/route.ts        │
              │                 │ — 사용자 세션 인증 (Supabase SSR)      │
              │                 │ — NDJSON streaming response           │
              │                 │ — runDailyImportJob() 호출             │
              │                 └──────────────────┬───────────────────┘
              │                                    │
              └───────────┬────────────────────────┘
                          ↓
   ┌────────────────────────────────────────────────────────────┐
   │ lib/features/daily-redash-import/job.ts                     │
   │ — runDailyImportJob({ mode, range?, onProgress? })           │
   │                                                              │
   │ ① date-range 결정 (incremental: gap recovery / force: 그대로)│
   │ ② media.client 에서 client_id 목록 조회                      │
   │ ③ redash-fetch 호출 (POST + Polling, 2초/300회)              │
   │ ④ adapter 로 ParsedCSVRow[] 변환                             │
   │ ⑤ importParsedRows() 호출 (검증 / dedup / entity 등록 /      │
   │    배치 upsert / view refresh — 기존 importOrchestration 자산)│
   └─────────────────────────────────────────────────────────────┘
                                  │
                                  ↓
                          media.daily 갱신
                                  ↓
                          refresh_daily_views()
```

### 4.2 컴포넌트 분리

```
instrumentation.ts                                # 신규
lib/features/daily-redash-import/                 # 신규 디렉토리
  ├─ cron.ts                                      # node-cron 등록
  ├─ job.ts                                       # 오케스트레이션
  ├─ redash-fetch.ts                              # POST + Polling (수동·자동 공용)
  ├─ date-range.ts                                # KST 범위 + gap recovery (순수 함수)
  └─ adapter.ts                                   # Redash row → ParsedCSVRow

app/api/import/redash/route.ts                    # 신규 — 모달 entry, NDJSON
lib/supabase/cron-client.ts                       # 신규 — cookie-free Supabase

lib/logic/importOrchestration.ts                  # 변경 — importParsedRows() entry 추가
components/modals/ImportModal/ImportModal.tsx     # 변경 — fetch 경로 + NDJSON reader
lib/utils/csvParser.ts                            # 변경 — parseCSV 제거, normalizeDate 만 유지

lib/api/importFetch.ts                            # 제거 — Google Sheets fetch
```

각 단위의 책임:

| 모듈 | 입력 | 출력 | 의존 |
|---|---|---|---|
| `cron.ts` | (없음, 시각 도달) | side effect (job 호출 + 로그) | `node-cron`, `job.ts` |
| `job.ts` | `{ mode, range?, onProgress? }` | `JobResult` (skipped, range, redashRows, insertedRows, …) | Supabase, redash-fetch, adapter, importOrchestration |
| `redash-fetch.ts` | `(start, end, clientIds[])` | `Record<string, unknown>[]` (Redash 원시 행) | `process.env.REDASH_API_KEY`, `fetch` |
| `date-range.ts` | `(latestDateInDb, nowUtc, mode, force?)` | `SyncDecision` ({ skip, range }) | 없음 (순수) |
| `adapter.ts` | `Record<string, unknown>[]` | `ParsedCSVRow[]` | 없음 (순수) |
| `cron-client.ts` | (없음) | `SupabaseClient<Database>` | `@supabase/supabase-js` |

순수 함수 (`date-range.ts`, `adapter.ts`) 는 단위 테스트로 검증.

---

## 5. 인터페이스 / 시그니처

### 5.1 `lib/features/daily-redash-import/job.ts`

```typescript
export type ImportMode = 'incremental' | 'force';

export interface RunImportOptions {
  mode: ImportMode;
  /** mode === 'force' 일 때 필수. inclusive. */
  range?: { start: string; end: string };  // YYYY-MM-DD
  /** 모달용. cron 은 생략. */
  onProgress?: (p: ImportProgress) => void;
  /** cancel 폴링. cron 은 생략. */
  onCancel?: () => boolean;
}

export interface JobResult {
  skipped: boolean;
  reason?: string;
  range?: { start: string; end: string };
  redashRows?: number;
  importedRows?: number;
  failedRows?: number;
  servicesCreated?: number;
  widgetsCreated?: number;
  durationMs: number;
}

export async function runDailyImportJob(opts: RunImportOptions): Promise<JobResult>;
```

### 5.2 `lib/features/daily-redash-import/cron.ts`

```typescript
let registered = false;

export function registerDailyImportCron(): void;
// schedule: "0 6 * * *", timezone: "Asia/Seoul"
// 콜백 안 try/catch — failed 시 로그만, 다음 날 재시도
```

### 5.3 `lib/features/daily-redash-import/redash-fetch.ts`

```typescript
export interface RedashRow {
  [key: string]: unknown;
}

export async function fetchRedashRecords(opts: {
  startDate: string;       // YYYY-MM-DD inclusive
  endDate:   string;       // YYYY-MM-DD inclusive
  clientIds: string[];     // ['5','10','14',...]
}): Promise<RedashRow[]>;
// POST /api/queries/11939/results with parameters
// Polling /api/jobs/{job_id} (2초 간격, 최대 300회 = 10분)
// GET /api/query_results/{id}
```

### 5.4 `lib/features/daily-redash-import/date-range.ts`

```typescript
export interface SyncRange { start: string; end: string; }

export type SyncDecision =
  | { skip: true;  reason: string }
  | { skip: false; range: SyncRange };

export function computeSyncRange(
  latestDateInDb: string | null,
  nowUtc: Date,
  forceRange?: SyncRange
): SyncDecision;
// force 가 있으면 그대로 (검증은 호출자 책임).
// 없으면 incremental: end = KST D-1, start = latestDate+1 || end.
// latestDate >= end → skip.
```

### 5.5 `lib/features/daily-redash-import/adapter.ts`

```typescript
export function redashRowToParsedCSVRow(row: RedashRow): ParsedCSVRow;
// Redash alias → DB 컬럼 매핑:
//   date, client_id (string cast), service_id (string cast),
//   service_name, widget_id, widget_name,
//   cost_spent, pub_profit, imp, vimp,
//   click → cnt_click, service_cv → cnt_cv
// client_name 은 무시 (현재 일관)
// 숫자 정규화 (BIGINT 도 number 로 캐스트)
```

### 5.6 `lib/logic/importOrchestration.ts` 변경

기존 `importCSVData(csvText, options)` 와 별개로 신규 entry:

```typescript
export interface ImportParsedRowsOptions {
  rows: ParsedCSVRow[];
  forceDateRange?: { startDate: string; endDate: string };
  onProgress?: (p: ImportProgress) => void;
  onCancel?: () => boolean;
  batchSize?: number;
  /** 호출자가 주입. cron / server route 모두 cron-client.ts 사용 (단일 권한 모델). */
  supabase: SupabaseClient<Database>;
}

export async function importParsedRows(opts: ImportParsedRowsOptions): Promise<ImportResult>;
```

기존 검증 / dedup / entity 등록 / 배치 upsert / view refresh 로직 그대로 재사용.

**Supabase 클라이언트 주입 정책**: cron 과 server route 모두 `lib/supabase/cron-client.ts` 의 `createCronSupabase()` 를 사용해 단일 권한 모델로 통일. 모달 호출도 사용자 세션 권한이 아닌 anon + persistSession:false 권한으로 upsert 한다. RLS 정책이 anon 에 열려 있는 현재 구조를 그대로 활용.

기존 `importCSVData` 는 **제거** — Google Sheets 경로 자체가 사라지므로 보존 가치 없음. `lib/api/importDbOps.ts` 의 함수들 (`getLastImportedDate`, `deleteDataByDateRange`, `fetchRegisteredClientIds`, `saveFailedRows`, `refreshDailyViews`) 도 supabase 인자를 받도록 시그니처 변경 (현재는 내부에서 `createMediaClient()` 호출 → 호출자가 주입하도록).

### 5.7 `app/api/import/redash/route.ts`

```typescript
export const runtime = 'nodejs';

export async function POST(req: Request): Promise<Response> {
  // 1. 사용자 세션 검증
  //    - Supabase SSR client (createServerClient with cookies)
  //    - getUser() 로 검증만 수행. 미인증 → 401
  //    - 데이터 upsert 에는 사용 안 함 (권한 분리)
  // 2. body 검증:
  //    - mode: 'incremental' | 'force'
  //    - force 면 startDate, endDate, ≤ today, end-start ≤ 31일
  // 3. NDJSON streaming response (Transfer-Encoding: chunked)
  //    - { type: 'phase', phase, message }
  //    - { type: 'progress', ...ImportProgress }
  //    - { type: 'result', ...ImportResult }
  //    - { type: 'error', message, jobId? }
  // 4. cron-client.ts 의 createCronSupabase() 로 데이터용 클라이언트 생성
  // 5. runDailyImportJob({ mode, range, onProgress: streamProgress, supabase })
}
```

**권한 모델 정리**:
- **인증** (이 사용자가 모달 호출 가능한가): Supabase SSR client + 세션 cookie
- **데이터 upsert** (실제 INSERT/UPDATE): cron-client (anon + persistSession:false)

이 분리로 cron 과 모달이 같은 권한 모델 (anon RLS) 을 공유하면서, 모달은 추가로 사용자 인증 게이트가 한 겹 더 있다.

### 5.8 `lib/supabase/cron-client.ts`

```typescript
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

export function createCronSupabase(): SupabaseClient<Database> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('SUPABASE 환경변수 미설정');
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: 'media' },
  });
}
```

---

## 6. 환경변수 / Credential

### 신규
- **`REDASH_API_KEY`** (server-only, credential)
  - 값: `sHNrVjaLUl9ykzGG5mtBP7xuWYjymYCzac8abL76` (운영자 personal key)
  - 등록: `media-board-secrets` credential 에 추가 (DELETE → POST 패턴)

### 제거
- **`NEXT_PUBLIC_IMPORT_CSV_URL`** (env_var) — Google Sheets 경로 폐지

### 유지
- `NEXT_PUBLIC_SUPABASE_URL` (env_var, Dockerfile builder ENV 도 그대로)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (credential, Dockerfile builder ENV 도 그대로)
- `KLMEDIA_API_KEY` (credential)
- `THREEDPOP_COMPANY_CODE` (env_var)
- `NEXT_PUBLIC_IMPORT_CVR_CSV_URL` (env_var) — CVR 별도 작업까지 유지

### Dockerfile 검토
`REDASH_API_KEY` 는 server-only — builder ENV 선언 불필요. 런타임 주입만으로 cron job 의 `process.env` 에서 접근 가능.

기존 `NEXT_PUBLIC_*` 두 개 (SUPABASE_URL/ANON_KEY) 의 builder ENV 선언은 그대로 유지.

### Dependency
- `node-cron` (production)
- `@types/node-cron` (dev) — node-cron v4+ 자체 타입 포함이면 생략

---

## 7. 마이그레이션 / 롤아웃 (Q14: 한 번에)

```
[Step 1] Redash 쿼리 11939 수정
  - SELECT 절 마지막 alias: servce_cv → service_cv
  - 변경 후 쿼리 1회 실행 → 결과 컬럼명 확인

[Step 2] 코드 변경 (단일 PR)
  신규
    instrumentation.ts
    lib/features/daily-redash-import/{cron,job,redash-fetch,date-range,adapter}.ts
    lib/supabase/cron-client.ts
    app/api/import/redash/route.ts
  변경
    lib/logic/importOrchestration.ts: importParsedRows() entry 추가, csvText 경로 제거
    components/modals/ImportModal/ImportModal.tsx: fetch 경로 교체, NDJSON reader
    lib/utils/csvParser.ts: parseCSV/parseCSVLine/parseNumber/parseString 제거,
                            normalizeDate 만 유지
    package.json: node-cron 추가
  제거
    lib/api/importFetch.ts
  로컬 검증
    npm run build 통과
    timeout 8 node .next/standalone/server.js → [daily-redash-import] registered 로그 확인

[Step 3] 환경 설정 (LiteLLM)
  credential DELETE + POST (REDASH_API_KEY 추가)
  env_vars PATCH (NEXT_PUBLIC_IMPORT_CSV_URL 제거)

[Step 4] 배포
  git push origin main && git push deploy main
  POST /v1/code-deployments/9605fb4a-.../build
  build_status: succeeded, deploy_status: running 확인

[Step 5] 검증
  GET /api/health → {"status":"ok"}
  런타임 로그: [daily-redash-import] registered (0 6 * * * Asia/Seoul) 확인
  모달에서 force range 1일 호출 → progress NDJSON 정상, DB 들어감 확인
  다음 06:00 KST 이후 [daily-redash-import] ok 로그 확인
  select max(date) from media.daily → 어제 날짜
```

**Step 1 과 Step 4 사이 빈 시간**: Redash 가 새 alias 로 결과 반환 중인데 코드는 아직 옛 alias 만 받는 구간. 모달이 호출되면 `cnt_cv` 가 0 으로 들어감. 이 빈 시간을 짧게 가져가기 위해 Step 2 PR 준비 완료 후 Step 1 실행 → 즉시 Step 3, 4 실행 권장.

만약 빈 시간 위험이 부담스러우면 **Q14 (a)** 로 회귀해 양쪽 alias 동시 지원 → 다음 PR 에서 legacy 제거. 현재 결정은 (b) — 빈 시간을 운영적으로 짧게 관리.

---

## 8. 에러 처리 & 로깅

### Cron
콜백 안 최상위 try/catch 가 모든 예외 흡수. 다음 날 자동 재시도 (gap recovery).

표준 로그 (런타임 로그에서 `grep '\[daily-redash-import\]'`):
```
[daily-redash-import] registered (0 6 * * * Asia/Seoul)         # 부팅 시 1회
[daily-redash-import] ok { skipped: false, range: {...},         # 정상
                           redashRows, importedRows,
                           servicesCreated, widgetsCreated, durationMs }
[daily-redash-import] ok { skipped: true, reason, durationMs }   # 이미 최신
[daily-redash-import] failed { error, stack, durationMs }        # 실패
```

### 모달
NDJSON 마지막 라인이 `error` → 기존 ResultStep 의 errorMessage UI 그대로.

```jsonc
{ "type": "error", "message": "Redash 쿼리 시간 초과 (10분)", "jobId": "abc-123" }
```

`jobId` 는 메시지에 inline 노출 → 운영자가 redash UI 에서 직접 job 확인.

### 에러 분류

| 시나리오 | Cron 로그 | 모달 표시 | 자동 재시도 |
|---|---|---|---|
| Redash 401/403 | `failed: 인증 실패` | "REDASH_API_KEY 확인" | 다음 날 |
| Redash 5xx | `failed: HTTP 5xx` | "Redash 일시 오류" | 다음 날 |
| Polling timeout | `failed: 시간 초과` + jobId | "쿼리 시간 초과 (job: xxx)" | 다음 날 |
| Job status=4 | `failed: 쿼리 실행 실패` | "Redash 쿼리 실패: <원본>" | 다음 날 |
| Supabase upsert 실패 | `failed: <Postgres>` | "DB 저장 실패" | 다음 날 |
| 결과 0행 | `ok { redashRows: 0 }` | "데이터 없음" (성공) | — |
| 미등록 client_id | `ok { failedRows: N }` | failedDetails 영역 표시 | — (매뉴얼) |

### 향후 알림
`cron.ts` catch 블록 끝에 `notifyFailure(err)` 한 줄 추가 + `notify.ts` 신설. 1차 범위 외.

---

## 9. 보안

- `/api/import/redash` 는 Supabase 세션 인증 — 미인증 호출 401
- `REDASH_API_KEY` 는 server-only env, 클라이언트 번들에 포함 X
- Cron 은 in-process 라 외부 노출 endpoint 없음 — secret 관리 부담 없음
- `media.client` 화이트리스트는 미등록 client_id 의 데이터 유입 방지 (기존 검증 로직 재사용)

---

## 10. 알려진 제약 / 향후

- **단일 리플리카 가정** — HPA 활성화 시 cron 중복 실행. 그 시점에 advisory lock 또는 leader election 도입 필요
- **Pod 재시작 직후 빈 구간** — 부팅부터 다음 cron tick 까지 작업 안 됨. gap recovery 로 다음 실행에서 보충
- **Gap recovery 의 큰 범위 위험** — `latestDate` 가 매우 오래된 경우 (수 주 누락) cron 한 번에 거대한 범위를 Redash 에 요청 → polling timeout 가능. 1차 구현에서는 안전 가드 없음. 발생 시 운영자가 force 모드로 작은 범위 나눠 보정. 추후 `date-range.ts` 에 max-range 가드 (예: 31일) 추가 검토
- **알림 없음** — 운영자가 런타임 로그 정기 점검 필요. Slack webhook 도입은 후속
- **CVR 별도** — CVR 도 같은 패턴으로 별도 작업 (`lib/features/daily-cvr-import/`?) 예정. 그 작업 후 `NEXT_PUBLIC_IMPORT_CVR_CSV_URL` 제거
- **`media.daily_failed` 활용** — 실패 행은 기존 테이블에 그대로 저장. 운영자 매뉴얼 검토용

---

## 11. 의사결정 기록

| # | 결정 | 대안 | 채택 이유 |
|---|---|---|---|
| 1 | Source: Redash API | dable obi MCP | MCP 는 MySQL surface 만 노출, Trino/Presto 의 `fact_daily.*` 동일 데이터 존재 여부 미검증. Redash 는 검증된 쿼리 그대로 사용 가능. 미래에 MCP PoC 별도 진행 가능 |
| 2 | Redash 호출: POST + Polling | Schedule + Sleep + Pull (cached GET) | client_id 동적 전달 자연스러움, 완료 시점 정확, force 모드와 코드 공유, Stale 결과 silent 위험 없음 |
| 3 | 모달도 Redash 통일 | 모달은 Google Sheets 그대로 | 운영자가 보정 시에도 시트 단계 거치지 않아도 됨. 코드 일원화. UI 변경 0 |
| 4 | Cron: in-process node-cron | GitHub Actions / 외부 cron / 사내 K8s CronJob | LiteLLM 자체 cron 없음 (검증). 사내 표준 패턴 (`ads-data-board-cd`) 동일. 외부 secret 관리 불필요. 단일 리플리카 가정에서 안전 |
| 5 | Lock / 영구 로그 없음 | `media.import_log` 테이블 + DB lock | 사용자 선호 (YAGNI). 충돌 시나리오는 매뉴얼 force 한 번으로 복구. 로그는 LiteLLM 런타임 로그로 충분 |
| 6 | Force 최대 31일 | 90일 (초기 제안) | Redash polling 부담 + 의도치 않은 큰 범위 보호 |
| 7 | Polling 2초 / 10분 (300회) | 레퍼런스 그대로 2초 / 3분 (90회) | 매체사 추가 시 쿼리 부담 증가 가능, 안전 마진 |
| 8 | Supabase: anon key + persistSession:false | service_role key | 레퍼런스 동일, RLS 통과 가능, service_role secret 추가 관리 불필요 |
| 9 | typo `servce_cv` → `service_cv` 한 번에 정리 | transitional (양쪽 alias 동시 지원) | 단순. 짧은 빈 시간은 운영적으로 짧게 관리 (Step 1 즉시 후 Step 4) |

---

## 12. 검증 체크리스트 (배포 후)

- [ ] `npm run build` 로컬 통과
- [ ] 로컬 standalone 짧게 띄워 `[daily-redash-import] registered` 로그 확인
- [ ] LiteLLM credential 등록 확인 (`GET /v1/code-deployments/.../credentials`)
- [ ] LiteLLM env_vars 갱신 확인 (`GET /v1/code-deployments/.../`)
- [ ] `git push origin main && git push deploy main` 양쪽 push
- [ ] `POST .../build` 빌드 트리거 → `build_status: succeeded`
- [ ] `GET /api/health` → `{"status":"ok"}`
- [ ] 런타임 로그: `[daily-redash-import] registered (0 6 * * * Asia/Seoul)`
- [ ] 모달 force range 1일 호출 → progress 정상, DB 반영 확인
- [ ] 다음 06:00 KST 이후 `[daily-redash-import] ok` 로그 확인
- [ ] `select max(date) from media.daily` → 어제 날짜
- [ ] `_docs/05-data-dailyimport.md` 신구조로 갱신 (별도 후속 작업)
