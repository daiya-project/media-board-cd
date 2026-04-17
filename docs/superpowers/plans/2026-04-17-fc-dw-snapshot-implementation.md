# FC DW Snapshot 자동화 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `fc-value-sync` cron 이 매일 `mysql_reco_re.dable.{WIDGET, WIDGET_SETTING}` 에서 FC(Flooring CPM) 값을 snapshot 해 `media.external_value` 에 append-only 이력으로 기록하도록, `fetchDwFcMap` prefetch 단계를 신설하고 `fetchDwSnapshot` 의 fc 하드코딩을 제거한다.

**Architecture:** A2 (widget 루프 전 FC 전용 1회 Trino 쿼리로 prefetch → 메모리 `Map<widget_id, fc>` 로 주입) + F1 (prefetch 실패 시 fail-open, S/T 는 계속 수집) + C1 (WIDGET_SETTING override > WIDGET.default_settings JSON 2-tier, `SERVICE_SETTING` fallback 은 제외). Supabase 스키마 변경 없음.

**Tech Stack:** TypeScript (Next.js 16 node runtime), Vitest, Redash EDA Trino(data_source_id=307), Supabase(postgres-js cron client), `dable-query` / `~/.claude/rules/deploy-llm-schedule.md` 패턴.

**Spec:** `docs/superpowers/specs/2026-04-17-fc-dw-snapshot-design.md`

---

## File Structure

| 파일 | 변경 종류 | 책임 |
|---|---|---|
| `lib/features/fc-value-sync/redash-fetch.ts` | Modify | `fetchDwFcMap` 신설 (§4.1). `fetchDwSnapshot` 의 SnapshotRow/SQL/후처리에서 `fc` 컬럼 제거 (§4.2). |
| `lib/features/fc-value-sync/job.ts` | Modify | widget 루프 전 `fetchDwFcMap` prefetch + fail-open 핸들링, widget 루프 내부에서 `snap.fc` 메모리 주입. `SyncResult` 에 `fcPrefetched`/`fcResolved` 필드 추가 (§4.3). |
| `lib/features/fc-value-sync/__tests__/redash-fetch.test.ts` | Modify | 기존 `fetchDwSnapshot` 테스트에서 fc 단언 제거 + mock 응답에서 fc 제거. `fetchDwFcMap` 신규 describe 블록 추가 (가드·정상·null·누락 케이스). |
| `lib/features/fc-value-sync/__tests__/job.test.ts` | **Create** | `runFcValueSyncJob` 통합 테스트 (prefetch 성공/실패/widget 누락). Supabase client 와 `redash-fetch` 를 vi.mock. |

`diff.ts` 는 기존 "undefined=skip" 거동을 활용하므로 **수정 없음**.

---

## Task 1: `fetchDwFcMap` — 가드 + 빈 배열 단락

**목적:** widget_id 정규식 검증 (SQL injection 방어), `widgetIds=[]` 시 Trino 호출 생략. 이 두 가드가 먼저 있어야 이후 정상 경로 테스트에서 fetch mock 이 의도대로 호출된다.

**Files:**
- Modify: `lib/features/fc-value-sync/redash-fetch.ts` (파일 하단에 새 섹션 추가)
- Modify: `lib/features/fc-value-sync/__tests__/redash-fetch.test.ts` (파일 하단에 새 describe 블록 추가)

- [ ] **Step 1: 실패 테스트 작성 — 빈 배열 + 정규식 위반**

기존 테스트 파일 하단에 다음 블록 append. `fetchDwFcMap` 은 아직 export 되지 않아 타입 에러 + 런타임 에러 모두 발생할 것이다.

```typescript
// __tests__/redash-fetch.test.ts 하단에 추가

import { fetchDwFcMap } from "../redash-fetch";

describe("fetchDwFcMap — 가드", () => {
  it("widgetIds=[] 시 Trino 호출 없이 빈 Map 반환", async () => {
    const mockFetch = vi.fn();
    __setFetchForTesting(mockFetch as typeof fetch);

    const result = await fetchDwFcMap({ widgetIds: [], apiKey: "test-key" });

    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(0);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("widget_id 가 [A-Za-z0-9_-]{1,32} 를 벗어나면 throw + fetch 호출 없음", async () => {
    const mockFetch = vi.fn();
    __setFetchForTesting(mockFetch as typeof fetch);

    await expect(
      fetchDwFcMap({ widgetIds: ["'; DROP TABLE"], apiKey: "test-key" }),
    ).rejects.toThrow(/Invalid widget_id/);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
```

상단 import 에 `fetchDwFcMap` 을 추가하는 것이 더 깔끔하다:

```typescript
import {
  fetchDwFcMap,
  fetchDwFcMetrics,
  fetchDwSnapshot,
  __setFetchForTesting,
} from "../redash-fetch";
```

(파일 하단의 중복 import 는 제거)

- [ ] **Step 2: 테스트 실행해 실패 확인**

```
npx vitest run lib/features/fc-value-sync/__tests__/redash-fetch.test.ts
```

기대: `fetchDwFcMap is not a function` 또는 TS 에러로 전체 FAIL.

- [ ] **Step 3: 최소 구현 — 가드만**

`lib/features/fc-value-sync/redash-fetch.ts` 맨 아래 (기존 `fetchDwSnapshot` 정의 다음) 에 추가:

```typescript
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
  // TODO Task 2: Trino 호출 및 응답 파싱
  return new Map();
}
```

- [ ] **Step 4: 테스트 재실행해 pass 확인**

```
npx vitest run lib/features/fc-value-sync/__tests__/redash-fetch.test.ts -t "fetchDwFcMap — 가드"
```

기대: 2/2 PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/features/fc-value-sync/redash-fetch.ts lib/features/fc-value-sync/__tests__/redash-fetch.test.ts
git commit -m "$(cat <<'EOF'
feat(fc-value-sync): fetchDwFcMap 가드 + 빈 배열 단락

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `fetchDwFcMap` — 정상 경로 (SQL 조립 + 응답 파싱)

**목적:** Trino 호출 시 COALESCE 우선순위를 DB 단에서 적용한 SQL 을 조립하고, 응답 rows 를 `Map<widget_id, fc>` 로 변환한다.

**Files:**
- Modify: `lib/features/fc-value-sync/redash-fetch.ts`
- Modify: `lib/features/fc-value-sync/__tests__/redash-fetch.test.ts`

- [ ] **Step 1: 실패 테스트 작성 — 3 케이스 추가**

`fetchDwFcMap — 가드` describe 블록 아래에 append:

```typescript
describe("fetchDwFcMap — 정상 경로", () => {
  it("Redash 결과를 Map<widget_id, fc> 로 변환", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        query_result: {
          data: {
            rows: [
              { widget_id: "A", fc: 230 },
              { widget_id: "B", fc: 500 },
            ],
          },
        },
      }),
    });
    __setFetchForTesting(mockFetch as typeof fetch);

    const result = await fetchDwFcMap({
      widgetIds: ["A", "B"],
      apiKey: "test-key",
    });
    expect(result.size).toBe(2);
    expect(result.get("A")).toBe(230);
    expect(result.get("B")).toBe(500);
  });

  it("DW 에 widget row 가 없으면 Map 에 key 없음", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        query_result: { data: { rows: [{ widget_id: "A", fc: 230 }] } },
      }),
    });
    __setFetchForTesting(mockFetch as typeof fetch);

    const result = await fetchDwFcMap({
      widgetIds: ["A", "MISSING"],
      apiKey: "test-key",
    });
    expect(result.has("A")).toBe(true);
    expect(result.has("MISSING")).toBe(false);
  });

  it("fc 가 null 이면 Map 에 key 있지만 value=null", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        query_result: { data: { rows: [{ widget_id: "A", fc: null }] } },
      }),
    });
    __setFetchForTesting(mockFetch as typeof fetch);

    const result = await fetchDwFcMap({ widgetIds: ["A"], apiKey: "test-key" });
    expect(result.has("A")).toBe(true);
    expect(result.get("A")).toBeNull();
  });

  it("data_source_id=307 + mysql_reco_re.dable.WIDGET 포함 SQL 로 POST", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ query_result: { data: { rows: [] } } }),
    });
    __setFetchForTesting(mockFetch as typeof fetch);

    await fetchDwFcMap({ widgetIds: ["A"], apiKey: "test-key" });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/query_results");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body as string) as {
      query: string;
      data_source_id: number;
    };
    expect(body.data_source_id).toBe(307);
    expect(body.query).toContain("mysql_reco_re.dable.WIDGET");
    expect(body.query).toContain("ad_low_rpm_passback");
  });
});
```

- [ ] **Step 2: 테스트 실행해 실패 확인**

```
npx vitest run lib/features/fc-value-sync/__tests__/redash-fetch.test.ts -t "fetchDwFcMap — 정상 경로"
```

기대: 현재 `fetchDwFcMap` 이 빈 Map 만 반환하므로 4 테스트 FAIL.

- [ ] **Step 3: 구현 — SQL 조립 + 파싱**

`fetchDwFcMap` 본문의 `// TODO Task 2` 부분을 다음으로 대체:

```typescript
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
```

- [ ] **Step 4: 테스트 재실행해 전체 pass 확인**

```
npx vitest run lib/features/fc-value-sync/__tests__/redash-fetch.test.ts -t "fetchDwFcMap"
```

기대: 가드 2 + 정상 경로 4 = 6/6 PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/features/fc-value-sync/redash-fetch.ts lib/features/fc-value-sync/__tests__/redash-fetch.test.ts
git commit -m "$(cat <<'EOF'
feat(fc-value-sync): fetchDwFcMap 정상 경로 구현 (COALESCE 2-tier)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `fetchDwSnapshot` 의 fc 컬럼 제거

**목적:** snapshot SQL·SnapshotRow·result 매핑에서 fc 관련 요소를 모두 제거. fc 는 이후 호출부에서 메모리 주입된다.

**Files:**
- Modify: `lib/features/fc-value-sync/redash-fetch.ts:283-347`
- Modify: `lib/features/fc-value-sync/__tests__/redash-fetch.test.ts:93-144` (기존 `fetchDwSnapshot` 테스트)

- [ ] **Step 1: 기존 테스트 수정 (실패 상태로)**

`__tests__/redash-fetch.test.ts` 의 "S/T/FC 합성" 테스트에서 mock 응답과 단언을 수정:

```typescript
// 첫 번째 케이스: rows 의 fc 필드 제거, expect 에서도 fc 제거
  it("S internal / T per-vendor 를 UnitPriceValue 로 합성", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        query_result: {
          data: {
            rows: [
              {
                internal_cpm: 1300,
                vendor_2_cpm: 1200,
                vendor_4_cpm: 300,
                vendor_5_cpm: null,
              },
            ],
          },
        },
      }),
    });
    __setFetchForTesting(mockFetch as typeof fetch);

    const snap = await fetchDwSnapshot({
      widgetId: "V7a1pGx7",
      date: "2026-04-15",
      apiKey: "test-key",
    });
    expect(snap).toEqual({
      internal: 1300,
      syncmedia: 1200,
      klmedia: 300,
    });
  });
```

describe 타이틀도 `"fetchDwSnapshot — cron 용 S/T 조회"` 로 변경.

두 번째 "빈 rows → 빈 객체" 테스트는 변경 없음.

- [ ] **Step 2: 테스트 실행해 실패 확인**

```
npx vitest run lib/features/fc-value-sync/__tests__/redash-fetch.test.ts -t "fetchDwSnapshot"
```

기대: 1 케이스 FAIL — `snap.fc` 가 여전히 `undefined` 가 아니라... 실제로는 현재 SQL 이 fc 를 NULL 로 반환하지만 `r.fc != null` 가드라 result 에 fc 가 안 들어간다. 그래서 현실적으론 PASS 할 수도 있음. 그럼에도 결과 객체에서 fc key 자체가 없어야 하는 새 규약 확인.

현재 상태에서는 PASS 하더라도, Step 3 의 SnapshotRow 타입 수정에서 컴파일 에러가 발생할 것이므로 TDD 사이클은 Step 3 에서 실패하는 형태로 정렬된다.

- [ ] **Step 3: `fetchDwSnapshot` 에서 fc 제거**

`lib/features/fc-value-sync/redash-fetch.ts` 수정:

```typescript
// SnapshotRow 에서 fc 필드 제거
interface SnapshotRow {
  internal_cpm: number | null;
  vendor_2_cpm: number | null;
  vendor_4_cpm: number | null;
  vendor_5_cpm: number | null;
}

// SQL 마지막 컬럼 CAST(NULL AS integer) AS fc 라인과 그 주석 3줄 삭제:
//   SELECT
//     (... internal_cpm ...)     AS internal_cpm,
//     (... vendor_2_cpm ...)     AS vendor_2_cpm,
//     (... vendor_4_cpm ...)     AS vendor_4_cpm,
//     (... vendor_5_cpm ...)     AS vendor_5_cpm
//   (← 세미콜론/쉼표 없이 여기서 종료)
//
// 주석 추가 1줄:
//   -- fc 는 fetchDwFcMap 으로 prefetch, 호출부에서 메모리 주입

// 결과 매핑 마지막 라인 삭제:
//   if (r.fc != null) result.fc = Number(r.fc);
```

구체적으로 기존 SQL 끝 부분:

```typescript
         AND vendor_id = 5) AS vendor_5_cpm,
      -- FC 는 dable.WIDGET (MySQL) default_settings JSON 에서 오는 값.
      -- Redash EDA Trino catalog 에는 현재 노출 안 됨 → NULL fallback.
      -- Task 5 에서 data-gateway 또는 별도 소스로 보강 예정.
      CAST(NULL AS integer) AS fc
  `;
```

→

```typescript
         AND vendor_id = 5) AS vendor_5_cpm
      -- fc 는 fetchDwFcMap 으로 prefetch, 호출부에서 메모리 주입
  `;
```

그리고 맨 아래 매핑:

```typescript
  if (r.vendor_5_cpm != null) result.friendplus = Number(r.vendor_5_cpm);
  if (r.fc != null) result.fc = Number(r.fc);   // ← 이 줄 삭제
  return result;
```

- [ ] **Step 4: 테스트 재실행 + typecheck**

```
npx vitest run lib/features/fc-value-sync/__tests__/redash-fetch.test.ts
npx tsc --noEmit
```

기대: `fetchDwSnapshot` + `fetchDwFcMap` 전체 PASS. TS 에러 없음.

- [ ] **Step 5: Commit**

```bash
git add lib/features/fc-value-sync/redash-fetch.ts lib/features/fc-value-sync/__tests__/redash-fetch.test.ts
git commit -m "$(cat <<'EOF'
refactor(fc-value-sync): fetchDwSnapshot 에서 fc 컬럼 제거

fc 는 fetchDwFcMap prefetch 로 이관. snapshot 은 S/T 만 책임.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `SyncResult` 타입 확장 + 초기값

**목적:** cron 요약 로그에 `fcPrefetched` / `fcResolved` 가 포함되도록 `SyncResult` 를 확장. Task 5 의 prefetch 로직에서 이 필드를 채운다.

**Files:**
- Modify: `lib/features/fc-value-sync/job.ts`

- [ ] **Step 1: 타입 확장**

`lib/features/fc-value-sync/job.ts` 의 `SyncResult` 인터페이스 수정:

```typescript
export interface SyncResult {
  widgetsChecked: number;
  widgetsInserted: number;
  failures: number;
  fcPrefetched: number;
  fcResolved: number;
  details: Array<{ widget_id: string; changed: boolean; error?: string }>;
  durationMs: number;
}
```

- [ ] **Step 2: return 객체에 기본값 0 으로 추가**

함수 맨 아래 return 문:

```typescript
  return {
    widgetsChecked: widgetIds.length,
    widgetsInserted: inserted,
    failures,
    fcPrefetched: 0,   // Task 5 에서 실제 값 주입
    fcResolved: 0,     // Task 5 에서 실제 값 주입
    details,
    durationMs: Date.now() - t0,
  };
```

- [ ] **Step 3: typecheck + 기존 테스트 회귀**

```
npx tsc --noEmit
npx vitest run lib/features/fc-value-sync
```

기대: 전부 PASS. 기존 `SyncResult` 사용처(cron.ts, API route, 테스트 등) 에서 에러 발생하면 `fcPrefetched/fcResolved` 읽는 쪽만 타입 맞춰 업데이트.

- [ ] **Step 4: 사용처 grep 으로 타입 불일치 없는지 확인**

```
rg -n "SyncResult|runFcValueSyncJob" lib/ app/ --type=ts
```

결과를 훑어 `SyncResult` 를 구조 분해하는 곳이 있으면 신규 필드 접근이 컴파일되는지 확인. 에러 있으면 inline 수정.

- [ ] **Step 5: Commit**

```bash
git add lib/features/fc-value-sync/job.ts
git commit -m "$(cat <<'EOF'
feat(fc-value-sync): SyncResult 에 fcPrefetched/fcResolved 추가

Task 5 의 prefetch 관찰성 로그를 위한 타입 확장.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: `job.ts` prefetch 통합 (테스트 선행)

**목적:** `fetchDwFcMap` 을 widget 루프 전에 1회 호출, fail-open 으로 감싸고, 결과를 루프 내 `snap.fc` 에 주입.

**Files:**
- Create: `lib/features/fc-value-sync/__tests__/job.test.ts`
- Modify: `lib/features/fc-value-sync/job.ts`

- [ ] **Step 1: 테스트 파일 신설 + mock 설정**

`lib/features/fc-value-sync/__tests__/job.test.ts` 신규 작성:

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";

// redash-fetch 와 supabase cron-client 를 module 레벨에서 mock
vi.mock("../redash-fetch", () => ({
  fetchDwFcMap: vi.fn(),
  fetchDwSnapshot: vi.fn(),
}));
vi.mock("@/lib/supabase/cron-client", () => ({
  createCronSupabase: vi.fn(),
}));

import { runFcValueSyncJob } from "../job";
import { fetchDwFcMap, fetchDwSnapshot } from "../redash-fetch";
import { createCronSupabase } from "@/lib/supabase/cron-client";

type MockFn = ReturnType<typeof vi.fn>;

/**
 * createCronSupabase() 가 반환하는 supabase client 를 mock.
 * - from("external_mapping").select().not() 체인 → widgetIds
 * - from("external_value").select().eq().is().order().limit() → latest row
 * - from("external_value").insert() → insert result
 */
function makeSupabaseMock(opts: {
  widgetIds: string[];
  latestByWidget: Record<string, unknown | null>;
}) {
  const insertCalls: Array<Record<string, unknown>> = [];

  const fromMapping = () => ({
    select: () => ({
      not: () =>
        Promise.resolve({
          data: opts.widgetIds.map((widget_id) => ({ widget_id })),
          error: null,
        }),
    }),
  });

  const fromExternalValue = () => {
    const chain = {
      // select 체인
      select: () => ({
        eq: (_: string, widgetId: string) => ({
          is: () => ({
            order: () => ({
              limit: () =>
                Promise.resolve({
                  data: opts.latestByWidget[widgetId]
                    ? [{ value: opts.latestByWidget[widgetId] }]
                    : [],
                  error: null,
                }),
            }),
          }),
        }),
      }),
      // insert 체인
      insert: (row: Record<string, unknown>) => {
        insertCalls.push(row);
        return Promise.resolve({ error: null });
      },
    };
    return chain;
  };

  const client = {
    from: (table: string) => {
      if (table === "external_mapping") return fromMapping();
      if (table === "external_value") return fromExternalValue();
      throw new Error(`Unexpected table: ${table}`);
    },
  };

  return { client, insertCalls };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.REDASH_API_KEY = "test-key";
});
```

- [ ] **Step 2: 실패 테스트 — prefetch 성공 + FC 변경**

`job.test.ts` 에 이어서:

```typescript
describe("runFcValueSyncJob — prefetch 통합", () => {
  it("prefetch 성공 + fc 값 변경 시 new row insert 에 fc 포함", async () => {
    const { client, insertCalls } = makeSupabaseMock({
      widgetIds: ["A"],
      latestByWidget: { A: { internal: 1300 } }, // 기존 row 에 fc 없음
    });
    (createCronSupabase as unknown as MockFn).mockReturnValue(client);
    (fetchDwSnapshot as unknown as MockFn).mockResolvedValue({
      internal: 1300,
      syncmedia: 1200,
    });
    (fetchDwFcMap as unknown as MockFn).mockResolvedValue(
      new Map([["A", 230]]),
    );

    const result = await runFcValueSyncJob(new Date("2026-04-17T22:00:00Z"));

    expect(result.fcPrefetched).toBe(1);
    expect(result.fcResolved).toBe(1);
    expect(result.widgetsInserted).toBe(1);
    expect(insertCalls).toHaveLength(1);
    expect((insertCalls[0].value as Record<string, unknown>).fc).toBe(230);
  });

  it("fetchDwFcMap 이 throw 해도 S/T diff 는 정상 수행 (fail-open)", async () => {
    const { client, insertCalls } = makeSupabaseMock({
      widgetIds: ["A"],
      latestByWidget: { A: { internal: 1000 } }, // S 가 달라져서 diff 유발
    });
    (createCronSupabase as unknown as MockFn).mockReturnValue(client);
    (fetchDwSnapshot as unknown as MockFn).mockResolvedValue({
      internal: 1300,
    });
    (fetchDwFcMap as unknown as MockFn).mockRejectedValue(
      new Error("mysql rds down"),
    );

    const result = await runFcValueSyncJob(new Date("2026-04-17T22:00:00Z"));

    expect(result.fcPrefetched).toBe(0);
    expect(result.fcResolved).toBe(0);
    expect(result.failures).toBe(0); // widget 루프 실패 아님
    expect(result.widgetsInserted).toBe(1);
    expect((insertCalls[0].value as Record<string, unknown>).fc).toBeUndefined();
  });

  it("widget 이 fcMap 에 없으면 snap.fc 주입 skip (기존 fc 유지)", async () => {
    const { client, insertCalls } = makeSupabaseMock({
      widgetIds: ["A", "B"],
      latestByWidget: {
        A: { internal: 1300, fc: 999 },
        B: { internal: 1000 }, // B 는 latest 에 fc 없음
      },
    });
    (createCronSupabase as unknown as MockFn).mockReturnValue(client);
    (fetchDwSnapshot as unknown as MockFn).mockImplementation(
      async ({ widgetId }: { widgetId: string }) =>
        widgetId === "A"
          ? { internal: 1400 } // S 가 변해서 insert 유발
          : { internal: 1000 }, // B 는 변경 없음
    );
    // fcMap 에 B 만 있음, A 는 누락
    (fetchDwFcMap as unknown as MockFn).mockResolvedValue(
      new Map([["B", 230]]),
    );

    const result = await runFcValueSyncJob(new Date("2026-04-17T22:00:00Z"));

    // A 는 fc 주입 안 됨 → merged.fc 는 기존 latest 값 999 유지
    const aInsert = insertCalls.find(
      (r) => (r as { widget_id: string }).widget_id === "A",
    );
    expect(aInsert).toBeDefined();
    expect((aInsert!.value as Record<string, unknown>).fc).toBe(999);
    // B 는 fc 변경 있지만 S/T 동일 → insert 됨 (fc=230)
    const bInsert = insertCalls.find(
      (r) => (r as { widget_id: string }).widget_id === "B",
    );
    expect(bInsert).toBeDefined();
    expect((bInsert!.value as Record<string, unknown>).fc).toBe(230);
  });
});
```

- [ ] **Step 3: 테스트 실행해 실패 확인**

```
npx vitest run lib/features/fc-value-sync/__tests__/job.test.ts
```

기대: 3 케이스 모두 FAIL — `fcPrefetched` 가 항상 0, insert 된 value 에 fc 없음.

- [ ] **Step 4: `job.ts` 구현**

`lib/features/fc-value-sync/job.ts` 수정:

1) import 구문에 `fetchDwFcMap` 추가:

```typescript
import { fetchDwFcMap, fetchDwSnapshot } from "./redash-fetch";
```

2) `widgetIds` 계산 직후 prefetch 블록 삽입 (`const details` 선언 **전**):

```typescript
  // FC prefetch — 실패 시 fail-open (S/T 는 그대로 진행)
  let fcMap = new Map<string, number | null>();
  let fcPrefetched = 0;
  let fcResolved = 0;
  try {
    fcMap = await fetchDwFcMap({ widgetIds, apiKey });
    fcPrefetched = widgetIds.length;
    fcResolved = Array.from(fcMap.values()).filter((v) => v != null).length;
  } catch (err) {
    console.warn(
      `[fc-value-sync] fc_prefetch_failed ${err instanceof Error ? err.message : String(err)}`,
    );
  }
```

3) widget 루프 안, `fetchDwSnapshot` 호출 직후에 주입 블록 추가:

```typescript
      const snap = await fetchDwSnapshot({ widgetId, date: today, apiKey });
      if (fcMap.has(widgetId)) {
        const v = fcMap.get(widgetId);
        if (v != null) snap.fc = v;
      }
```

4) return 에서 Task 4 의 하드코딩된 `0` 을 실제 변수로 교체:

```typescript
  return {
    widgetsChecked: widgetIds.length,
    widgetsInserted: inserted,
    failures,
    fcPrefetched,
    fcResolved,
    details,
    durationMs: Date.now() - t0,
  };
```

- [ ] **Step 5: 테스트 재실행해 전체 pass 확인**

```
npx vitest run lib/features/fc-value-sync
npx tsc --noEmit
```

기대: redash-fetch.test + diff.test + job.test 모두 PASS. typecheck 에러 없음.

- [ ] **Step 6: Commit**

```bash
git add lib/features/fc-value-sync/job.ts lib/features/fc-value-sync/__tests__/job.test.ts
git commit -m "$(cat <<'EOF'
feat(fc-value-sync): job.ts 에 FC prefetch 통합 (fail-open)

widget 루프 전 fetchDwFcMap 1회 호출 → 메모리 Map 으로 snap.fc 주입.
prefetch 실패 시 S/T 는 정상 수행 (F1 fail-open). SyncResult.fcPrefetched
/fcResolved 로 관찰성 노출.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: 최종 검증 — lint · typecheck · build · local dry-run

**목적:** 배포 전에 프로젝트 표준 검증 명령을 모두 통과시킨다.

**Files:** 없음 (실행만).

- [ ] **Step 1: 전체 테스트**

```
npx vitest run
```

기대: 모든 suite PASS.

- [ ] **Step 2: 타입 체크**

```
npx tsc --noEmit
```

기대: 에러 0.

- [ ] **Step 3: 린트**

```
npm run lint
```

기대: 경고 0 (기존 warning 외 신규 증가 없음).

- [ ] **Step 4: 빌드**

```
npm run build
```

기대: Next.js 빌드 성공. `instrumentation.ts` 의 cron 등록이 깨지지 않았는지 확인 (로그에 `[fc-value-sync] registered` 출력).

- [ ] **Step 5: 로컬 dry-run (선택)**

운영 `REDASH_API_KEY` 와 `NEXT_PUBLIC_SUPABASE_*` 를 `.env.local` 에 두고:

```bash
REDASH_API_KEY=<personal_key> npx tsx -e '
  import { fetchDwFcMap } from "./lib/features/fc-value-sync/redash-fetch";
  const m = await fetchDwFcMap({
    widgetIds: ["V7a1pGx7", "6o3OAbMo"],
    apiKey: process.env.REDASH_API_KEY!,
  });
  console.log(Object.fromEntries(m));
'
```

기대 출력:
```
{ V7a1pGx7: 230, '6o3OAbMo': 1 }
```

값이 일치하지 않으면 스모크 시점 대비 DW 값이 바뀐 것 — 실 값으로 재검증.

- [ ] **Step 6: 배포 (표준 절차)**

`~/.claude/rules/deploy-llm.md` 에 따라:

```bash
git push origin main
git push deploy main

curl -X POST "https://litellm.internal.dable.io/v1/code-deployments/9605fb4a-80be-4c1a-b5f7-49d572b2f42a/build" \
  -H "Authorization: Bearer $LITELLM_PAT"

# 상태 폴링
curl -s "https://litellm.internal.dable.io/v1/code-deployments/9605fb4a-80be-4c1a-b5f7-49d572b2f42a" \
  -H "Authorization: Bearer $LITELLM_PAT" | jq '{build_status, deploy_status}'
```

기대: `build_status: succeeded`, `deploy_status: running`.

- [ ] **Step 7: 배포 후 검증**

runtime 로그:

```bash
curl -s "https://litellm.internal.dable.io/v1/code-deployments/9605fb4a-80be-4c1a-b5f7-49d572b2f42a/logs?type=runtime" \
  -H "Authorization: Bearer $LITELLM_PAT" | jq -r .runtime_log | grep '\[fc-value-sync\]' | tail -10
```

기대: 다음 06:00 KST cron tick 후 `[fc-value-sync] ok { ..., fcPrefetched: N, fcResolved: M, ...}` (N, M > 0).

Supabase spot check:

```sql
SELECT widget_id, value->>'fc' AS fc, start_date, created_at
FROM media.external_value
WHERE (value ? 'fc')
ORDER BY created_at DESC
LIMIT 10;
```

기대: 첫 cron tick 직후 다수 row 가 뜸. 전부 비어있으면 `fcPrefetched=0` 인지 로그로 prefetch 실패 조사.

---

## Self-Review 결과

**Spec coverage:**
- §1 배경 → Task 0 (context). ✅ 기록됨
- §2 In scope 4 항목 → Task 1–5 각각. ✅
- §3 아키텍처 호출 그래프 → Task 5 Step 4 구현. ✅
- §4 인터페이스 (`fetchDwFcMap`, `fetchDwSnapshot` diff, `job.ts` diff) → Task 1–5. ✅
- §5 SQL → Task 2 Step 3. ✅
- §6 이상값 V1 정책 → Task 2 구현이 값을 있는 그대로 저장. ✅
- §7 관찰성 → `fcPrefetched`/`fcResolved`/fail-open 경고 모두 Task 4–5. ✅
- §8 테스트 표 → Task 1–2(fetchDwFcMap), Task 3(fetchDwSnapshot), Task 5(job.ts). ✅
- §9 배포 · 검증 → Task 6. ✅
- §10 롤백 → plan 외 (운영 대응). 필요 시 `git revert HEAD~N..HEAD`.

**Placeholder scan:** TODO 는 Task 1 Step 3 의 `// TODO Task 2` 1곳이며 Task 2 에서 제거됨. 플랜 완료 후 잔여 TODO 없음. ✅

**Type consistency:** `fetchDwFcMap` 반환 `Map<string, number | null>` 이 Task 1/2/5 에서 일관. `SyncResult.fcPrefetched` / `fcResolved` 이름이 Task 4/5 에서 일관. ✅
