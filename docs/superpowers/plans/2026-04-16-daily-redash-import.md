# Daily Redash Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 매일 06:00 KST 에 server-side cron 이 Redash 11939 를 직접 호출해서 `media.daily` 를 자동 갱신하고, 모달의 보정용 import 도 같은 Redash 경로로 통일한다.

**Architecture:** Next.js `instrumentation.ts` 훅에 `node-cron` 등록 (in-process). 신규 모듈 디렉토리 `lib/features/daily-redash-import/` 안에 cron / job / redash-fetch / date-range / adapter 파일 분리. 모달은 `app/api/import/redash/route.ts` 의 NDJSON streaming 으로 같은 job 함수 호출. Supabase 는 cron / route 모두 cookie-free anon client 사용 (단일 권한 모델).

**Tech Stack:** Next.js 16.1.6 (App Router, standalone), TypeScript, node-cron 4.x, vitest 2.x, @supabase/supabase-js, Redash REST API.

**Spec:** [`docs/superpowers/specs/2026-04-16-daily-redash-import-design.md`](../specs/2026-04-16-daily-redash-import-design.md)

**Reference:** `~/dev/ads-data-board-cd/lib/features/daily-sync/` (동일 패턴 최초 도입)

---

## File Structure

**Create**
- `vitest.config.ts`
- `instrumentation.ts`
- `lib/features/daily-redash-import/cron.ts`
- `lib/features/daily-redash-import/job.ts`
- `lib/features/daily-redash-import/redash-fetch.ts`
- `lib/features/daily-redash-import/date-range.ts`
- `lib/features/daily-redash-import/adapter.ts`
- `lib/features/daily-redash-import/__tests__/date-range.test.ts`
- `lib/features/daily-redash-import/__tests__/adapter.test.ts`
- `lib/supabase/cron-client.ts`
- `app/api/import/redash/route.ts`

**Modify**
- `package.json` (vitest, node-cron 추가, test scripts)
- `lib/api/importDbOps.ts` (모든 함수 시그니처에 `supabase` 인자 추가)
- `lib/logic/importOrchestration.ts` (`importParsedRows()` entry 추가, `importCSVData()` 제거)
- `components/modals/ImportModal/ImportModal.tsx` (fetch URL 교체, NDJSON line reader)
- `lib/utils/csvParser.ts` (`parseCSV` / `parseCSVLine` / `parseNumber` / `parseString` 제거, `normalizeDate` 만 유지)

**Delete**
- `lib/api/importFetch.ts`

---

## Phase 1 — 인프라

### Task 1: Vitest 도입

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`

- [ ] **Step 1: 패키지 설치**

```bash
cd /Users/daiya/dev/media-board-cd
npm install --save-dev vitest @vitejs/plugin-react jsdom
```

- [ ] **Step 2: `package.json` scripts 추가**

`package.json` 의 `scripts` 객체에 추가:
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run",
    "test:watch": "vitest",
    "update-types": "npx supabase gen types typescript --project-id lmftwznuhgphousfojpb --schema media --schema shared > types/database.types.ts"
  }
}
```

- [ ] **Step 3: `vitest.config.ts` 작성**

`vitest.config.ts` 신규 파일:
```typescript
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "node",
    include: ["lib/**/__tests__/**/*.test.ts"],
    globals: false,
  },
});
```

- [ ] **Step 4: 동작 확인 (테스트 0건이라도 실행되는지)**

Run: `npm test`
Expected: vitest 가 실행되고 "No test files found, exiting with code 1" 또는 "Test Files 0 passed" 류 메시지. 에러 stack trace 없으면 OK.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.ts
git commit -m "chore: add vitest for unit tests"
```

---

### Task 2: node-cron 의존성 추가

**Files:**
- Modify: `package.json`

- [ ] **Step 1: 패키지 설치**

```bash
cd /Users/daiya/dev/media-board-cd
npm install node-cron
npm install --save-dev @types/node-cron
```

> note: node-cron v4+ 가 자체 타입을 포함하면 `@types/node-cron` 설치 시 "deprecated" 경고가 뜰 수 있음. 그 경우 `npm uninstall @types/node-cron` 후 진행.

- [ ] **Step 2: 설치 확인**

Run: `node -e "console.log(require('node-cron').schedule.toString().slice(0,40))"`
Expected: `function schedule` 으로 시작하는 문자열 출력.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add node-cron for in-process scheduling"
```

---

## Phase 2 — 순수 함수 (TDD)

### Task 3: `date-range.ts` (KST 범위 + gap recovery)

**Files:**
- Create: `lib/features/daily-redash-import/date-range.ts`
- Test: `lib/features/daily-redash-import/__tests__/date-range.test.ts`

- [ ] **Step 1: 디렉토리 생성**

```bash
mkdir -p lib/features/daily-redash-import/__tests__
```

- [ ] **Step 2: 실패하는 테스트 작성**

Create `lib/features/daily-redash-import/__tests__/date-range.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { computeSyncRange } from "../date-range";

describe("computeSyncRange", () => {
  // KST 2026-04-16 03:00 = UTC 2026-04-15 18:00
  const nowKst0316Utc = new Date("2026-04-15T18:00:00Z");

  it("incremental: latestDate null → 어제 하루치만", () => {
    const decision = computeSyncRange(null, nowKst0316Utc);
    expect(decision).toEqual({ skip: false, range: { start: "2026-04-15", end: "2026-04-15" } });
  });

  it("incremental: latestDate < D-1 → latestDate+1 ~ D-1 (gap recovery)", () => {
    const decision = computeSyncRange("2026-04-10", nowKst0316Utc);
    expect(decision).toEqual({ skip: false, range: { start: "2026-04-11", end: "2026-04-15" } });
  });

  it("incremental: latestDate === D-1 → skip", () => {
    const decision = computeSyncRange("2026-04-15", nowKst0316Utc);
    expect(decision.skip).toBe(true);
    expect(decision.skip && decision.reason).toContain("already up to date");
  });

  it("incremental: latestDate > D-1 (미래 데이터) → skip", () => {
    const decision = computeSyncRange("2026-04-16", nowKst0316Utc);
    expect(decision.skip).toBe(true);
  });

  it("force: 지정 범위 그대로 반환 (검증은 호출자)", () => {
    const decision = computeSyncRange("2026-04-10", nowKst0316Utc, {
      start: "2026-03-01",
      end: "2026-03-31",
    });
    expect(decision).toEqual({ skip: false, range: { start: "2026-03-01", end: "2026-03-31" } });
  });

  it("KST 경계: UTC 2026-04-16 14:59 (KST 23:59) → end = 2026-04-15", () => {
    const utc = new Date("2026-04-16T14:59:00Z");
    const decision = computeSyncRange(null, utc);
    expect(decision).toEqual({ skip: false, range: { start: "2026-04-15", end: "2026-04-15" } });
  });

  it("KST 경계: UTC 2026-04-16 15:00 (KST 다음날 00:00) → end = 2026-04-16", () => {
    const utc = new Date("2026-04-16T15:00:00Z");
    const decision = computeSyncRange(null, utc);
    expect(decision).toEqual({ skip: false, range: { start: "2026-04-16", end: "2026-04-16" } });
  });
});
```

- [ ] **Step 3: 테스트 실패 확인**

Run: `npm test -- date-range.test.ts`
Expected: FAIL — `Cannot find module '../date-range'` 또는 동일 의미의 에러.

- [ ] **Step 4: 구현 작성**

Create `lib/features/daily-redash-import/date-range.ts`:
```typescript
/**
 * 매일 자동 동기화 잡의 동기화 범위 계산 (순수 함수).
 *
 * 규칙:
 *  - end = KST 기준 D-1 (nowUtc + 9시간 한 날짜의 전날)
 *  - latestDateInDb >= end → skip
 *  - latestDateInDb null   → start = end (하루치만)
 *  - 그 외                 → start = latestDateInDb + 1일 (gap recovery)
 *  - forceRange 가 있으면 그대로 반환 (검증은 호출자 책임)
 *
 * KST 는 서머타임이 없으므로 UTC+9 단순 오프셋으로 처리.
 */

export interface SyncRange {
  /** YYYY-MM-DD inclusive */
  start: string;
  /** YYYY-MM-DD inclusive */
  end: string;
}

export type SyncDecision =
  | { skip: true; reason: string }
  | { skip: false; range: SyncRange };

/** UTC Date 를 KST 달력상의 YYYY-MM-DD 로 변환. */
function toKstDateString(utc: Date): string {
  const kstMs = utc.getTime() + 9 * 60 * 60 * 1000;
  const d = new Date(kstMs);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** YYYY-MM-DD 에 N일 더해 YYYY-MM-DD 반환. */
function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  const ny = dt.getUTCFullYear();
  const nm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const nd = String(dt.getUTCDate()).padStart(2, "0");
  return `${ny}-${nm}-${nd}`;
}

export function computeSyncRange(
  latestDateInDb: string | null,
  nowUtc: Date,
  forceRange?: SyncRange,
): SyncDecision {
  if (forceRange) {
    return { skip: false, range: forceRange };
  }

  const todayKst = toKstDateString(nowUtc);
  const end = addDays(todayKst, -1);

  if (latestDateInDb && latestDateInDb >= end) {
    return {
      skip: true,
      reason: `already up to date (latest=${latestDateInDb}, target=${end})`,
    };
  }

  const start = latestDateInDb ? addDays(latestDateInDb, 1) : end;
  return { skip: false, range: { start, end } };
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npm test -- date-range.test.ts`
Expected: PASS — 7개 테스트 전부 통과.

- [ ] **Step 6: Commit**

```bash
git add lib/features/daily-redash-import/date-range.ts \
        lib/features/daily-redash-import/__tests__/date-range.test.ts
git commit -m "feat(daily-redash-import): add date-range with gap recovery"
```

---

### Task 4: `adapter.ts` (Redash row → ParsedCSVRow)

**Files:**
- Create: `lib/features/daily-redash-import/adapter.ts`
- Test: `lib/features/daily-redash-import/__tests__/adapter.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

Create `lib/features/daily-redash-import/__tests__/adapter.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { redashRowToParsedCSVRow } from "../adapter";

describe("redashRowToParsedCSVRow", () => {
  it("BIGINT 가 number 로 들어와도 string 으로 변환된 client_id/service_id", () => {
    const row = {
      date: "2026-04-15",
      client_id: 5,
      client_name: "테스트클라",
      service_id: 100,
      service_name: "테스트서비스",
      widget_id: "W123",
      widget_name: "위젯A",
      cost_spent: 12345,
      pub_profit: 6789,
      imp: 100000,
      vimp: 80000,
      click: 234,
      service_cv: 12,
    };
    const parsed = redashRowToParsedCSVRow(row);
    expect(parsed).toEqual({
      date: "2026-04-15",
      client_id: "5",
      service_id: "100",
      service_name: "테스트서비스",
      widget_id: "W123",
      widget_name: "위젯A",
      cost_spent: 12345,
      pub_profit: 6789,
      imp: 100000,
      vimp: 80000,
      cnt_click: 234,
      cnt_cv: 12,
    });
  });

  it("string 숫자도 number 로 정규화", () => {
    const row = {
      date: "2026-04-15",
      client_id: "5",
      service_id: "100",
      service_name: "S",
      widget_id: "W",
      widget_name: "WN",
      cost_spent: "12345",
      pub_profit: "6789",
      imp: "100000",
      vimp: "80000",
      click: "234",
      service_cv: "12",
    };
    const parsed = redashRowToParsedCSVRow(row);
    expect(parsed.cost_spent).toBe(12345);
    expect(parsed.cnt_click).toBe(234);
    expect(parsed.cnt_cv).toBe(12);
  });

  it("null/undefined 숫자 필드 → 0", () => {
    const row = {
      date: "2026-04-15",
      client_id: 5,
      service_id: 100,
      service_name: "S",
      widget_id: "W",
      widget_name: "WN",
      cost_spent: null,
      pub_profit: undefined,
      imp: 0,
      vimp: 0,
      click: null,
      service_cv: null,
    };
    const parsed = redashRowToParsedCSVRow(row);
    expect(parsed.cost_spent).toBe(0);
    expect(parsed.pub_profit).toBe(0);
    expect(parsed.cnt_click).toBe(0);
    expect(parsed.cnt_cv).toBe(0);
  });

  it("client_name 은 매핑 대상 아님 (무시)", () => {
    const row = {
      date: "2026-04-15",
      client_id: 5,
      client_name: "이건 무시됨",
      service_id: 100,
      service_name: "S",
      widget_id: "W",
      widget_name: "WN",
      cost_spent: 0,
      pub_profit: 0,
      imp: 0,
      vimp: 0,
      click: 0,
      service_cv: 0,
    };
    const parsed = redashRowToParsedCSVRow(row);
    expect(parsed).not.toHaveProperty("client_name");
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- adapter.test.ts`
Expected: FAIL — `Cannot find module '../adapter'`.

- [ ] **Step 3: 구현 작성**

Create `lib/features/daily-redash-import/adapter.ts`:
```typescript
/**
 * Redash row (쿼리 11939 결과) → ParsedCSVRow 어댑터.
 *
 * Redash 쿼리의 SELECT alias 가 그대로 row key 가 된다:
 *   date, client_id, client_name, service_id, service_name,
 *   widget_id, widget_name, cost_spent, pub_profit, imp, vimp,
 *   click, service_cv
 *
 * client_name 은 무시 (현재 import 파이프라인에서 사용 안 함).
 * click → cnt_click, service_cv → cnt_cv 로 컬럼명 매핑.
 *
 * 숫자는 BIGINT (number) 또는 string 으로 들어올 수 있음 → number 로 정규화.
 */

import type { ParsedCSVRow } from "@/types/app-db.types";

export type RedashRow = Record<string, unknown>;

function toNumber(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return Number.isFinite(v) ? Math.round(v) : 0;
  if (typeof v === "string") {
    const cleaned = v.replace(/,/g, "").trim();
    const n = Number(cleaned);
    return Number.isFinite(n) ? Math.round(n) : 0;
  }
  return 0;
}

function toStringOrNull(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length > 0 ? s : null;
}

export function redashRowToParsedCSVRow(row: RedashRow): ParsedCSVRow {
  return {
    date: toStringOrNull(row.date),
    client_id: toStringOrNull(row.client_id),
    service_id: toStringOrNull(row.service_id),
    service_name: toStringOrNull(row.service_name),
    widget_id: toStringOrNull(row.widget_id),
    widget_name: toStringOrNull(row.widget_name),
    cost_spent: toNumber(row.cost_spent),
    pub_profit: toNumber(row.pub_profit),
    imp: toNumber(row.imp),
    vimp: toNumber(row.vimp),
    cnt_click: toNumber(row.click),
    cnt_cv: toNumber(row.service_cv),
  };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- adapter.test.ts`
Expected: PASS — 4개 테스트 전부 통과.

- [ ] **Step 5: Commit**

```bash
git add lib/features/daily-redash-import/adapter.ts \
        lib/features/daily-redash-import/__tests__/adapter.test.ts
git commit -m "feat(daily-redash-import): add Redash row adapter"
```

---

## Phase 3 — 외부 어댑터

### Task 5: `cron-client.ts` (cookie-free Supabase)

**Files:**
- Create: `lib/supabase/cron-client.ts`

- [ ] **Step 1: 파일 작성**

Create `lib/supabase/cron-client.ts`:
```typescript
/**
 * Cookie-free Supabase 클라이언트.
 *
 * `lib/supabase/media-client.ts` 의 createMediaClient() 는 next/headers 의 cookies()
 * 를 의존하므로 request scope 외부 (cron, server-side cron-trigger route) 에서 호출 불가.
 *
 * 이 파일은 vanilla `@supabase/supabase-js` 의 createClient 로 cookie 의존성 없이
 * media schema 에 접근할 수 있는 클라이언트를 만든다.
 *
 * 권한: anon key 사용. RLS 정책이 unauthenticated insert/update 를 허용해야 함
 * (현재 모달이 브라우저에서 동작하므로 이 조건은 충족된 상태).
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

export function createCronSupabase(): SupabaseClient<Database, "media"> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 환경변수가 설정되지 않았습니다.",
    );
  }
  return createClient<Database, "media">(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: "media" },
  });
}
```

- [ ] **Step 2: 빌드 통과 확인 (타입 검증)**

Run: `npx tsc --noEmit lib/supabase/cron-client.ts`
Expected: 에러 없이 통과 (또는 unrelated 에러만).

> note: tsconfig 가 isolated check 를 막으면 `npm run build` 의 type-check 단계로 대체. 그 경우 다음 task 와 함께 검증.

- [ ] **Step 3: Commit**

```bash
git add lib/supabase/cron-client.ts
git commit -m "feat(supabase): add cookie-free client for cron/server-route use"
```

---

### Task 6: `redash-fetch.ts` (POST + Polling)

**Files:**
- Create: `lib/features/daily-redash-import/redash-fetch.ts`

- [ ] **Step 1: 파일 작성**

Create `lib/features/daily-redash-import/redash-fetch.ts`:
```typescript
/**
 * Redash 쿼리 11939 실행 공용 모듈 (수동 / 자동 공용).
 *
 * - 자동: lib/features/daily-redash-import/job.ts 가 매일 cron 에서 호출
 * - 수동: app/api/import/redash/route.ts 가 모달 호출을 중계
 *
 * REDASH_API_KEY 환경변수 필수 (server-only). 쿼리 결과가 캐시에 없으면
 * 2초 간격으로 최대 300회(10분) 폴링.
 *
 * Redash POST /api/queries/{id}/results 응답:
 *   - 캐시 hit: { query_result: {...} } → 즉시 반환
 *   - 새 실행:  { job: { id, status } } → polling
 */

import type { RedashRow } from "./adapter";

const REDASH_BASE_URL = "https://redash.dable.io";
const REDASH_QUERY_ID = 11939;
const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 300; // 2초 × 300 = 10분

interface RedashJobResponse {
  job: {
    id: string;
    status: number; // 1=pending, 2=started, 3=success, 4=failure, 5=cancelled
    error?: string;
    query_result_id?: number;
  };
}

interface RedashResultResponse {
  query_result: {
    data: {
      rows: RedashRow[];
    };
  };
}

function redashHeaders(): HeadersInit {
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
      headers: redashHeaders(),
    });
    if (!res.ok) {
      throw new Error(`Job 상태 조회 실패: HTTP ${res.status}`);
    }

    const data = (await res.json()) as RedashJobResponse;
    const { status, error, query_result_id } = data.job;

    if (status === 3 && query_result_id) return query_result_id;
    if (status === 4) {
      throw new Error(`쿼리 실행 실패: ${error ?? "알 수 없는 오류"} (job=${jobId})`);
    }
    if (status === 5) {
      throw new Error(`쿼리 실행 취소됨 (job=${jobId})`);
    }
  }
  throw new Error(`쿼리 실행 시간 초과 (10분, job=${jobId})`);
}

async function fetchQueryResult(queryResultId: number): Promise<RedashRow[]> {
  const res = await fetch(
    `${REDASH_BASE_URL}/api/query_results/${queryResultId}`,
    { headers: redashHeaders() },
  );
  if (!res.ok) {
    throw new Error(`결과 조회 실패: HTTP ${res.status}`);
  }
  const data = (await res.json()) as RedashResultResponse;
  return data.query_result.data.rows;
}

export interface FetchOptions {
  startDate: string;       // YYYY-MM-DD inclusive
  endDate: string;         // YYYY-MM-DD inclusive
  clientIds: string[];     // ['5','10','14',...]
}

/**
 * Redash 쿼리 11939 를 지정 파라미터로 실행하고 행 배열 반환.
 *
 * 쿼리의 WHERE 절은 inclusive end 를 가정하지 않고 `< {{ date.end }}` 로 작성되어 있으므로
 * endDate 의 다음 날을 보내야 endDate 데이터가 포함된다 — 이 함수에서 보정한다.
 */
export async function fetchRedashRecords(
  opts: FetchOptions,
): Promise<RedashRow[]> {
  const { startDate, endDate, clientIds } = opts;

  if (clientIds.length === 0) {
    throw new Error("clientIds 가 비어 있습니다.");
  }

  // 쿼리의 WHERE: local_basic_time < {{ date.end }} → endDate 포함하려면 +1일 보정
  const dateEndExclusive = addOneDay(endDate);

  const executeRes = await fetch(
    `${REDASH_BASE_URL}/api/queries/${REDASH_QUERY_ID}/results`,
    {
      method: "POST",
      headers: redashHeaders(),
      body: JSON.stringify({
        parameters: {
          "date.start": startDate,
          "date.end": dateEndExclusive,
          client_id: clientIds.join(","),
        },
        max_age: 0,
      }),
    },
  );

  if (!executeRes.ok) {
    if (executeRes.status === 401 || executeRes.status === 403) {
      throw new Error("Redash 인증 실패 — REDASH_API_KEY 확인");
    }
    throw new Error(`Redash 요청 실패: HTTP ${executeRes.status}`);
  }

  const executeData = (await executeRes.json()) as
    | RedashResultResponse
    | RedashJobResponse;

  if ("query_result" in executeData) {
    return executeData.query_result.data.rows;
  }
  if ("job" in executeData) {
    const queryResultId = await pollJob(executeData.job.id);
    return fetchQueryResult(queryResultId);
  }
  throw new Error("예상치 못한 Redash 응답 형식");
}

function addOneDay(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + 1);
  const ny = dt.getUTCFullYear();
  const nm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const nd = String(dt.getUTCDate()).padStart(2, "0");
  return `${ny}-${nm}-${nd}`;
}
```

- [ ] **Step 2: 타입 검증**

Run: `npx tsc --noEmit` (전체)
Expected: redash-fetch 관련 에러 없음.

- [ ] **Step 3: Commit**

```bash
git add lib/features/daily-redash-import/redash-fetch.ts
git commit -m "feat(daily-redash-import): add Redash POST + polling fetcher"
```

---

## Phase 4 — 기존 코드 변경

### Task 7: `importDbOps.ts` — supabase 인자 받기

**Files:**
- Modify: `lib/api/importDbOps.ts`

- [ ] **Step 1: 함수 시그니처 변경**

`lib/api/importDbOps.ts` 파일을 다음으로 교체 (전체 파일):
```typescript
/**
 * Import DB operations — simple CRUD queries for CSV/Redash data import.
 *
 * 모든 함수가 `supabase` 인자를 받는다 — 호출자가 적절한 클라이언트(브라우저/cron)를 주입.
 * 기존에는 내부에서 createMediaClient() 를 호출했으나, cron 에서도 호출 가능하도록 변경.
 */

import { WIDGET_BATCH_SIZE } from "@/lib/config";
import type { ParsedCSVRow } from "@/types/app-db.types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

type MediaClient = SupabaseClient<Database, "media">;

// ---------------------------------------------------------------------------
// DB — last imported date
// ---------------------------------------------------------------------------

export async function getLastImportedDate(supabase: MediaClient): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from("daily")
      .select("date")
      .order("date", { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw error;
    }
    return (data?.date as string) ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// DB — force-update delete
// ---------------------------------------------------------------------------

export async function deleteDataByDateRange(
  supabase: MediaClient,
  startDate: string,
  endDate: string,
): Promise<{ deleted: number; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from("daily")
      .delete()
      .gte("date", startDate)
      .lte("date", endDate)
      .select("date");

    if (error) throw error;
    return { deleted: data?.length ?? 0, error: null };
  } catch (err) {
    console.error("데이터 삭제 오류:", err);
    return { deleted: 0, error: err as Error };
  }
}

// ---------------------------------------------------------------------------
// DB — whitelist validation (client only)
// ---------------------------------------------------------------------------

export async function fetchRegisteredClientIds(
  supabase: MediaClient,
  clientIds: string[],
): Promise<{ validClientIds: Set<string>; clientNameMap: Map<string, string> }> {
  const validClientIds = new Set<string>();
  const clientNameMap = new Map<string, string>();

  for (let i = 0; i < clientIds.length; i += WIDGET_BATCH_SIZE) {
    const batch = clientIds.slice(i, i + WIDGET_BATCH_SIZE);
    const { data, error } = await supabase
      .from("client")
      .select("client_id, client_name")
      .in("client_id", batch);

    if (error) throw error;
    if (data) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const row of data as any[]) {
        validClientIds.add(row.client_id);
        if (row.client_name) clientNameMap.set(row.client_id, row.client_name);
      }
    }
  }

  return { validClientIds, clientNameMap };
}

/** media.client 테이블의 모든 client_id 를 반환 (cron 에서 화이트리스트 빌드용). */
export async function fetchAllClientIds(supabase: MediaClient): Promise<string[]> {
  const ids: string[] = [];
  let from = 0;
  const PAGE = 1000;
  for (;;) {
    const { data, error } = await supabase
      .from("client")
      .select("client_id")
      .range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const row of data as any[]) ids.push(row.client_id);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return ids;
}

// ---------------------------------------------------------------------------
// DB — failed rows
// ---------------------------------------------------------------------------

export async function saveFailedRows(
  supabase: MediaClient,
  failedRows: Array<{
    row: ParsedCSVRow;
    normalizedDate: string;
    errorMessage: string;
  }>,
): Promise<void> {
  if (failedRows.length === 0) return;

  try {
    const insertData = failedRows.map(({ row, normalizedDate, errorMessage }) => ({
      date: normalizedDate || null,
      client_id: row.client_id,
      service_id: row.service_id,
      widget_id: row.widget_id ?? null,
      widget_name: row.widget_name ?? null,
      cost_spent: row.cost_spent || 0,
      pub_profit: row.pub_profit || 0,
      imp: row.imp || 0,
      vimp: row.vimp || 0,
      cnt_click: row.cnt_click || 0,
      cnt_cv: row.cnt_cv || 0,
      error_message: errorMessage,
    }));

    const { error } = await supabase.from("daily_failed").insert(insertData);
    if (error) console.error("실패 행 저장 오류:", error);
  } catch (err) {
    console.error("실패 행 저장 중 오류:", err);
  }
}

// ---------------------------------------------------------------------------
// refreshDailyViews
// ---------------------------------------------------------------------------

export async function refreshDailyViews(supabase: MediaClient): Promise<void> {
  const { error } = await supabase.rpc("refresh_daily_views");
  if (error) throw error;
}
```

- [ ] **Step 2: 호출자 영향 점검**

Run: `npx tsc --noEmit`
Expected: importDbOps 의 호출자(주로 importOrchestration.ts) 에서 시그니처 mismatch 에러 — 다음 task 에서 수정. 다른 호출자가 있는지 확인:

Run: `grep -RnE "getLastImportedDate|deleteDataByDateRange|fetchRegisteredClientIds|saveFailedRows|refreshDailyViews" --include='*.ts' --include='*.tsx' lib/ app/ components/ hooks/ stores/`

Expected: importOrchestration.ts, ImportModal/ImportModal.tsx (`getLastImportedDate` 만) 에서 사용. 두 호출자 모두 다음 task 들에서 수정.

- [ ] **Step 3: Commit (broken state — 다음 task 에서 호출자 수정)**

```bash
git add lib/api/importDbOps.ts
git commit -m "refactor(import): inject supabase client into importDbOps fns"
```

---

### Task 8: `importOrchestration.ts` — `importParsedRows()` entry 추가

**Files:**
- Modify: `lib/logic/importOrchestration.ts`

- [ ] **Step 1: 파일 변경**

`lib/logic/importOrchestration.ts` 의 다음 부분만 변경:

A) **상단 import 변경** (기존 파일 라인 14~36 근처):
```typescript
// 기존: import { parseCSV, normalizeDate } from "@/lib/utils/csvParser";
// 신규: parseCSV 제거, normalizeDate 만 유지
import { normalizeDate } from "@/lib/utils/csvParser";
import { IMPORT_BATCH_DELAY_MS, IMPORT_BATCH_THRESHOLDS } from "@/lib/config";
import { addDays } from "@/lib/utils/date-utils";
import type {
  ParsedCSVRow,
  ImportResult,
  ImportProgress,
} from "@/types/app-db.types";
import {
  getLastImportedDate,
  deleteDataByDateRange,
  fetchRegisteredClientIds,
  saveFailedRows,
  refreshDailyViews,
} from "@/lib/api/importDbOps";
import {
  scanMissingServices,
  scanMissingWidgets,
  registerMissingServices,
  registerMissingWidgets,
} from "@/lib/api/importEntityService";
import { type ValidatedRow, validateRow } from "./importValidation";
import { importBatch } from "@/lib/api/importBatchService";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

type MediaClient = SupabaseClient<Database, "media">;
```

B) **`importCSVData` 시그니처 변경** → **`importParsedRows`** 로 이름 변경 + `csvText` 입력을 `rows: ParsedCSVRow[]` 입력으로 교체:

기존 `export async function importCSVData(options: ImportCSVDataOptions): Promise<ImportResult> {` 부터 함수 끝까지를 다음으로 교체:

```typescript
export interface ImportParsedRowsOptions {
  rows: ParsedCSVRow[];
  supabase: MediaClient;
  forceDateRange?: { startDate: string; endDate: string } | null;
  lastDateHint?: string | null;
  batchSize?: number;
  onProgress?: (p: ImportProgress) => void;
  onCancel?: () => boolean;
}

/**
 * 이미 파싱된 ParsedCSVRow[] 를 검증·dedup·entity 등록·배치 upsert 한다.
 *
 * 호출자:
 *  - app/api/import/redash/route.ts (모달, NDJSON streaming)
 *  - lib/features/daily-redash-import/job.ts (cron)
 *
 * 두 호출자 모두 supabase 클라이언트를 주입한다 (cookie-free anon client).
 */
export async function importParsedRows(
  options: ImportParsedRowsOptions,
): Promise<ImportResult> {
  const { rows, supabase, onProgress, onCancel, batchSize, forceDateRange, lastDateHint } =
    options;

  const result: ImportResult = {
    success: true,
    totalRows: rows.length,
    imported: 0,
    failed: 0,
    skipped: 0,
    servicesCreated: 0,
    widgetsCreated: 0,
    dateStart: null,
    dateEnd: null,
    errors: [],
    newServiceLogs: [],
    newWidgetLogs: [],
    failedDetails: [],
  };

  const failedRowsForSave: Array<{
    row: ParsedCSVRow;
    normalizedDate: string;
    errorMessage: string;
  }> = [];

  let dataDateStart: string | null = null;
  let dataDateEnd: string | null = null;

  try {
    const dynamicBatchSize = batchSize ?? calculateBatchSize(rows.length);

    if (rows.length === 0) return result;

    let targetStartDate: string | null = null;
    let targetEndDate: string | null = null;

    if (forceDateRange) {
      targetStartDate = forceDateRange.startDate;
      targetEndDate = forceDateRange.endDate;
      const { error: deleteError } = await deleteDataByDateRange(
        supabase,
        targetStartDate,
        targetEndDate,
      );
      if (deleteError) console.error("강제 업데이트 삭제 오류:", deleteError);
    } else {
      const lastDate =
        lastDateHint !== undefined ? lastDateHint : await getLastImportedDate(supabase);
      targetStartDate = lastDate ? addDays(lastDate, 1) : null;
    }

    let isCancelled = false;
    const validatedRows: ValidatedRow[] = [];

    for (let i = rows.length - 1; i >= 0; i--) {
      if (onCancel?.()) {
        isCancelled = true;
        break;
      }

      const row = rows[i];
      const validation = validateRow(row, i);

      if (!validation.valid) {
        if (validation.skip) result.skipped++;
        else {
          result.failed++;
          result.errors.push({ row: i + 1, message: validation.errorMessage });
        }
        continue;
      }

      const nd = normalizeDate(row.date!);
      if (!nd) {
        result.failed++;
        continue;
      }

      if (forceDateRange) {
        if (nd < targetStartDate! || nd > targetEndDate!) continue;
      } else {
        if (targetStartDate && nd < targetStartDate) break;
      }

      validatedRows.push({ row, index: i, normalizedDate: nd });
      if (!dataDateStart || nd < dataDateStart) dataDateStart = nd;
      if (!dataDateEnd || nd > dataDateEnd) dataDateEnd = nd;
    }

    if (isCancelled) {
      result.cancelled = true;
      result.dateStart = dataDateStart;
      result.dateEnd = dataDateEnd;
      return result;
    }

    // PK dedup
    const pkSeen = new Set<string>();
    const uniqueRows: ValidatedRow[] = [];
    for (const vr of validatedRows) {
      const pk = `${vr.normalizedDate}|${vr.row.client_id}|${vr.row.service_id}|${vr.row.widget_id}`;
      if (!pkSeen.has(pk)) {
        pkSeen.add(pk);
        uniqueRows.push(vr);
      }
    }
    const finalRows = uniqueRows;

    let acceptedRows: ValidatedRow[] = [];
    let clientNameMap = new Map<string, string>();
    if (finalRows.length > 0) {
      const uniqueClientIds = [...new Set(finalRows.map((r) => r.row.client_id!))];
      const scanRows = finalRows.map(({ row, normalizedDate }) => ({ row, normalizedDate }));

      const [{ validClientIds, clientNameMap: nameMap }, serviceScan, widgetScan] =
        await Promise.all([
          fetchRegisteredClientIds(supabase, uniqueClientIds),
          scanMissingServices(scanRows),
          scanMissingWidgets(scanRows),
        ]);
      clientNameMap = nameMap;

      const filtered: ValidatedRow[] = [];
      for (const vr of finalRows) {
        const cid = vr.row.client_id!;
        if (!validClientIds.has(cid)) {
          result.failed++;
          const errorMsg = `미등록 client_id: ${cid}`;
          failedRowsForSave.push({
            row: vr.row,
            normalizedDate: vr.normalizedDate,
            errorMessage: errorMsg,
          });
          result.failedDetails.push({
            date: vr.normalizedDate,
            client_id: cid,
            client_name: null,
            service_id: vr.row.service_id,
            service_name: vr.row.service_name ?? null,
            widget_id: vr.row.widget_id ?? null,
            widget_name: vr.row.widget_name ?? null,
            reason: errorMsg,
          });
        } else {
          filtered.push(vr);
        }
      }
      acceptedRows = filtered;

      if (acceptedRows.length > 0) {
        const acceptedServiceIds = new Set(
          acceptedRows.map((r) => r.row.service_id!).filter(Boolean),
        );
        const missingServiceIds = serviceScan.missingIds.filter((id) =>
          acceptedServiceIds.has(id),
        );
        const serviceResult = await registerMissingServices(
          serviceScan.serviceInfoMap,
          missingServiceIds,
          clientNameMap,
        );
        result.servicesCreated = serviceResult.created;
        result.newServiceLogs = serviceResult.newRows;
        serviceResult.errors.forEach((err) => result.errors.push({ row: 0, message: err }));

        const acceptedWidgetIds = new Set(
          acceptedRows
            .map((r) => r.row.widget_id)
            .filter((id): id is string => Boolean(id)),
        );
        const missingWidgetIds = widgetScan.missingIds.filter((id) =>
          acceptedWidgetIds.has(id),
        );
        const widgetResult = await registerMissingWidgets(
          widgetScan.widgetInfoMap,
          missingWidgetIds,
          clientNameMap,
        );
        result.widgetsCreated = widgetResult.created;
        result.newWidgetLogs = widgetResult.newRows;
        widgetResult.errors.forEach((err) => result.errors.push({ row: 0, message: err }));
      }
    }

    for (let i = 0; i < acceptedRows.length; i += dynamicBatchSize) {
      if (onCancel?.()) {
        isCancelled = true;
        break;
      }

      const batch = acceptedRows.slice(i, i + dynamicBatchSize);
      const batchResult = await importBatch(batch);

      result.imported += batchResult.success;
      result.failed += batchResult.failed;

      for (const err of batchResult.errors) {
        const vr = batch[err.index];
        if (!vr) {
          result.errors.push({ row: i + err.index + 1, message: err.message });
          continue;
        }
        result.errors.push({ row: vr.index + 1, message: err.message });
        if (vr.row.widget_id) {
          failedRowsForSave.push({
            row: vr.row,
            normalizedDate: vr.normalizedDate,
            errorMessage: err.message,
          });
          result.failedDetails.push({
            date: vr.normalizedDate,
            client_id: vr.row.client_id,
            client_name: vr.row.client_id
              ? (clientNameMap.get(vr.row.client_id) ?? null)
              : null,
            service_id: vr.row.service_id,
            service_name: vr.row.service_name ?? null,
            widget_id: vr.row.widget_id,
            widget_name: vr.row.widget_name ?? null,
            reason: err.message,
          });
        }
      }

      onProgress?.({
        total: acceptedRows.length,
        processed: Math.min(i + dynamicBatchSize, acceptedRows.length),
        success: result.imported,
        failed: result.failed,
        skipped: result.skipped,
        servicesCreated: result.servicesCreated,
        widgetsCreated: result.widgetsCreated,
        currentDate: batch[batch.length - 1]?.normalizedDate ?? null,
      });

      if (i + dynamicBatchSize < acceptedRows.length)
        await delay(IMPORT_BATCH_DELAY_MS);
    }

    if (failedRowsForSave.length > 0) await saveFailedRows(supabase, failedRowsForSave);

    if (isCancelled) result.cancelled = true;

    if (!isCancelled && result.imported > 0) {
      await Promise.race([
        refreshDailyViews(supabase),
        new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error("refresh_daily_views timeout")), 30_000),
        ),
      ]).catch((err) => {
        console.warn("[import] refresh_daily_views failed (non-fatal):", err);
      });
    }

    result.dateStart = dataDateStart;
    result.dateEnd = dataDateEnd;
    return result;
  } catch (err) {
    result.success = false;
    const errorMessage = err instanceof Error ? err.message : String(err);
    result.errors.push({ row: 0, message: `전체 import 오류: ${errorMessage}` });
    result.dateStart = dataDateStart;
    result.dateEnd = dataDateEnd;
    return result;
  }
}
```

- [ ] **Step 2: 기존 ImportCSVDataOptions 타입 제거**

`@/types/app-db.types` 의 `ImportCSVDataOptions` 가 다른 곳에서 import 되는지 확인:
Run: `grep -rn "ImportCSVDataOptions" --include='*.ts' --include='*.tsx' .`
Expected: 다른 사용처 없으면 다음 task (csvParser 정리) 와 함께 정리.

- [ ] **Step 3: 빌드 검증**

Run: `npm run build`
Expected: ImportModal 의 `importCSVData` 호출에서 에러 — 다음 task (server route + 모달) 에서 해결될 예정. 다른 에러는 없어야 함.

- [ ] **Step 4: Commit (broken state)**

```bash
git add lib/logic/importOrchestration.ts
git commit -m "refactor(import): replace importCSVData with importParsedRows entry"
```

---

## Phase 5 — 신규 오케스트레이션

### Task 9: `job.ts` (오케스트레이션)

**Files:**
- Create: `lib/features/daily-redash-import/job.ts`

- [ ] **Step 1: 파일 작성**

Create `lib/features/daily-redash-import/job.ts`:
```typescript
/**
 * Daily Redash import 잡 오케스트레이션.
 *
 * 호출자:
 *  - cron.ts (자동, 매일 06:00 KST)
 *  - app/api/import/redash/route.ts (모달, 보정용)
 *
 * 흐름:
 *   1. cookie-free supabase 클라이언트 생성
 *   2. (incremental) latest date 조회 → date-range 결정 (gap recovery)
 *      (force) 호출자가 준 range 그대로
 *   3. media.client 에서 client_id 화이트리스트 동적 조회
 *   4. Redash POST + Polling
 *   5. adapter 로 ParsedCSVRow[] 변환
 *   6. importParsedRows() 호출 (검증 / dedup / entity 등록 / 배치 upsert / view refresh)
 */

import { createCronSupabase } from "@/lib/supabase/cron-client";
import {
  getLastImportedDate,
  fetchAllClientIds,
} from "@/lib/api/importDbOps";
import { importParsedRows } from "@/lib/logic/importOrchestration";
import { computeSyncRange, type SyncRange } from "./date-range";
import { fetchRedashRecords } from "./redash-fetch";
import { redashRowToParsedCSVRow } from "./adapter";
import type { ImportProgress } from "@/types/app-db.types";

export type ImportMode = "incremental" | "force";

export interface RunImportOptions {
  mode: ImportMode;
  /** mode === 'force' 일 때 필수. inclusive YYYY-MM-DD. */
  range?: SyncRange;
  /** 모달의 progress UI 용. cron 은 생략. */
  onProgress?: (p: ImportProgress) => void;
  /** cancel 폴링. cron 은 생략. */
  onCancel?: () => boolean;
}

export interface JobResult {
  skipped: boolean;
  reason?: string;
  range?: SyncRange;
  redashRows?: number;
  importedRows?: number;
  failedRows?: number;
  servicesCreated?: number;
  widgetsCreated?: number;
  durationMs: number;
}

export async function runDailyImportJob(opts: RunImportOptions): Promise<JobResult> {
  const t0 = Date.now();
  const supabase = createCronSupabase();

  // 1. 범위 결정
  const latestDate =
    opts.mode === "incremental" ? await getLastImportedDate(supabase) : null;
  const decision = computeSyncRange(latestDate, new Date(), opts.range);
  if (decision.skip) {
    return {
      skipped: true,
      reason: decision.reason,
      durationMs: Date.now() - t0,
    };
  }

  const { start, end } = decision.range;

  // 2. client_id 화이트리스트
  const clientIds = await fetchAllClientIds(supabase);
  if (clientIds.length === 0) {
    return {
      skipped: true,
      reason: "media.client 에 등록된 client 가 없습니다",
      range: decision.range,
      durationMs: Date.now() - t0,
    };
  }

  // 3. Redash fetch
  const redashRows = await fetchRedashRecords({
    startDate: start,
    endDate: end,
    clientIds,
  });

  if (redashRows.length === 0) {
    return {
      skipped: false,
      range: decision.range,
      redashRows: 0,
      importedRows: 0,
      failedRows: 0,
      servicesCreated: 0,
      widgetsCreated: 0,
      durationMs: Date.now() - t0,
    };
  }

  // 4. Adapter
  const parsedRows = redashRows.map(redashRowToParsedCSVRow);

  // 5. Import
  const result = await importParsedRows({
    rows: parsedRows,
    supabase,
    forceDateRange:
      opts.mode === "force"
        ? { startDate: start, endDate: end }
        : null,
    lastDateHint: latestDate,
    onProgress: opts.onProgress,
    onCancel: opts.onCancel,
  });

  return {
    skipped: false,
    range: decision.range,
    redashRows: redashRows.length,
    importedRows: result.imported,
    failedRows: result.failed,
    servicesCreated: result.servicesCreated,
    widgetsCreated: result.widgetsCreated,
    durationMs: Date.now() - t0,
  };
}
```

- [ ] **Step 2: 타입 검증**

Run: `npx tsc --noEmit`
Expected: job.ts 관련 에러 없음. ImportModal 에러는 아직 남음 (다음 task 들에서 해결).

- [ ] **Step 3: Commit**

```bash
git add lib/features/daily-redash-import/job.ts
git commit -m "feat(daily-redash-import): add job orchestration"
```

---

### Task 10: `cron.ts` (node-cron 등록)

**Files:**
- Create: `lib/features/daily-redash-import/cron.ts`

- [ ] **Step 1: 파일 작성**

Create `lib/features/daily-redash-import/cron.ts`:
```typescript
/**
 * Daily Redash import 의 node-cron 스케줄러 등록.
 *
 * - 매일 06:00 KST 에 runDailyImportJob({ mode: 'incremental' }) 실행
 * - 예외는 전부 catch 해 로깅만 — 다음 날 재시도 (gap recovery 가 보충)
 * - registerDailyImportCron() 은 여러 번 호출되어도 1회만 등록 (dev hot-reload 대비)
 *
 * 단일 리플리카 (replicas: 1, hpa_enabled: false) 가정. HPA 활성 시 인스턴스마다
 * 중복 실행되므로 lock 도입 필요.
 */

import cron from "node-cron";
import { runDailyImportJob } from "./job";

let registered = false;

export function registerDailyImportCron(): void {
  if (registered) return;
  registered = true;

  cron.schedule(
    "0 6 * * *",
    async () => {
      const t0 = Date.now();
      try {
        const result = await runDailyImportJob({ mode: "incremental" });
        console.log("[daily-redash-import] ok", {
          ...result,
          durationMs: Date.now() - t0,
        });
      } catch (err) {
        console.error("[daily-redash-import] failed", {
          error: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined,
          durationMs: Date.now() - t0,
        });
      }
    },
    { timezone: "Asia/Seoul" },
  );

  console.log("[daily-redash-import] registered (0 6 * * * Asia/Seoul)");
}
```

- [ ] **Step 2: 타입 검증**

Run: `npx tsc --noEmit`
Expected: 에러 없음 (전체 빌드는 ImportModal 변경 후).

- [ ] **Step 3: Commit**

```bash
git add lib/features/daily-redash-import/cron.ts
git commit -m "feat(daily-redash-import): add node-cron scheduler"
```

---

### Task 11: `instrumentation.ts` (Next.js 부팅 훅)

**Files:**
- Create: `instrumentation.ts`

- [ ] **Step 1: 파일 작성**

Create `instrumentation.ts` (프로젝트 루트):
```typescript
/**
 * Next.js 서버 부팅 훅.
 * Pod 가 시작될 때 node-cron 으로 daily Redash import 타이머를 등록한다.
 *
 * 가드:
 *  - NEXT_RUNTIME === 'nodejs' 가 아니면 무시 (Edge / 클라이언트 번들 오염 방지)
 *  - cron.ts 자체 registered 플래그로 중복 등록 방지
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { registerDailyImportCron } = await import(
    "./lib/features/daily-redash-import/cron"
  );
  registerDailyImportCron();
}
```

- [ ] **Step 2: Next.js 가 instrumentation 을 감지하는지 확인**

`next.config.ts` 를 열어 `experimental.instrumentationHook` 설정이 필요한지 확인.

> note: Next.js 15+ 부터 `instrumentation.ts` 는 자동 감지됨 (별도 설정 불필요). 현재 프로젝트는 16.1.6 — 설정 불필요.

- [ ] **Step 3: Commit**

```bash
git add instrumentation.ts
git commit -m "feat(instrumentation): register daily Redash import cron on boot"
```

---

## Phase 6 — Server Route

### Task 12: `app/api/import/redash/route.ts` (NDJSON streaming)

**Files:**
- Create: `app/api/import/redash/route.ts`

- [ ] **Step 1: 디렉토리 + 파일 작성**

```bash
mkdir -p app/api/import/redash
```

Create `app/api/import/redash/route.ts`:
```typescript
/**
 * Daily Redash import 모달 entry.
 *
 * 인증: Supabase SSR client + 세션 cookie. 미인증 → 401.
 * 데이터 upsert: cron-client (anon, persistSession:false). 권한 게이트 두 겹.
 * 응답: NDJSON streaming (Transfer-Encoding: chunked).
 *   - { type: 'phase', phase, message? }
 *   - { type: 'progress', ...ImportProgress }
 *   - { type: 'result', ...ImportResult-ish }
 *   - { type: 'error', message, jobId? }
 */

import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runDailyImportJob, type RunImportOptions } from "@/lib/features/daily-redash-import/job";
import type { ImportProgress } from "@/types/app-db.types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FORCE_RANGE_DAYS = 31;

interface ModalRequest {
  mode: "incremental" | "force";
  startDate?: string;
  endDate?: string;
}

function isYmd(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function daysBetween(start: string, end: string): number {
  const [sy, sm, sd] = start.split("-").map(Number);
  const [ey, em, ed] = end.split("-").map(Number);
  const sUtc = Date.UTC(sy, sm - 1, sd);
  const eUtc = Date.UTC(ey, em - 1, ed);
  return Math.round((eUtc - sUtc) / 86400000);
}

function todayKst(): string {
  const utc = new Date();
  const kst = new Date(utc.getTime() + 9 * 60 * 60 * 1000);
  return `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(2, "0")}-${String(kst.getUTCDate()).padStart(2, "0")}`;
}

export async function POST(req: NextRequest): Promise<Response> {
  // 1. 인증 (세션만 확인, 데이터 작업에는 사용 안 함)
  const authClient = await createClient();
  const { data: { user }, error: authErr } = await authClient.auth.getUser();
  if (authErr || !user) {
    return new Response("Unauthorized", { status: 401 });
  }

  // 2. body 파싱·검증
  let body: ModalRequest;
  try {
    body = (await req.json()) as ModalRequest;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  if (body.mode !== "incremental" && body.mode !== "force") {
    return new Response(JSON.stringify({ error: "mode 는 'incremental' 또는 'force'" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  let runOpts: RunImportOptions;
  if (body.mode === "force") {
    if (!isYmd(body.startDate) || !isYmd(body.endDate)) {
      return new Response(
        JSON.stringify({ error: "force 모드는 startDate/endDate (YYYY-MM-DD) 필수" }),
        { status: 400, headers: { "content-type": "application/json" } },
      );
    }
    if (body.startDate > body.endDate) {
      return new Response(
        JSON.stringify({ error: "startDate 가 endDate 보다 큽니다" }),
        { status: 400, headers: { "content-type": "application/json" } },
      );
    }
    if (body.endDate > todayKst()) {
      return new Response(
        JSON.stringify({ error: "endDate 가 오늘보다 미래입니다" }),
        { status: 400, headers: { "content-type": "application/json" } },
      );
    }
    if (daysBetween(body.startDate, body.endDate) >= MAX_FORCE_RANGE_DAYS) {
      return new Response(
        JSON.stringify({ error: `force 범위는 ${MAX_FORCE_RANGE_DAYS}일 이하만 허용` }),
        { status: 400, headers: { "content-type": "application/json" } },
      );
    }
    runOpts = {
      mode: "force",
      range: { start: body.startDate, end: body.endDate },
    };
  } else {
    runOpts = { mode: "incremental" };
  }

  // 3. NDJSON streaming
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const writeLine = (obj: unknown) =>
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));

      try {
        writeLine({ type: "phase", phase: "fetch_redash" });

        const result = await runDailyImportJob({
          ...runOpts,
          onProgress: (p: ImportProgress) => {
            writeLine({ type: "progress", ...p });
          },
        });

        writeLine({ type: "result", ...result });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const jobIdMatch = /job=([a-zA-Z0-9-]+)/.exec(message);
        writeLine({
          type: "error",
          message,
          ...(jobIdMatch ? { jobId: jobIdMatch[1] } : {}),
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "content-type": "application/x-ndjson",
      "cache-control": "no-store",
    },
  });
}
```

- [ ] **Step 2: 빌드 검증**

Run: `npm run build`
Expected: ImportModal 에서 deprecated `fetchCSVFromGoogleSheets` / `importCSVData` 호출 에러 — 다음 task 에서 해결. route 자체 에러 없어야 함.

- [ ] **Step 3: Commit**

```bash
git add app/api/import/redash/route.ts
git commit -m "feat(api): add /api/import/redash NDJSON route"
```

---

## Phase 7 — 모달 변경

### Task 13: `ImportModal.tsx` — fetch URL 교체 + NDJSON reader

**Files:**
- Modify: `components/modals/ImportModal/ImportModal.tsx`

- [ ] **Step 1: import 라인 정리**

`components/modals/ImportModal/ImportModal.tsx` 의 상단 import 변경:

기존 (라인 7~12 근처):
```typescript
import { IMPORT_CSV_URL } from "@/lib/config";
import { fetchCSVFromGoogleSheets } from "@/lib/api/importFetch";
import { getLastImportedDate } from "@/lib/api/importDbOps";
import { getLastCvrImportedDate } from "@/lib/api/cvrImportDbOps";
import { importCSVData } from "@/lib/logic/importOrchestration";
import { importCvrData } from "@/lib/logic/cvrImportOrchestration";
```

신규:
```typescript
import { createMediaClient } from "@/lib/supabase/media-client";
import { getLastImportedDate } from "@/lib/api/importDbOps";
import { getLastCvrImportedDate } from "@/lib/api/cvrImportDbOps";
import { importCvrData } from "@/lib/logic/cvrImportOrchestration";
```

(`IMPORT_CSV_URL`, `fetchCSVFromGoogleSheets`, `importCSVData` 모두 제거)

- [ ] **Step 2: `getLastImportedDate` 호출 시 supabase 주입**

`useEffect` 안의 호출 (라인 106 근처):

기존:
```typescript
getLastImportedDate()
  .then(setLastDate)
```

신규:
```typescript
getLastImportedDate(createMediaClient())
  .then(setLastDate)
```

> note: `createMediaClient()` 는 기존 모달이 다른 곳에서도 쓰던 browser-side helper (`lib/supabase/media-client.ts`). 반환 타입이 `any` 이므로 `MediaClient` 시그니처에 그대로 들어간다. 모달의 lastDate 조회는 read-only 라 권한 모델 분리(spec §5.7) 와 무관 — browser session 쪽 client 사용 OK.

- [ ] **Step 3: `handleDataConfirm` 교체**

기존 `handleDataConfirm` 함수 전체를 다음으로 교체:

```typescript
const handleDataConfirm = async () => {
  if (isForceUpdate) {
    if (!forceStartDate || !forceEndDate) {
      setValidationError("시작일과 종료일을 모두 선택해주세요.");
      return;
    }
    if (forceStartDate > forceEndDate) {
      setValidationError("시작일은 종료일보다 앞이어야 합니다.");
      return;
    }
  }

  isCancelRef.current = false;
  setProgress(INITIAL_PROGRESS);
  setStep("progress");

  try {
    const reqBody = isForceUpdate
      ? { mode: "force", startDate: forceStartDate, endDate: forceEndDate }
      : { mode: "incremental" };

    const res = await fetch("/api/import/redash", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(reqBody),
    });

    if (!res.ok) {
      const text = await res.text();
      setErrorMessage(text || `HTTP ${res.status}`);
      setResultType("error");
      setStep("result");
      return;
    }
    if (!res.body) {
      setErrorMessage("응답 본문이 비어 있습니다.");
      setResultType("error");
      setStep("result");
      return;
    }

    // NDJSON 라인 단위 파싱
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let finalResult: ImportResult | null = null;
    let finalError: { message: string; jobId?: string } | null = null;

    while (true) {
      if (isCancelRef.current) {
        await reader.cancel();
        break;
      }
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? ""; // 마지막 한 줄은 미완성 가능

      for (const line of lines) {
        if (!line.trim()) continue;
        let evt: { type: string } & Record<string, unknown>;
        try {
          evt = JSON.parse(line);
        } catch {
          continue; // 잘못된 라인 무시
        }
        if (evt.type === "progress") {
          // ImportProgress 형식 그대로
          const { type: _t, ...progressFields } = evt;
          setProgress(progressFields as unknown as ImportProgress);
        } else if (evt.type === "result") {
          const { type: _t, ...resultFields } = evt;
          finalResult = resultFields as unknown as ImportResult;
        } else if (evt.type === "error") {
          finalError = {
            message: String(evt.message ?? "알 수 없는 오류"),
            jobId: typeof evt.jobId === "string" ? evt.jobId : undefined,
          };
        }
        // phase 이벤트는 현재 UI 에 영향 없음 (필요 시 phase 별 메시지 추가)
      }
    }

    if (isCancelRef.current) {
      setResultType("cancelled");
      setStep("result");
      return;
    }
    if (finalError) {
      const msg = finalError.jobId
        ? `${finalError.message} (job: ${finalError.jobId})`
        : finalError.message;
      setErrorMessage(msg);
      setResultType("error");
      setStep("result");
      return;
    }
    if (finalResult) {
      setResult(finalResult);
      setResultType(finalResult.success ? "completed" : "error");
      if (!finalResult.success) {
        setErrorMessage(
          finalResult.errors.map((e) => e.message).join("\n") ||
            "알 수 없는 오류가 발생했습니다.",
        );
      }
      setStep("result");
      return;
    }
    // result/error 둘 다 못 받음
    setErrorMessage("스트림이 결과 없이 종료되었습니다.");
    setResultType("error");
    setStep("result");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    setErrorMessage(msg);
    setResultType("error");
    setStep("result");
  }
};
```

- [ ] **Step 4: 빌드 검증**

Run: `npm run build`
Expected: ImportModal 관련 에러 없음. csvParser / importFetch 가 아직 남아 있어 unused import 경고가 있을 수 있음 — 다음 task 에서 정리.

- [ ] **Step 5: Commit**

```bash
git add components/modals/ImportModal/ImportModal.tsx
git commit -m "feat(modal): wire ImportModal to /api/import/redash NDJSON"
```

---

## Phase 8 — Cleanup

### Task 14: `csvParser.ts` 정리 — `normalizeDate` 만 유지

**Files:**
- Modify: `lib/utils/csvParser.ts`

- [ ] **Step 1: 사용처 점검**

Run: `grep -rn "from \"@/lib/utils/csvParser\"\\|from '@/lib/utils/csvParser'" --include='*.ts' --include='*.tsx' .`
Expected: `lib/logic/importOrchestration.ts` (normalizeDate 만), `lib/utils/cvrCsvParser.ts` (확인 필요), 다른 곳.

`parseCSV` / `parseCSVLine` / `parseNumber` / `parseString` 사용처:
Run: `grep -rn "parseCSV\\b\\|parseCSVLine\\|parseNumber\\b\\|parseString\\b" --include='*.ts' --include='*.tsx' lib/ app/ components/`
Expected: csvParser.ts 자체 외 사용처 없으면 안전하게 제거 가능. 만약 cvrCsvParser 가 의존하면 cvrCsvParser 는 그대로 두고 csvParser 만 정리.

- [ ] **Step 2: 파일 교체**

`lib/utils/csvParser.ts` 의 모든 내용을 다음으로 교체:
```typescript
/**
 * CSV-related utilities — 현재는 날짜 정규화만 사용.
 *
 * 과거에는 Google Sheets CSV 파싱(parseCSV) 도 함께 제공했으나
 * Redash 직접 호출 경로로 통일되며 제거됨. 자세한 이력:
 * docs/superpowers/specs/2026-04-16-daily-redash-import-design.md
 */

/**
 * 다양한 형식의 날짜 문자열을 YYYY-MM-DD 로 정규화.
 * 지원: YYYY-MM-DD, YYYY/MM/DD, YYYY.MM.DD, Date-parseable 문자열.
 * 실패 시 null.
 */
export function normalizeDate(dateStr: string | null): string | null {
  if (!dateStr) return null;

  const cleaned = dateStr.trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return cleaned;
  if (/^\d{4}\/\d{2}\/\d{2}$/.test(cleaned)) return cleaned.replace(/\//g, "-");
  if (/^\d{4}\.\d{2}\.\d{2}$/.test(cleaned)) return cleaned.replace(/\./g, "-");

  const date = new Date(cleaned);
  if (!isNaN(date.getTime())) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  return null;
}
```

- [ ] **Step 3: 빌드 검증**

Run: `npm run build`
Expected: 에러 없음. (만약 cvrCsvParser 가 csvParser 의 parseCSVLine 등을 import 하면 그 부분은 cvrCsvParser 안에 inline 또는 별도 utils 로 옮겨야 함 — 발생 시에만 처리)

- [ ] **Step 4: Commit**

```bash
git add lib/utils/csvParser.ts
git commit -m "chore(csvParser): drop CSV parsing fns — Redash path only"
```

---

### Task 15: `lib/api/importFetch.ts` 제거

**Files:**
- Delete: `lib/api/importFetch.ts`

- [ ] **Step 1: 사용처 0건 확인**

Run: `grep -rn "from \"@/lib/api/importFetch\"\\|from '@/lib/api/importFetch'\\|fetchCSVFromGoogleSheets" --include='*.ts' --include='*.tsx' .`
Expected: 0건 (Task 13 에서 ImportModal 의 import 제거됨).

- [ ] **Step 2: 파일 삭제**

```bash
rm lib/api/importFetch.ts
```

- [ ] **Step 3: 빌드 검증**

Run: `npm run build`
Expected: 에러 없음.

- [ ] **Step 4: Commit**

```bash
git add -A lib/api/importFetch.ts
git commit -m "chore: remove obsolete Google Sheets fetch module"
```

---

## Phase 9 — 검증 & 배포

### Task 16: 로컬 빌드 + standalone 검증

**Files:** (없음)

- [ ] **Step 1: 전체 테스트 실행**

Run: `npm test`
Expected: date-range / adapter 테스트 모두 PASS.

- [ ] **Step 2: 빌드**

Run: `npm run build`
Expected: 에러 없이 완료. `.next/standalone/` 디렉토리 생성됨.

- [ ] **Step 3: standalone 짧게 띄워 cron 등록 확인**

```bash
# 환경변수 임시 export (.env.local 가 있으면 자동 로드)
export NEXT_PUBLIC_SUPABASE_URL="https://lmftwznuhgphousfojpb.supabase.co"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="<anon key>"
export REDASH_API_KEY="sHNrVjaLUl9ykzGG5mtBP7xuWYjymYCzac8abL76"

# 8초간 standalone 실행 (cron 등록 로그가 부팅 직후 찍힘)
timeout 8 node .next/standalone/server.js 2>&1 | tee /tmp/standalone.log
```

Expected: log 안에 다음 라인이 보임:
```
[daily-redash-import] registered (0 6 * * * Asia/Seoul)
```

- [ ] **Step 4: (옵션) 모달 흐름 smoke test**

로컬 dev 서버에서 수동 테스트:
```bash
npm run dev
# 브라우저에서 http://localhost:3000/dashboard 접속, ImportModal 열어서
# force range 1일 (어제) 선택 → Confirm 클릭
# Network 탭에서 /api/import/redash 요청 확인 (NDJSON, 200)
# Progress UI 정상 갱신 확인
# Result step 에 imported 행 수 확인
```

(옵션이지만 강력 권장 — 배포 전 회귀 잡기)

- [ ] **Step 5: Commit (없음)**

이 task 는 verification only. commit 없음.

---

### Task 17: Redash 쿼리 11939 typo 수정

**Files:** (외부 — redash.dable.io)

- [ ] **Step 1: redash.dable.io 접속**

브라우저에서 https://redash.dable.io/queries/11939/source 접속 (운영자 계정).

- [ ] **Step 2: SELECT 절 마지막 alias 변경**

기존:
```sql
CAST(COALESCE(conv.total_conversion, 0) AS BIGINT) AS servce_cv
```

신규:
```sql
CAST(COALESCE(conv.total_conversion, 0) AS BIGINT) AS service_cv
```

- [ ] **Step 3: Save → Execute (1회 실행)**

쿼리를 저장하고 작은 범위 (예: 어제 하루) 로 실행. 결과 컬럼 헤더가 `service_cv` 로 바뀌었는지 확인.

- [ ] **Step 4: 변경 이력 메모**

이 작업은 git 추적 불가 (Redash 외부). 다음 PR 에 변경 사항을 cherry pick 하지 않도록 spec 의 의사결정 기록 (#9) 에 이미 명시됨.

---

### Task 18: LiteLLM credential / env_vars 갱신

**Files:** (외부 — LiteLLM API)

- [ ] **Step 1: 현재 credential binding 확인**

```bash
curl -s "https://litellm.internal.dable.io/v1/code-deployments/9605fb4a-80be-4c1a-b5f7-49d572b2f42a/credentials" \
  -H "Authorization: Bearer $LITELLM_PAT" | python3 -m json.tool
```

기존 credential 이름과 값 확인 (보통 `media-board-secrets`).

- [ ] **Step 2: Credential DELETE → POST**

```bash
# DELETE
curl -X DELETE "https://litellm.internal.dable.io/credentials/media-board-secrets" \
  -H "Authorization: Bearer $LITELLM_PAT"

# POST 전량 재생성 (REDASH_API_KEY 추가, 기존 값들도 함께)
curl -X POST "https://litellm.internal.dable.io/credentials" \
  -H "Authorization: Bearer $LITELLM_PAT" \
  -H "Content-Type: application/json" \
  -d '{
    "credential_name": "media-board-secrets",
    "credential_values": {
      "NEXT_PUBLIC_SUPABASE_ANON_KEY": "<Step 1에서 확보한 값>",
      "KLMEDIA_API_KEY": "<Step 1에서 확보한 값>",
      "REDASH_API_KEY": "sHNrVjaLUl9ykzGG5mtBP7xuWYjymYCzac8abL76"
    },
    "owner_type": "code_deployment",
    "owner_id": "9605fb4a-80be-4c1a-b5f7-49d572b2f42a"
  }'
```

Expected: `200 OK` 응답 with credential ID.

- [ ] **Step 3: env_vars PATCH (NEXT_PUBLIC_IMPORT_CSV_URL 제거)**

```bash
curl -X PATCH "https://litellm.internal.dable.io/v1/code-deployments/9605fb4a-80be-4c1a-b5f7-49d572b2f42a" \
  -H "Authorization: Bearer $LITELLM_PAT" \
  -H "Content-Type: application/json" \
  -d '{
    "env_vars": {
      "NEXT_PUBLIC_SUPABASE_URL": "https://lmftwznuhgphousfojpb.supabase.co",
      "NEXT_PUBLIC_IMPORT_CVR_CSV_URL": "<기존값 — CVR 별도 작업 시까지 유지>",
      "THREEDPOP_COMPANY_CODE": "C000002063"
    }
  }'
```

Expected: `200 OK`.

- [ ] **Step 4: 검증**

```bash
curl -s "https://litellm.internal.dable.io/v1/code-deployments/9605fb4a-80be-4c1a-b5f7-49d572b2f42a" \
  -H "Authorization: Bearer $LITELLM_PAT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(json.dumps(d.get('env_vars',{}), indent=2))"
```
Expected: `NEXT_PUBLIC_IMPORT_CSV_URL` 없음. 나머지 키 정상.

```bash
curl -s "https://litellm.internal.dable.io/v1/code-deployments/9605fb4a-80be-4c1a-b5f7-49d572b2f42a/credentials" \
  -H "Authorization: Bearer $LITELLM_PAT"
```
Expected: `REDASH_API_KEY` 가 binding 목록에 보임.

---

### Task 19: 배포 (양쪽 push + build)

**Files:** (외부 — git remotes + LiteLLM API)

- [ ] **Step 1: 로컬 main 브랜치 정리 확인**

```bash
git status
git log --oneline -20
```
Expected: clean working tree, Task 1~15 의 커밋들이 보임.

- [ ] **Step 2: 양쪽 remote push**

```bash
git push origin main
git push deploy main
```
Expected: 양쪽 모두 정상 push.

- [ ] **Step 3: 빌드 트리거**

```bash
curl -X POST "https://litellm.internal.dable.io/v1/code-deployments/9605fb4a-80be-4c1a-b5f7-49d572b2f42a/build" \
  -H "Authorization: Bearer $LITELLM_PAT"
```
Expected: 빌드 작업 ID 반환 (200).

- [ ] **Step 4: 빌드 상태 폴링**

```bash
while true; do
  status=$(curl -s "https://litellm.internal.dable.io/v1/code-deployments/9605fb4a-80be-4c1a-b5f7-49d572b2f42a" \
    -H "Authorization: Bearer $LITELLM_PAT" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('build_status'),d.get('deploy_status'))")
  echo "$(date +%H:%M:%S) $status"
  case "$status" in
    "succeeded running") echo "DONE"; break ;;
    "failed"*) echo "BUILD FAILED"; break ;;
  esac
  sleep 10
done
```
Expected: 결국 `succeeded running` 출력.

- [ ] **Step 5: 빌드 실패 시 로그 확인**

```bash
curl -s "https://litellm.internal.dable.io/v1/code-deployments/9605fb4a-80be-4c1a-b5f7-49d572b2f42a/logs" \
  -H "Authorization: Bearer $LITELLM_PAT" | python3 -c "import sys,json;print(json.load(sys.stdin).get('build_log',''))" | tail -100
```
실패 원인 확인 → 코드 수정 → 다시 push → build 트리거 반복.

---

### Task 20: 배포 후 검증

**Files:** (외부 — 배포 환경)

- [ ] **Step 1: Health check**

```bash
curl -s https://media-board.dllm.dable.io/api/health
```
Expected: `{"status":"ok"}`

- [ ] **Step 2: cron 등록 로그 확인**

```bash
curl -s "https://litellm.internal.dable.io/v1/code-deployments/9605fb4a-80be-4c1a-b5f7-49d572b2f42a/logs?type=runtime" \
  -H "Authorization: Bearer $LITELLM_PAT" | python3 -c "import sys,json;print(json.load(sys.stdin).get('runtime_log',''))" | grep "daily-redash-import"
```
Expected: `[daily-redash-import] registered (0 6 * * * Asia/Seoul)` 한 줄 이상.

- [ ] **Step 3: 모달 force smoke test**

브라우저에서 https://media-board.dllm.dable.io/ 접속 (Google SSO 로그인) → ImportModal 열기 → force range 어제 1일 선택 → Confirm.

확인:
- Network 탭: `/api/import/redash` 요청, status 200, content-type `application/x-ndjson`
- Progress UI 갱신 (total/processed/success/failed)
- Result step 에 imported 행 수 표시
- 런타임 로그에 force 호출 흔적 (cron 로그는 안 찍히고 모달은 console.log 없음 — Network 탭만 확인하면 됨)

- [ ] **Step 4: DB 갱신 확인**

Supabase SQL Editor 또는 dashboard 의 Data Board 에서:
```sql
SELECT date, count(*) FROM media.daily
WHERE date >= current_date - interval '3 days'
GROUP BY date ORDER BY date DESC;
```
Expected: 어제 날짜의 row count 가 정상 (수만 행).

- [ ] **Step 5: 다음 06:00 KST 이후 cron 자동 실행 확인**

다음 날 06:00 KST 이후 (또는 적절한 시점에):

```bash
curl -s "https://litellm.internal.dable.io/v1/code-deployments/9605fb4a-80be-4c1a-b5f7-49d572b2f42a/logs?type=runtime" \
  -H "Authorization: Bearer $LITELLM_PAT" | python3 -c "import sys,json;print(json.load(sys.stdin).get('runtime_log',''))" | grep "\\[daily-redash-import\\]" | tail -20
```
Expected:
- `[daily-redash-import] registered (0 6 * * * Asia/Seoul)` (부팅 시 1회)
- `[daily-redash-import] ok { skipped: false, ... }` 또는 `{ skipped: true, reason: 'already up to date...' }` (06:00 실행)

```sql
SELECT max(date) FROM media.daily;
```
Expected: 어제 날짜.

- [ ] **Step 6: 마무리 commit (있다면)**

배포 과정에서 발견된 사소한 수정이 있다면 별도 commit. 없으면 skip.

---

## 최종 체크

- [ ] **Step 1: 전체 spec 요구사항 충족 확인**

spec 의 Section 11 의사결정 기록 #1~#9 가 모두 코드에 반영되었는지 확인:
- #1 source: Redash → ✅ Task 6
- #2 POST + Polling → ✅ Task 6
- #3 모달도 Redash 통일 → ✅ Task 12, 13
- #4 in-process node-cron → ✅ Task 10, 11
- #5 lock / 영구 로그 없음 → ✅ (의도적 미구현)
- #6 force 31일 제한 → ✅ Task 12 (`MAX_FORCE_RANGE_DAYS`)
- #7 polling 2초 / 10분 → ✅ Task 6 (`POLL_INTERVAL_MS`, `MAX_POLL_ATTEMPTS`)
- #8 anon key + persistSession:false → ✅ Task 5
- #9 typo 한 번에 정리 → ✅ Task 17, 4 (adapter 가 `service_cv` 만 인식)

- [ ] **Step 2: spec 의 검증 체크리스트 (Section 12) 완료 확인**

spec 마지막 체크리스트의 12개 항목이 모두 ✓ 인지 확인.

- [ ] **Step 3: `_docs/05-data-dailyimport.md` 갱신 (별도 후속 작업)**

기존 문서가 Google Sheets / csvParser 흐름을 기준으로 작성되어 있으므로, 신구조 (Redash + cron + adapter) 로 갱신 필요. 본 plan 의 범위 외 — 별도 PR.

---

## 알려진 위험 / 후속 작업

- **Redash 쿼리 수정과 코드 배포 사이 빈 시간**: Step 17 → Step 19 사이에 모달 호출 시 `cnt_cv` 가 0 으로 들어감. 빠르게 진행하면 수 분 이내. 우려되면 Task 17 을 Task 19 직전으로 이동.
- **HPA 활성화 위험**: 현재 `replicas: 1`, `hpa_enabled: false` — 변경되면 cron 중복. 활성화 검토 시 lock 도입 (advisory lock 권장).
- **Gap recovery 거대 범위**: 누락이 수 주일 경우 Redash polling 10분 timeout 가능. 발생 시 force 작은 범위로 보정. 추후 max-range 가드 검토.
- **CVR 흐름 별도 작업**: `NEXT_PUBLIC_IMPORT_CVR_CSV_URL` 과 `lib/api/cvrImportDbOps.ts`, `lib/logic/cvrImportOrchestration.ts`, `lib/utils/cvrCsvParser.ts` 는 그대로 유지. 같은 패턴 (`lib/features/daily-cvr-import/`?) 으로 별도 작업.
