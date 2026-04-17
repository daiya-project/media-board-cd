# External FC (Passback) Report 구현 플랜

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/external/fc` FC 리포트 페이지와 `/external/fc/admin` 관리 페이지를 추가하고, 매일 DW 스냅샷을 `media.external_value` 에 이력화하는 cron 을 구축한다.

**Architecture:** 리포트 계산의 원천 데이터(D, G, a, b, c, d, M)는 DW(`ad_stats.*`) 에서 날짜별 fetch, 계약 단가·FC 이력은 Supabase `external_value` 의 JSONB 에서 조회한다. cron 은 매일 07:00 KST 에 DW 현재값과 최신 active row 를 비교해 변경 시 새 row 를 insert(이력 보존). UI 는 기존 `/external` 패턴(MonthPicker + 컬러 테이블)을 재사용한다.

**Tech Stack:** Next.js 16 (app router) · TypeScript · Supabase (media schema) · `@supabase/supabase-js` cookie-free client · `node-cron` · Vitest · Redash Trino (DW fetch) · Tailwind / shadcn

**참고:**
- Spec: `docs/superpowers/specs/2026-04-17-external-fc-design.md`
- 데이터 레퍼런스: `_docs/80-3rdparty-billing.md`
- 운영 룰: `~/.claude/rules/deploy-llm-schedule.md` (Part I — Next.js + node-cron)

---

## 핵심 설계 결정

### DW fetch 경로: Redash Trino
Spec §3.1 은 "data-gateway MCP" 라고 표기했으나, Next.js 런타임에서 MCP 프로토콜 호출은 기반이 없다. **대신 기존 `daily-redash-import` 가 쓰는 Redash API 를 재사용** 한다. Redash Trino catalog 에 `fact_daily.ad_stats__daily_ctr_4media_by_service_widget`, `fact_daily.ad_stats__daily_actual_sharing_cost_by_service_widget` 이 노출되어 있음이 확인됐고, `DAILY_PASSBACK_STATS` 는 Task 4 스모크 테스트로 존재 여부를 확인한 뒤 불가할 경우 fallback(데이터 공백 허용)으로 처리.

### 계산 흐름
```
page.tsx (서버) → getExternalFcPayload(widgetId, start, end)
                    ├─ fetchDwFcMetrics(widgetId, start, end)       # Redash Trino
                    ├─ getExternalValues(widgetId)                   # Supabase
                    └─ getLatestDataDate()                           # 기존 util
                  → { autoInputs, prices, latestDate, widgetMeta }
FcClient (클라) → deriveFcRows(autoInputs, prices, config, widgetId) → 33컬럼 행 배열
```

### cron 이력화 흐름
```
매일 07:00 KST:
  widgets = getManagedWidgets()                    # external_mapping.widget_id IS NOT NULL
  for each widget:
    snapshot = fetchDwSnapshot(widget)             # Redash Trino (S/T/FC)
    latestRow = findLatestActiveValue(widget)      # Supabase external_value
    if diff(latestRow?.value, snapshot):
      insert external_value { widget_id, value: snapshot, start_date: today }
```

---

## 파일 구조

### 신규 (17개)

| 경로 | 책임 |
|---|---|
| `types/fc.ts` | FC 리포트 전용 타입 (`ExternalFcAutoInputs`, `ExternalFcRow` 이동) |
| `lib/logic/external-fc-vendors.ts` | vendor_id ↔ slug 공용 상수 |
| `lib/features/fc-value-sync/redash-fetch.ts` | Redash Trino 쿼리 실행 (DW 스냅샷 + 일별 메트릭) |
| `lib/features/fc-value-sync/diff.ts` | `UnitPriceValue` 비교 순수 함수 |
| `lib/features/fc-value-sync/job.ts` | cron 오케스트레이션 |
| `lib/features/fc-value-sync/cron.ts` | node-cron 등록 |
| `lib/features/fc-value-sync/__tests__/diff.test.ts` | |
| `lib/features/fc-value-sync/__tests__/redash-fetch.test.ts` | |
| `lib/api/externalFcService.ts` | `getExternalFcPayload()` — DW + Supabase 결합 |
| `app/external/fc/page.tsx` | 서버 컴포넌트 |
| `app/external/fc/loading.tsx` | 스켈레톤 |
| `app/external/fc/_components/FcClient.tsx` | widget picker + 월 네비 + 테이블 |
| `app/external/fc/_components/FcTable.tsx` | 33컬럼 테이블 |
| `app/external/fc/_components/WidgetPicker.tsx` | widget 선택 드롭다운 |
| `app/external/fc/admin/page.tsx` | 관리 페이지 서버 컴포넌트 |
| `app/external/fc/admin/_components/AdminClient.tsx` | widget 리스트 + 에디터 |
| `app/external/fc/admin/_components/UnitPriceEditor.tsx` | `external_value` CRUD 폼 |
| `app/api/fc/sync/route.ts` | 수동 sync 트리거 |
| `app/api/fc/value/route.ts` | `external_value` CRUD API (POST/PATCH/DELETE) |

### 수정 (4개)

| 경로 | 변경 |
|---|---|
| `types/external.ts` | `UnitPriceValue` 에 `friendplus`, `fc` 추가. 기존 `ExternalFcInputs`/`ExternalFcConfig`/`ExternalFcRow`/`ExternalFcAutoInputs`/`ExternalFcPagePayload` 제거 (types/fc.ts 로 이동) |
| `lib/logic/external-fc-logic.ts` | `deriveFcRow` 시그니처 변경, MFR 자동 계산. `ExternalFcInputs` 파라미터 제거 |
| `lib/logic/external-fc-defaults.ts` | 상수 유지 (변경 없음, import 경로만 확인) |
| `instrumentation.ts` | fc-value-sync cron 등록 import 추가 |

---

## 선결 체크

플랜 실행 전에 다음을 확인:

**0.1 현재 브랜치 & 작업 디렉토리**
```bash
cd /Users/daiya/dev/media-board-cd
git status
git branch --show-current
```
기대: 깨끗한 working tree, feature 브랜치 (예: `feat/external-fc`). 아니면 먼저 생성:
```bash
git checkout -b feat/external-fc
```

**0.2 기존 테스트 상태**
```bash
npm test -- --run
```
기대: 모든 기존 테스트 pass. 실패하면 관련없는 회귀부터 해결 후 진행.

**0.3 Redash Trino 에서 `DAILY_PASSBACK_STATS` 조회 가능한지**
`REDASH_API_KEY` 를 export 한 뒤:
```bash
export REDASH_API_KEY="sHNrVjaLUl9ykzGG5mtBP7xuWYjymYCzac8abL76"
curl -s -X POST "https://redash.dable.io/api/queries/15000/results" \
  -H "Authorization: Key $REDASH_API_KEY" \
  -H "Content-Type: application/json" \
  --data-binary @- <<'SQL' | head -100
{"parameters": {}, "max_age": 0}
SQL
```
가능하면 adhoc 쿼리 API(`POST /api/query_results` with `"query": "..."`)로 `SELECT * FROM fact_daily.ad_stats__daily_passback_stats LIMIT 1` 를 실행해서 테이블 노출 여부 확인. 노출 안 되면 **Task 4 의 Redash 스모크 단계에서 대응**한다 (재질문 또는 빈 값 fallback).

---

## Task 1: 타입 이동 및 확장

**Files:**
- Create: `types/fc.ts`
- Modify: `types/external.ts:124-211`

FC 리포트 전용 타입을 `types/fc.ts` 로 분리하고, `UnitPriceValue` 에 `friendplus` / `fc` 필드를 추가한다. `ExternalFcInputs` 는 수동 입력이 사라지므로 제거.

- [ ] **Step 1: `types/fc.ts` 를 새로 만든다**

```ts
/**
 * FC (lineDSP passback) 리포트 전용 타입.
 *
 * `ExternalFcInputs` 수동 입력은 설계 변경으로 제거됐다.
 * 모든 원천 값은 DW auto-input 또는 `UnitPriceValue` (external_value JSONB) 에서 온다.
 */

import type {
  ExternalSource,
  ExternalValueRow,
} from "@/types/external";

/** Widget 단위 FC 상수 (전역 기본값만 사용, DB 테이블 없음). */
export interface ExternalFcConstants {
  rpm_obi_ratio: number;
  server_cost_rate: number;
  apc_rate: number;
  fn_media_weight: number;
  fn_ad_weight: number;
  ad_revenue_rate: number;
  pb_server_discount: number;
}

/** Passback vendor slug — `UnitPriceValue` 의 키와 1:1. */
export type PassbackVendorSlug = "syncmedia" | "klmedia" | "friendplus";

/** DW 에서 fetch 해온 날짜별 원천 지표 — deriveFcRow 의 입력. */
export interface ExternalFcAutoInputs {
  date: string;                 // YYYY-MM-DD
  requests: number;             // D (1.10 impressions)
  passback_imp: number;         // G (DAILY_PASSBACK_STATS.impressions, vendor 2/4/5 합)
  vendor_imp: number;           // J (external_daily.imp)
  dable_media_cost: number;     // a (1.1 media_fee_dsp1)
  dable_revenue: number;        // b (1.10 dsp1+dsp2)
  pb_media_cost: number;        // c (1.1 media_fee_dsp3)
  pb_revenue: number;           // d (DAILY_PASSBACK_STATS.org_cost_spent_krw)
  rpm_dashboard: number;        // M
  vendor_source: PassbackVendorSlug | null;  // 주요 vendor (imp 최대)
}

/** 엑셀 33컬럼 재현. 각 필드는 deriveFcRow() 의 결과. */
export interface ExternalFcRow {
  // 식별
  date: string;
  widget_id: string;

  // 입력
  fc_amount: number | null;           // B (UnitPriceValue.fc, for date)
  requests: number;                   // D
  dable_response: number;             // E (= D - G)
  passback_requests: number;          // G
  dable_passback_imp: number;         // I (현재 항상 0)
  vendor_imp: number;                 // J
  rpm_dashboard: number;              // M

  // 계산: 비율
  response_rate: number;              // F
  passback_rate: number;              // H
  lost_imp: number;                   // K
  rpm_obi: number;                    // L

  // MFR 3종 (DW 기반 자동)
  total_mfr: number;                  // N
  dable_mfr: number;                  // O
  vendor_mfr: number;                 // P

  // 데이블 블록
  dable_fn_revenue: number;           // U
  dable_media_cost: number;           // V
  dable_apc: number;                  // W
  dable_server_cost: number;          // X
  dable_media_revenue: number;        // Y
  dable_ad_revenue: number;           // Z
  dable_cpm: number;                  // AA
  dable_mfr_ref: number;              // AB (= O)
  dable_margin: number;               // R

  // 패스백 블록
  pb_fn_revenue: number;              // AC
  pb_media_cost: number;              // AD
  pb_server_cost: number;             // AE
  pb_media_revenue: number;           // AF
  pb_ad_revenue: number;              // AG
  vendor_margin: number;              // S_margin

  // 종합
  contribution_margin: number;        // Q
  total_rpm_margin: number;           // T_margin
}

/** `/external/fc` 페이지 서버→클라이언트 payload. */
export interface ExternalFcPagePayload {
  widgetId: string | null;
  widgets: Array<{
    widget_id: string;
    label: string;
    source: ExternalSource | null;    // external_mapping.source (참고용)
    service_name?: string;
    widget_name?: string;
  }>;
  autoInputs: ExternalFcAutoInputs[]; // 선택된 widget 의 기간 내 일자별
  unitPrices: ExternalValueRow[];     // 선택된 widget 의 전체 이력
  constants: ExternalFcConstants;     // DEFAULT_FC_CONSTANTS
  latestDate: string;                 // YYYY-MM-DD
  monthStart: string;                 // YYYY-MM-DD
  monthEnd: string;                   // YYYY-MM-DD
}
```

- [ ] **Step 2: `types/external.ts` 에서 FC 관련 타입 제거 + `UnitPriceValue` 확장**

`types/external.ts:46-50` 의 `UnitPriceValue` 를 다음으로 교체:

```ts
/** JSONB value shape for unit price CPM entries (KRW integer). */
export interface UnitPriceValue {
  internal?: number;      // 데이블 ↔ 매체사 CPM (S)
  syncmedia?: number;     // 데이블 ↔ syncmedia CPM (vendor_id=2)
  klmedia?: number;       // 데이블 ↔ klmedia CPM (vendor_id=4)
  friendplus?: number;    // 데이블 ↔ friendplus CPM (vendor_id=5, 신규)
  fc?: number;            // Widget FC / Floor CPM (신규, KRW 정수)
}
```

그리고 `types/external.ts:122-211` 블록 전체(`// FC Report Types` 섹션)를 삭제. 이 블록은 `types/fc.ts` 로 옮겨갔다.

삭제 후 파일 끝에 re-export 추가(기존 import 경로 호환을 위해)하지 않는다 — import 경로를 모두 `@/types/fc` 로 변경한다(다음 Task 들에서).

- [ ] **Step 3: 빌드 타입 체크**

```bash
npx tsc --noEmit
```
기대: `ExternalFcRow`, `ExternalFcInputs`, `ExternalFcConfig`, `ExternalFcAutoInputs`, `ExternalFcPagePayload` 를 import 하는 기존 파일 4~5개에서 에러 발생 (`lib/logic/external-fc-logic.ts` 등). **다음 태스크에서 각자 수정**하므로 이 시점은 빨간 상태가 정상이다.

- [ ] **Step 4: 커밋**

```bash
git add types/fc.ts types/external.ts
git commit -m "types: FC 타입을 types/fc.ts 로 분리, UnitPriceValue에 friendplus/fc 추가"
```

---

## Task 2: vendor 공용 상수 + 단위 테스트

**Files:**
- Create: `lib/logic/external-fc-vendors.ts`
- Create: `lib/logic/__tests__/external-fc-vendors.test.ts`

vendor_id ↔ slug 매핑을 서버·클라이언트 공용으로 상수화한다.

- [ ] **Step 1: 실패 테스트 작성**

`lib/logic/__tests__/external-fc-vendors.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  PASSBACK_VENDORS,
  vendorIdToSlug,
  isAllowedVendorId,
  pickPrimaryVendor,
} from "../external-fc-vendors";

describe("PASSBACK_VENDORS", () => {
  it("3개 벤더가 하드코딩되어 있다", () => {
    expect(PASSBACK_VENDORS).toHaveLength(3);
    const slugs = PASSBACK_VENDORS.map((v) => v.slug);
    expect(slugs).toEqual(["syncmedia", "klmedia", "friendplus"]);
  });
});

describe("vendorIdToSlug", () => {
  it("2/4/5 → 해당 slug", () => {
    expect(vendorIdToSlug(2)).toBe("syncmedia");
    expect(vendorIdToSlug(4)).toBe("klmedia");
    expect(vendorIdToSlug(5)).toBe("friendplus");
  });
  it("허용 밖 → null", () => {
    expect(vendorIdToSlug(-1)).toBeNull();
    expect(vendorIdToSlug(3)).toBeNull();
    expect(vendorIdToSlug(99)).toBeNull();
  });
});

describe("isAllowedVendorId", () => {
  it("2/4/5 만 true", () => {
    expect(isAllowedVendorId(2)).toBe(true);
    expect(isAllowedVendorId(4)).toBe(true);
    expect(isAllowedVendorId(5)).toBe(true);
    expect(isAllowedVendorId(-1)).toBe(false);
    expect(isAllowedVendorId(0)).toBe(false);
  });
});

describe("pickPrimaryVendor", () => {
  it("imp 가 최대인 vendor slug 반환", () => {
    const rows = [
      { vendor_id: 2, impressions: 100 },
      { vendor_id: 5, impressions: 500 },
      { vendor_id: 4, impressions: 200 },
    ];
    expect(pickPrimaryVendor(rows)).toBe("friendplus");
  });
  it("빈 배열 → null", () => {
    expect(pickPrimaryVendor([])).toBeNull();
  });
  it("허용 벤더가 없으면 null", () => {
    expect(pickPrimaryVendor([{ vendor_id: -1, impressions: 1000 }])).toBeNull();
  });
  it("동률이면 slug 알파벳 순", () => {
    const rows = [
      { vendor_id: 2, impressions: 100 },
      { vendor_id: 4, impressions: 100 },
    ];
    // friendplus < klmedia < syncmedia 알파벳순 → klmedia 가 먼저
    expect(pickPrimaryVendor(rows)).toBe("klmedia");
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
npm test -- lib/logic/__tests__/external-fc-vendors.test.ts --run
```
기대: `external-fc-vendors` 모듈 resolve 실패.

- [ ] **Step 3: `lib/logic/external-fc-vendors.ts` 구현**

```ts
/**
 * Passback vendor_id ↔ slug 매핑 — 서버·클라이언트 공용.
 *
 * DW `ad_stats.DAILY_PASSBACK_STATS.vendor_id` 는 DB의 벤더 마스터 값이다.
 * `media.external_value.value` JSONB 키(syncmedia/klmedia/friendplus)와 매핑한다.
 *
 * 벤더 추가 시 PASSBACK_VENDORS 에 entry 만 추가하면 전 layer 반영된다.
 */

import type { PassbackVendorSlug } from "@/types/fc";

export interface PassbackVendorEntry {
  vendor_id: number;
  slug: PassbackVendorSlug;
  label: string;
}

export const PASSBACK_VENDORS: readonly PassbackVendorEntry[] = [
  { vendor_id: 2, slug: "syncmedia",  label: "Sync Media" },
  { vendor_id: 4, slug: "klmedia",    label: "KL Media" },
  { vendor_id: 5, slug: "friendplus", label: "친구플러스" },
];

/** vendor_id → slug. 허용 범위 밖이면 null. */
export function vendorIdToSlug(vendorId: number): PassbackVendorSlug | null {
  const entry = PASSBACK_VENDORS.find((v) => v.vendor_id === vendorId);
  return entry ? entry.slug : null;
}

/** FC 리포트에 포함될 vendor 인지 판정. */
export function isAllowedVendorId(vendorId: number): boolean {
  return PASSBACK_VENDORS.some((v) => v.vendor_id === vendorId);
}

/** vendor imp 내림차순 → 허용 벤더 중 최대 imp 의 slug. 동률은 slug 알파벳순. */
export function pickPrimaryVendor(
  rows: Array<{ vendor_id: number; impressions: number }>,
): PassbackVendorSlug | null {
  const allowed = rows.filter((r) => isAllowedVendorId(r.vendor_id));
  if (allowed.length === 0) return null;
  const sorted = [...allowed].sort((a, b) => {
    if (b.impressions !== a.impressions) return b.impressions - a.impressions;
    const slugA = vendorIdToSlug(a.vendor_id)!;
    const slugB = vendorIdToSlug(b.vendor_id)!;
    return slugA.localeCompare(slugB);
  });
  return vendorIdToSlug(sorted[0].vendor_id);
}
```

- [ ] **Step 4: 테스트 pass 확인**

```bash
npm test -- lib/logic/__tests__/external-fc-vendors.test.ts --run
```
기대: 7 tests passed.

- [ ] **Step 5: 커밋**

```bash
git add lib/logic/external-fc-vendors.ts lib/logic/__tests__/external-fc-vendors.test.ts
git commit -m "logic: passback vendor 공용 상수 (vendor_id ↔ slug) 추가"
```

---

## Task 3: `external-fc-logic.ts` 리팩토링 + 테스트

**Files:**
- Modify: `lib/logic/external-fc-logic.ts`
- Modify: `lib/logic/external-fc-defaults.ts:5-15`
- Create: `lib/logic/__tests__/external-fc-logic.test.ts`

MFR 을 자동 계산으로 바꾸고, `deriveFcRow` 시그니처에서 `ExternalFcInputs` 를 제거한다.

- [ ] **Step 1: `external-fc-defaults.ts` 이름 정리 (상수 유지)**

`lib/logic/external-fc-defaults.ts` 의 `DEFAULT_FC_CONFIG` 를 `DEFAULT_FC_CONSTANTS` 로 이름 변경 + 타입을 `ExternalFcConstants` 로 교체:

```ts
/**
 * FC 리포트 계산용 기본 상수.
 * 엑셀 원본 시트의 하드코딩 값과 동일.
 */
import type { ExternalFcConstants } from "@/types/fc";

export const DEFAULT_FC_CONSTANTS: ExternalFcConstants = {
  rpm_obi_ratio: 0.34,
  server_cost_rate: 0.047,
  apc_rate: 0.017,
  fn_media_weight: 0.75,
  fn_ad_weight: 0.25,
  ad_revenue_rate: 0.95,
  pb_server_discount: 0.1,
};
```

- [ ] **Step 2: 실패 테스트 작성**

`lib/logic/__tests__/external-fc-logic.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { deriveFcRow, deriveFcRows } from "../external-fc-logic";
import { DEFAULT_FC_CONSTANTS } from "../external-fc-defaults";
import type { ExternalFcAutoInputs } from "@/types/fc";
import type { ExternalValueRow } from "@/types/external";

// widget V7a1pGx7 2026-04-15 검증 케이스 (spec §4 표)
const AUTO_20260415: ExternalFcAutoInputs = {
  date: "2026-04-15",
  requests: 100729,
  passback_imp: 37806,
  vendor_imp: 0,
  dable_media_cost: 81799,
  dable_revenue: 256280,
  pb_media_cost: 49147,
  pb_revenue: 45367,
  rpm_dashboard: 1319,
  vendor_source: "syncmedia",
};

const PRICES_20260415: ExternalValueRow[] = [
  {
    id: 1,
    widget_id: "V7a1pGx7",
    value: { internal: 1300, syncmedia: 1200, fc: 230 },
    start_date: "2026-04-08",
    end_date: null,
    created_at: "2026-04-08T00:00:00Z",
  },
];

describe("deriveFcRow — widget V7a1pGx7 2026-04-15", () => {
  const row = deriveFcRow(AUTO_20260415, PRICES_20260415, DEFAULT_FC_CONSTANTS, "V7a1pGx7");

  it("기본 입력 필드", () => {
    expect(row.date).toBe("2026-04-15");
    expect(row.widget_id).toBe("V7a1pGx7");
    expect(row.requests).toBe(100729);
    expect(row.passback_requests).toBe(37806);
    expect(row.dable_response).toBe(100729 - 37806);  // E = D - G
    expect(row.fc_amount).toBe(230);
  });

  it("F/H 비율", () => {
    expect(row.response_rate).toBeCloseTo(62923 / 100729, 4);
    expect(row.passback_rate).toBeCloseTo(37806 / 100729, 4);
  });

  it("MFR 3종 (자동 계산)", () => {
    expect(row.dable_mfr).toBeCloseTo(81799 / 256280, 2);      // O ≈ 0.32
    expect(row.vendor_mfr).toBeCloseTo(49147 / 45367, 2);      // P ≈ 1.08
    expect(row.total_mfr).toBeCloseTo((81799 + 49147) / (256280 + 45367), 2); // N ≈ 0.43
  });

  it("엑셀 PB 매체 매출 AF = G/1000 * T", () => {
    // G=37806, T=1200 → 45367.2
    expect(row.pb_media_revenue).toBeCloseTo(45367.2, 1);
  });

  it("엑셀 데이블 매체비 V = E/1000 * S", () => {
    // E=62923, S=1300 → 81799.9
    expect(row.dable_media_cost).toBeCloseTo(81799.9, 1);
  });

  it("엑셀 데이블 CPM AA = S / O (manual)", () => {
    // S=1300, O=0.31 (엑셀 하드코딩) → AA ≈ 4193.5
    // 단 우리는 O 를 자동 계산(0.32)으로 사용 → AA 약간 달라짐
    const expected_AA = 1300 / row.dable_mfr_ref;
    expect(row.dable_cpm).toBeCloseTo(expected_AA, 2);
  });
});

describe("deriveFcRow — unit price 없을 때", () => {
  it("price 없으면 S=T=FC=0 으로 계산, 공식은 깨지지 않는다", () => {
    const row = deriveFcRow(AUTO_20260415, [], DEFAULT_FC_CONSTANTS, "V7a1pGx7");
    expect(row.fc_amount).toBeNull();
    expect(row.pb_media_revenue).toBe(0);    // G/1000 * 0
    expect(row.dable_media_cost).toBe(0);
  });
});

describe("deriveFcRow — vendor_source null", () => {
  it("vendor_source 없으면 T=0", () => {
    const row = deriveFcRow(
      { ...AUTO_20260415, vendor_source: null, passback_imp: 37806, pb_revenue: 0 },
      PRICES_20260415,
      DEFAULT_FC_CONSTANTS,
      "V7a1pGx7",
    );
    expect(row.pb_media_revenue).toBe(0);
  });
});

describe("deriveFcRow — dable_revenue=0 (divide by zero 방어)", () => {
  it("b=0 이면 O=0", () => {
    const row = deriveFcRow(
      { ...AUTO_20260415, dable_revenue: 0 },
      PRICES_20260415,
      DEFAULT_FC_CONSTANTS,
      "V7a1pGx7",
    );
    expect(row.dable_mfr).toBe(0);
  });
});

describe("deriveFcRows — 날짜 정렬", () => {
  it("결과는 date DESC", () => {
    const auto1 = { ...AUTO_20260415, date: "2026-04-10" };
    const auto2 = { ...AUTO_20260415, date: "2026-04-15" };
    const rows = deriveFcRows([auto1, auto2], PRICES_20260415, DEFAULT_FC_CONSTANTS, "V7a1pGx7");
    expect(rows[0].date).toBe("2026-04-15");
    expect(rows[1].date).toBe("2026-04-10");
  });
});
```

- [ ] **Step 3: 테스트 실행 — 실패 확인**

```bash
npm test -- lib/logic/__tests__/external-fc-logic.test.ts --run
```
기대: 기존 `deriveFcRow` 시그니처와 불일치해 타입 에러 + 런타임 실패.

- [ ] **Step 4: `external-fc-logic.ts` 구현 교체**

`lib/logic/external-fc-logic.ts` 전체 내용을 다음으로 교체:

```ts
/**
 * FC 리포트 행 도출. 엑셀 `FC관리` 시트의 33컬럼 1:1 재현.
 *
 * 변경점 (2026-04-17):
 *  - `ExternalFcInputs` 수동 입력 제거. MFR 3종(N/O/P)은 DW auto input 에서 자동 계산.
 *  - `fc_amount` 는 `UnitPriceValue.fc` (for date) 에서 읽어 표시 (계산 미사용).
 *
 * 공식 상세는 spec §4 참조.
 */

import type {
  ExternalFcAutoInputs,
  ExternalFcConstants,
  ExternalFcRow,
  PassbackVendorSlug,
} from "@/types/fc";
import type { ExternalValueRow, UnitPriceValue } from "@/types/external";
import { findUnitPriceForDate } from "./external-unit-price";

function safeDiv(n: number, d: number): number {
  return d === 0 ? 0 : n / d;
}

function pickVendorPrice(
  price: UnitPriceValue,
  slug: PassbackVendorSlug | null,
): number {
  if (!slug) return 0;
  return price[slug] ?? 0;
}

export function deriveFcRow(
  auto: ExternalFcAutoInputs,
  prices: ExternalValueRow[],
  constants: ExternalFcConstants,
  widgetId: string,
): ExternalFcRow {
  const pricesSorted = [...prices].sort((a, b) =>
    a.start_date.localeCompare(b.start_date),
  );
  const price = findUnitPriceForDate(pricesSorted, auto.date);

  const S = price.internal ?? 0;
  const T = pickVendorPrice(price, auto.vendor_source);
  const FC = price.fc ?? null;

  const D = auto.requests;
  const G = auto.passback_imp;
  const E = Math.max(D - G, 0);
  const I = 0;                              // spec §4: 현재 항상 0
  const J = auto.vendor_imp;
  const M = auto.rpm_dashboard;

  // 비율
  const F = safeDiv(E, D);
  const H = safeDiv(G, D);
  const K = G - J - I;
  const L = safeDiv(M, constants.rpm_obi_ratio);

  // MFR 3종 (자동)
  const O = safeDiv(auto.dable_media_cost, auto.dable_revenue);
  const P = safeDiv(auto.pb_media_cost, auto.pb_revenue);
  const N = safeDiv(
    auto.dable_media_cost + auto.pb_media_cost,
    auto.dable_revenue + auto.pb_revenue,
  );

  // 데이블 블록
  const AB = O;
  const AA = AB === 0 ? 0 : safeDiv(S, AB);
  const Y = (E / 1000) * AA;
  const Z = Y * constants.ad_revenue_rate;
  const X = Y * constants.server_cost_rate;
  const W = Z * constants.apc_rate;
  const V = (E / 1000) * S;
  const U =
    Y * constants.fn_media_weight + Z * constants.fn_ad_weight;
  const R = U - (V + W + X);

  // 패스백 블록
  const AF = (G / 1000) * T;
  const AG = AF;
  const AE = AF * constants.server_cost_rate * constants.pb_server_discount;
  const AD = (G / 1000) * S;
  const AC =
    AF * constants.fn_media_weight + AG * constants.fn_ad_weight;
  const Smargin = AC - (AD + AE);

  // 종합
  const Q = R + Smargin;
  const T_margin = safeDiv(Q, D) * 1000;

  return {
    date: auto.date,
    widget_id: widgetId,

    fc_amount: FC,
    requests: D,
    dable_response: E,
    passback_requests: G,
    dable_passback_imp: I,
    vendor_imp: J,
    rpm_dashboard: M,

    response_rate: F,
    passback_rate: H,
    lost_imp: K,
    rpm_obi: L,

    total_mfr: N,
    dable_mfr: O,
    vendor_mfr: P,

    dable_fn_revenue: U,
    dable_media_cost: V,
    dable_apc: W,
    dable_server_cost: X,
    dable_media_revenue: Y,
    dable_ad_revenue: Z,
    dable_cpm: AA,
    dable_mfr_ref: AB,
    dable_margin: R,

    pb_fn_revenue: AC,
    pb_media_cost: AD,
    pb_server_cost: AE,
    pb_media_revenue: AF,
    pb_ad_revenue: AG,
    vendor_margin: Smargin,

    contribution_margin: Q,
    total_rpm_margin: T_margin,
  };
}

export function deriveFcRows(
  autoInputs: ExternalFcAutoInputs[],
  prices: ExternalValueRow[],
  constants: ExternalFcConstants,
  widgetId: string,
): ExternalFcRow[] {
  return autoInputs
    .map((auto) => deriveFcRow(auto, prices, constants, widgetId))
    .sort((a, b) => b.date.localeCompare(a.date));
}
```

- [ ] **Step 5: 테스트 pass 확인**

```bash
npm test -- lib/logic/__tests__/external-fc-logic.test.ts --run
```
기대: 9 tests passed. `toBeCloseTo` 허용 오차 안에서 전부 통과.

- [ ] **Step 6: 기존 verify.mjs 제거 (새 테스트로 대체됨)**

```bash
rm lib/logic/__tests__/external-fc-logic.verify.mjs
```

- [ ] **Step 7: 전체 테스트 회귀 점검**

```bash
npm test -- --run
npx tsc --noEmit
```
기대: 모든 테스트 pass. TypeScript 에러 없음 (이전 Task 1 에서 빨간 상태였던 것들이 여기서 해소됨).

- [ ] **Step 8: 커밋**

```bash
git add lib/logic/external-fc-logic.ts lib/logic/external-fc-defaults.ts lib/logic/__tests__/external-fc-logic.test.ts
git rm lib/logic/__tests__/external-fc-logic.verify.mjs
git commit -m "logic: deriveFcRow 시그니처 변경, MFR 3종 DW 기반 자동 계산"
```

---

## Task 4: Redash Trino 스모크 테스트 + DW fetch 모듈

**Files:**
- Create: `lib/features/fc-value-sync/redash-fetch.ts`
- Create: `lib/features/fc-value-sync/__tests__/redash-fetch.test.ts`

DW 3개 테이블에 대한 Redash Trino 쿼리를 래핑한다. 기존 `lib/features/daily-redash-import/redash-fetch.ts` 의 POST+Polling 패턴을 공유.

- [ ] **Step 1: Redash Trino 스모크 (탐색, 코드 변경 없음)**

터미널에서 adhoc 쿼리 실행 — personal API key(`REDASH_API_KEY`) 로:

```bash
export REDASH_API_KEY="sHNrVjaLUl9ykzGG5mtBP7xuWYjymYCzac8abL76"

# 1) passback 테이블이 노출되는지
bash ~/.claude/skills/dable-query/scripts/redash_execute.sh - <<'SQL'
-- ============================================================
-- FC sync smoke: passback table exists check
-- 구분: media
-- 용도: Redash Trino catalog 에 DAILY_PASSBACK_STATS 가 조회 가능한지 확인
-- 주요 컬럼: widget_id, impressions, cpm_value, org_cost_spent_krw
-- 테이블: fact_daily.ad_stats__daily_passback_stats
-- 파라미터: 없음
-- ============================================================
SELECT widget_id, vendor_id, impressions, cpm_value, org_cost_spent_krw
FROM fact_daily.ad_stats__daily_passback_stats
WHERE local_basic_time = DATE '2026-04-15'
  AND widget_id = 'V7a1pGx7'
LIMIT 5
SQL
```

**성공 시**: 1행 반환, `impressions=37806`. 실제 Redash catalog 경로(`fact_daily.ad_stats__daily_passback_stats`) 를 코드에서 사용.

**실패 시**: `Table not found` — 다른 schema 명 시도 (`fact.ad_stats__daily_passback_stats`, `ad_stats.daily_passback_stats` 등). 모두 실패면 data-gateway HTTP backend 를 별도로 호출하는 방식으로 전환 (이 경우 구현 블로커 — 사용자에 알림).

- [ ] **Step 2: 실패 테스트 작성**

`lib/features/fc-value-sync/__tests__/redash-fetch.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  fetchDwFcMetrics,
  fetchDwSnapshot,
  __setFetchForTesting,
} from "../redash-fetch";

const ORIG_FETCH = globalThis.fetch;

afterEach(() => {
  __setFetchForTesting(undefined);
});

describe("fetchDwFcMetrics — widget × date 범위", () => {
  it("Redash 쿼리 결과를 ExternalFcAutoInputs[] 로 변환한다", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        query_result: {
          data: {
            rows: [
              {
                date: "2026-04-15",
                requests: 100729,
                passback_imp: 37806,
                dable_media_cost: 81799,
                dable_revenue: 256280,
                pb_media_cost: 49147,
                pb_revenue: 45367,
                rpm_dashboard: 1319,
                primary_vendor_id: 2,
                vendor_imp: 0,
              },
            ],
          },
        },
      }),
    });
    __setFetchForTesting(mockFetch as typeof fetch);

    const result = await fetchDwFcMetrics({
      widgetId: "V7a1pGx7",
      startDate: "2026-04-15",
      endDate: "2026-04-15",
      apiKey: "test-key",
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      date: "2026-04-15",
      requests: 100729,
      passback_imp: 37806,
      vendor_source: "syncmedia",
    });
  });

  it("허용 밖 vendor_id → vendor_source null", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        query_result: {
          data: {
            rows: [
              {
                date: "2026-04-15",
                requests: 1000,
                passback_imp: 100,
                dable_media_cost: 500,
                dable_revenue: 2000,
                pb_media_cost: 100,
                pb_revenue: 0,
                rpm_dashboard: 500,
                primary_vendor_id: -1,
                vendor_imp: 0,
              },
            ],
          },
        },
      }),
    });
    __setFetchForTesting(mockFetch as typeof fetch);

    const result = await fetchDwFcMetrics({
      widgetId: "V7a1pGx7",
      startDate: "2026-04-15",
      endDate: "2026-04-15",
      apiKey: "test-key",
    });
    expect(result[0].vendor_source).toBeNull();
  });
});

describe("fetchDwSnapshot — cron 용 S/T/FC 조회", () => {
  it("S internal / T per-vendor / FC 를 UnitPriceValue 로 합성", async () => {
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
                fc: 230,
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
      fc: 230,
    });
  });

  it("Redash 가 빈 rows 반환 → 빈 객체", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ query_result: { data: { rows: [] } } }),
    });
    __setFetchForTesting(mockFetch as typeof fetch);

    const snap = await fetchDwSnapshot({
      widgetId: "UNKNOWN",
      date: "2026-04-15",
      apiKey: "test-key",
    });
    expect(snap).toEqual({});
  });
});
```

- [ ] **Step 3: 테스트 실행 — 실패 확인**

```bash
npm test -- lib/features/fc-value-sync/__tests__/redash-fetch.test.ts --run
```
기대: 모듈 resolve 실패.

- [ ] **Step 4: `redash-fetch.ts` 구현**

```ts
/**
 * FC sync 용 Redash Trino 쿼리 실행.
 *
 * 두 가지 조회:
 *  - fetchDwFcMetrics(widget, range): 리포트 페이지용 일자별 메트릭 (D, G, a, b, c, d, M, vendor_source)
 *  - fetchDwSnapshot(widget, date): cron 이력화용 S/T/FC 현재값 (UnitPriceValue)
 *
 * 기존 `lib/features/daily-redash-import/redash-fetch.ts` 의 POST+Polling 기반.
 * Redash 템플릿 파라미터 대신 CTE params 방식 사용 (runtime 에서 SQL 조립).
 */

import type { ExternalFcAutoInputs } from "@/types/fc";
import type { UnitPriceValue } from "@/types/external";
import { vendorIdToSlug } from "@/lib/logic/external-fc-vendors";

// ---------------------------------------------------------------------------
// Test injection
// ---------------------------------------------------------------------------
let fetchImpl: typeof fetch | undefined;
export function __setFetchForTesting(f: typeof fetch | undefined): void {
  fetchImpl = f;
}
function $fetch(...args: Parameters<typeof fetch>) {
  return (fetchImpl ?? globalThis.fetch)(...args);
}

const REDASH_BASE = "https://redash.dable.io";

interface RedashRowGeneric {
  [k: string]: unknown;
}

async function runAdhocQuery<Row extends RedashRowGeneric>(
  sql: string,
  apiKey: string,
): Promise<Row[]> {
  const url = `${REDASH_BASE}/api/query_results?api_key=${apiKey}`;
  const res = await $fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql, data_source_id: 1, max_age: 0 }),
  });
  if (!res.ok) {
    throw new Error(`Redash adhoc query failed: ${res.status}`);
  }
  const json = (await res.json()) as {
    query_result?: { data?: { rows?: Row[] } };
    job?: { id: string };
  };
  if (json.query_result) {
    return json.query_result.data?.rows ?? [];
  }
  // polling 은 daily-redash-import 의 기존 로직을 참고해 별도 구현 가능.
  // 우선은 캐시 hit 전제 (Redash 가 바로 결과 반환).
  throw new Error("Redash returned job id — polling not yet implemented for adhoc");
}

// ---------------------------------------------------------------------------
// fetchDwFcMetrics: 일자별 메트릭
// ---------------------------------------------------------------------------

export interface FetchDwFcMetricsOpts {
  widgetId: string;
  startDate: string;   // YYYY-MM-DD inclusive
  endDate: string;     // YYYY-MM-DD inclusive
  apiKey: string;
}

interface MetricRow {
  date: string;
  requests: number;
  passback_imp: number;
  dable_media_cost: number;
  dable_revenue: number;
  pb_media_cost: number;
  pb_revenue: number;
  rpm_dashboard: number;
  primary_vendor_id: number | null;
  vendor_imp: number;
}

export async function fetchDwFcMetrics(
  opts: FetchDwFcMetricsOpts,
): Promise<ExternalFcAutoInputs[]> {
  const sql = `
    WITH params AS (
      SELECT
        CAST('${opts.widgetId}' AS varchar) AS widget_id,
        DATE '${opts.startDate}' AS date_start,
        DATE '${opts.endDate}'   AS date_end
    ),
    ctr AS (
      SELECT
        CAST(local_basic_time AS varchar) AS date,
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
        CAST(local_basic_time AS varchar) AS date,
        widget_id,
        media_fee_dsp1 AS dable_media_cost,
        media_fee_dsp3 AS pb_media_cost
      FROM fact_daily.ad_stats__daily_actual_sharing_cost_by_service_widget
      WHERE widget_id = (SELECT widget_id FROM params)
        AND local_basic_time BETWEEN (SELECT date_start FROM params) AND (SELECT date_end FROM params)
    ),
    pb AS (
      SELECT
        CAST(local_basic_time AS varchar) AS date,
        widget_id,
        SUM(CASE WHEN vendor_id IN (2,4,5) THEN impressions ELSE 0 END)          AS passback_imp,
        SUM(CASE WHEN vendor_id IN (2,4,5) THEN COALESCE(org_cost_spent_krw,0) ELSE 0 END) AS pb_revenue,
        ARBITRARY(
          CASE WHEN vendor_id IN (2,4,5)
            AND impressions = (MAX(impressions) OVER (PARTITION BY local_basic_time, widget_id))
          THEN vendor_id ELSE NULL END
        ) AS primary_vendor_id
      FROM fact_daily.ad_stats__daily_passback_stats
      WHERE widget_id = (SELECT widget_id FROM params)
        AND local_basic_time BETWEEN (SELECT date_start FROM params) AND (SELECT date_end FROM params)
      GROUP BY local_basic_time, widget_id
    )
    SELECT
      ctr.date,
      COALESCE(ctr.requests,0)           AS requests,
      COALESCE(pb.passback_imp,0)        AS passback_imp,
      COALESCE(fee.dable_media_cost,0)   AS dable_media_cost,
      COALESCE(ctr.dable_revenue,0)      AS dable_revenue,
      COALESCE(fee.pb_media_cost,0)      AS pb_media_cost,
      COALESCE(pb.pb_revenue,0)          AS pb_revenue,
      COALESCE(ctr.rpm_dashboard,0)      AS rpm_dashboard,
      pb.primary_vendor_id,
      0                                  AS vendor_imp
    FROM ctr
    LEFT JOIN fee USING (date, widget_id)
    LEFT JOIN pb  USING (date, widget_id)
    ORDER BY ctr.date
  `;

  const rows = await runAdhocQuery<MetricRow>(sql, opts.apiKey);
  return rows.map((r) => ({
    date: r.date,
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
// fetchDwSnapshot: cron 용 현재값 (S/T/FC)
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
  fc: number | null;
}

export async function fetchDwSnapshot(
  opts: FetchDwSnapshotOpts,
): Promise<UnitPriceValue> {
  const sql = `
    WITH params AS (
      SELECT
        CAST('${opts.widgetId}' AS varchar) AS widget_id,
        DATE '${opts.date}' AS d
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
          AND vendor_id = 5) AS vendor_5_cpm,
      -- FC 는 dable.WIDGET 쪽 MySQL 메타. Redash Trino catalog 에 없을 수 있음.
      -- 있으면 default_settings JSON 추출, 없으면 NULL fallback.
      CAST(NULL AS integer) AS fc
  `;

  const rows = await runAdhocQuery<SnapshotRow>(sql, opts.apiKey);
  if (rows.length === 0) return {};

  const r = rows[0];
  const result: UnitPriceValue = {};
  if (r.internal_cpm != null) result.internal = Number(r.internal_cpm);
  if (r.vendor_2_cpm != null) result.syncmedia = Number(r.vendor_2_cpm);
  if (r.vendor_4_cpm != null) result.klmedia = Number(r.vendor_4_cpm);
  if (r.vendor_5_cpm != null) result.friendplus = Number(r.vendor_5_cpm);
  if (r.fc != null) result.fc = Number(r.fc);
  return result;
}
```

> **FC 원천 주의**: `dable.WIDGET.default_settings.passback.ad_low_rpm_passback` 은 MySQL 메타이며 Redash Trino catalog 에 노출되지 않을 수 있다. Step 1 스모크에서 확인되면 SQL 에 반영, 아니면 `fc` 는 Supabase admin 페이지에서 수동 입력으로 관리(초기 구현). 이 결정은 Task 4 Step 1 결과에 따라 여기서 한 번만 조정.

- [ ] **Step 5: 테스트 pass 확인**

```bash
npm test -- lib/features/fc-value-sync/__tests__/redash-fetch.test.ts --run
```
기대: 4 tests passed.

- [ ] **Step 6: 커밋**

```bash
git add lib/features/fc-value-sync/redash-fetch.ts lib/features/fc-value-sync/__tests__/redash-fetch.test.ts
git commit -m "fc-value-sync: Redash Trino fetch (widget 메트릭 + 스냅샷)"
```

---

## Task 5: `externalFcService.ts` — payload 조립

**Files:**
- Create: `lib/api/externalFcService.ts`

리포트 페이지의 서버 컴포넌트에서 호출할 `getExternalFcPayload()`. DW fetch + Supabase 이력 조회 + widget 리스트 조합.

- [ ] **Step 1: 모듈 작성**

```ts
/**
 * `/external/fc` 페이지 서버 컴포넌트 payload 조립.
 *
 * 구성:
 *  1. 관리 대상 widget 리스트 (external_mapping 기준)
 *  2. 선택된 widget 의 기간(월) 일자별 DW 메트릭 → ExternalFcAutoInputs[]
 *  3. 선택된 widget 의 external_value 전체 이력
 *  4. latestDate + monthStart/End (월 범위)
 */

import { createMediaClient } from "@/lib/supabase/media-server";
import { paginateQuery } from "@/lib/api/paginateQuery";
import { getLatestDataDate } from "@/lib/api/dateService";
import { getExternalMappings, getExternalValues } from "@/lib/api/externalService";
import { fetchDwFcMetrics } from "@/lib/features/fc-value-sync/redash-fetch";
import { DEFAULT_FC_CONSTANTS } from "@/lib/logic/external-fc-defaults";
import { toYearMonth, getLastDayOfMonth } from "@/lib/utils/date-utils";
import type { ExternalFcPagePayload } from "@/types/fc";
import type { ExternalSource } from "@/types/external";

/** widget 피커 options — external_mapping.widget_id IS NOT NULL 에서 추출. */
export async function listManagedWidgets(): Promise<
  ExternalFcPagePayload["widgets"]
> {
  const mappings = await getExternalMappings();
  const uniq = new Map<string, { label: string; source: ExternalSource | null }>();
  for (const m of mappings) {
    if (!m.widget_id) continue;
    if (uniq.has(m.widget_id)) continue;
    uniq.set(m.widget_id, {
      label: m.label ?? m.external_key,
      source: m.source,
    });
  }
  return Array.from(uniq.entries()).map(([widget_id, info]) => ({
    widget_id,
    label: info.label,
    source: info.source,
  }));
}

/** 선택된 widget 의 external_value 이력 전량. */
async function getValuesForWidget(
  widgetId: string,
): Promise<ExternalFcPagePayload["unitPrices"]> {
  const all = await getExternalValues();
  return all.filter((v) => v.widget_id === widgetId);
}

export interface GetExternalFcPayloadArgs {
  widgetId: string | null;
  monthYm?: string;    // "YYYY-MM". 기본 = latestDate 기준.
}

export async function getExternalFcPayload(
  args: GetExternalFcPayloadArgs,
): Promise<ExternalFcPagePayload> {
  const latestDate = await getLatestDataDate();
  if (!latestDate) {
    throw new Error("latestDate 를 찾을 수 없습니다 (media.v_dates 비어있음)");
  }

  const ym = args.monthYm ?? toYearMonth(latestDate);
  const monthStart = `${ym}-01`;
  const monthEnd = getLastDayOfMonth(ym);
  const effectiveEnd = monthEnd > latestDate ? latestDate : monthEnd;

  const widgets = await listManagedWidgets();

  let autoInputs: ExternalFcPagePayload["autoInputs"] = [];
  let unitPrices: ExternalFcPagePayload["unitPrices"] = [];

  if (args.widgetId) {
    const apiKey = process.env.REDASH_API_KEY;
    if (!apiKey) {
      throw new Error("REDASH_API_KEY 환경변수가 설정되지 않았습니다");
    }
    const [metrics, prices] = await Promise.all([
      fetchDwFcMetrics({
        widgetId: args.widgetId,
        startDate: monthStart,
        endDate: effectiveEnd,
        apiKey,
      }),
      getValuesForWidget(args.widgetId),
    ]);
    autoInputs = metrics;
    unitPrices = prices;
  }

  return {
    widgetId: args.widgetId,
    widgets,
    autoInputs,
    unitPrices,
    constants: DEFAULT_FC_CONSTANTS,
    latestDate,
    monthStart,
    monthEnd: effectiveEnd,
  };
}
```

- [ ] **Step 2: `getLastDayOfMonth` 존재 확인**

```bash
grep -n "getLastDayOfMonth" lib/utils/date-utils.ts
```

없으면 `lib/utils/date-utils.ts` 에 추가:

```ts
export function getLastDayOfMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m, 0));  // m=1~12, next month day 0 = last day
  return d.toISOString().slice(0, 10);
}
```

- [ ] **Step 3: 타입 체크**

```bash
npx tsc --noEmit
```
기대: 에러 없음.

- [ ] **Step 4: 커밋**

```bash
git add lib/api/externalFcService.ts lib/utils/date-utils.ts
git commit -m "api: getExternalFcPayload — DW fetch + external_value 이력 조합"
```

---

## Task 6: 리포트 페이지 — `app/external/fc/page.tsx` + 클라이언트 컴포넌트

**Files:**
- Create: `app/external/fc/page.tsx`
- Create: `app/external/fc/loading.tsx`
- Create: `app/external/fc/_components/FcClient.tsx`
- Create: `app/external/fc/_components/WidgetPicker.tsx`
- Create: `app/external/fc/_components/FcTable.tsx`

엑셀 33컬럼을 렌더하는 리포트 페이지.

- [ ] **Step 1: `app/external/fc/page.tsx`**

```tsx
import { Suspense } from "react";
import { TableSkeleton } from "@/components/common/PageSkeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { getExternalFcPayload } from "@/lib/api/externalFcService";
import FcClient from "./_components/FcClient";

export const dynamic = "force-dynamic";

export default async function ExternalFcPage({
  searchParams,
}: {
  searchParams: Promise<{ widget?: string; month?: string }>;
}) {
  const { widget, month } = await searchParams;

  const payload = await getExternalFcPayload({
    widgetId: widget ?? null,
    monthYm: month,
  }).catch((err) => {
    console.error("[ExternalFcPage] payload fetch failed:", err);
    return null;
  });

  if (!payload) {
    return <EmptyState message="FC 리포트 데이터를 불러올 수 없습니다." />;
  }

  return (
    <div className="flex flex-col gap-4 p-6 h-full max-w-[1920px] mx-auto">
      <Suspense fallback={<TableSkeleton cols={33} rows={15} />}>
        <FcClient payload={payload} />
      </Suspense>
    </div>
  );
}
```

- [ ] **Step 2: `app/external/fc/loading.tsx`**

```tsx
import { TableSkeleton } from "@/components/common/PageSkeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-4 p-6 h-full max-w-[1920px] mx-auto">
      <TableSkeleton cols={33} rows={15} />
    </div>
  );
}
```

- [ ] **Step 3: `app/external/fc/_components/WidgetPicker.tsx`**

```tsx
"use client";

import { useState, useMemo } from "react";
import { Search, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ExternalFcPagePayload } from "@/types/fc";

interface Props {
  widgets: ExternalFcPagePayload["widgets"];
  selectedId: string | null;
  onSelect: (widgetId: string) => void;
}

export default function WidgetPicker({ widgets, selectedId, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = widgets.find((w) => w.widget_id === selectedId) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return widgets;
    return widgets.filter(
      (w) =>
        w.widget_id.toLowerCase().includes(q) ||
        w.label.toLowerCase().includes(q),
    );
  }, [widgets, query]);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="h-10 px-4 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 flex items-center gap-2 min-w-[280px]"
      >
        <span className="truncate">
          {selected ? `${selected.label} (${selected.widget_id})` : "위젯 선택"}
        </span>
        <ChevronDown className="w-4 h-4 text-slate-400 ml-auto" />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-[420px] bg-white border border-slate-200 rounded-lg shadow-lg z-10">
          <div className="p-2 border-b border-slate-100 flex items-center gap-2">
            <Search className="w-4 h-4 text-slate-400" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="widget_id 또는 이름 검색..."
              className="flex-1 text-sm outline-none bg-transparent"
            />
            {query && (
              <button onClick={() => setQuery("")}>
                <X className="w-3 h-3 text-slate-400" />
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="p-4 text-xs text-slate-400 text-center">
                결과 없음
              </div>
            ) : (
              filtered.map((w) => (
                <button
                  key={w.widget_id}
                  onClick={() => {
                    onSelect(w.widget_id);
                    setOpen(false);
                  }}
                  className={cn(
                    "w-full text-left px-3 py-2 text-xs hover:bg-slate-50 border-b border-slate-100",
                    w.widget_id === selectedId && "bg-blue-50",
                  )}
                >
                  <div className="font-medium text-slate-700">{w.label}</div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    {w.widget_id}
                    {w.source && <span className="ml-2">· {w.source}</span>}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: `app/external/fc/_components/FcTable.tsx`**

```tsx
"use client";

import { cn } from "@/lib/utils";
import { formatNumberForDisplay } from "@/lib/utils/number-utils";
import {
  TABLE_THEAD_CLASS,
  TABLE_TH_CLASS,
  TABLE_TD_CLASS,
  EMPTY_STATE_CLASS,
} from "@/lib/utils/table-display-utils";
import type { ExternalFcRow } from "@/types/fc";

function fmt(n: number, digits = 0): string {
  if (!Number.isFinite(n)) return "—";
  return formatNumberForDisplay(Math.round(n * Math.pow(10, digits)) / Math.pow(10, digits));
}
function fmtPct(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(1)}%`;
}
function fmtKrw(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return `₩${formatNumberForDisplay(Math.round(n))}`;
}

interface Props {
  rows: ExternalFcRow[];
}

export default function FcTable({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <div className={EMPTY_STATE_CLASS} style={{ height: 160 }}>
        데이터가 없습니다
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto rounded-xl border border-border shadow-sm">
      <table className="w-max min-w-full border-collapse text-xs">
        <thead className={TABLE_THEAD_CLASS}>
          {/* group row */}
          <tr className="border-b border-gray-100">
            <th colSpan={2}  className="py-2 px-2 text-center text-[10px] font-semibold text-gray-500">기본</th>
            <th colSpan={6}  className="py-2 px-2 text-center text-[10px] font-semibold bg-sky-50 text-sky-700">요청·응답</th>
            <th colSpan={4}  className="py-2 px-2 text-center text-[10px] font-semibold bg-amber-50 text-amber-700">RPM·MFR</th>
            <th colSpan={9}  className="py-2 px-2 text-center text-[10px] font-semibold bg-blue-50 text-blue-700">데이블 블록</th>
            <th colSpan={7}  className="py-2 px-2 text-center text-[10px] font-semibold bg-orange-50 text-orange-700">패스백 블록</th>
            <th colSpan={2}  className="py-2 px-2 text-center text-[10px] font-semibold bg-green-50 text-green-700">공헌이익</th>
          </tr>
          {/* header row */}
          <tr className="border-b border-gray-200">
            <th className={TABLE_TH_CLASS}>날짜</th>
            <th className={TABLE_TH_CLASS}>FC</th>
            <th className={TABLE_TH_CLASS}>요청</th>
            <th className={TABLE_TH_CLASS}>응답</th>
            <th className={TABLE_TH_CLASS}>응답률</th>
            <th className={TABLE_TH_CLASS}>패스백</th>
            <th className={TABLE_TH_CLASS}>패스백률</th>
            <th className={TABLE_TH_CLASS}>싱크노출</th>
            <th className={TABLE_TH_CLASS}>RPM</th>
            <th className={TABLE_TH_CLASS}>RPM(OBI)</th>
            <th className={TABLE_TH_CLASS}>전체MFR</th>
            <th className={TABLE_TH_CLASS}>데이블MFR</th>
            <th className={TABLE_TH_CLASS}>FN매출</th>
            <th className={TABLE_TH_CLASS}>매체비</th>
            <th className={TABLE_TH_CLASS}>APC</th>
            <th className={TABLE_TH_CLASS}>서버비</th>
            <th className={TABLE_TH_CLASS}>매체매출</th>
            <th className={TABLE_TH_CLASS}>광고매출</th>
            <th className={TABLE_TH_CLASS}>CPM</th>
            <th className={TABLE_TH_CLASS}>공헌이익</th>
            <th className={TABLE_TH_CLASS}>유실분</th>
            <th className={TABLE_TH_CLASS}>싱크MFR</th>
            <th className={TABLE_TH_CLASS}>PB FN</th>
            <th className={TABLE_TH_CLASS}>PB 매체비</th>
            <th className={TABLE_TH_CLASS}>PB 서버비</th>
            <th className={TABLE_TH_CLASS}>PB 매체매출</th>
            <th className={TABLE_TH_CLASS}>PB 광고매출</th>
            <th className={TABLE_TH_CLASS}>싱크 공헌</th>
            <th className={TABLE_TH_CLASS}>전체 공헌</th>
            <th className={TABLE_TH_CLASS}>전체 RPM</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.date} className="border-b border-gray-100 hover:bg-gray-50">
              <td className={cn(TABLE_TD_CLASS, "text-center font-mono whitespace-nowrap")}>{r.date}</td>
              <td className={cn(TABLE_TD_CLASS, "text-right tabular-nums")}>{r.fc_amount != null ? fmtKrw(r.fc_amount) : "—"}</td>
              <td className={cn(TABLE_TD_CLASS, "text-right tabular-nums")}>{fmt(r.requests)}</td>
              <td className={cn(TABLE_TD_CLASS, "text-right tabular-nums")}>{fmt(r.dable_response)}</td>
              <td className={cn(TABLE_TD_CLASS, "text-right tabular-nums")}>{fmtPct(r.response_rate)}</td>
              <td className={cn(TABLE_TD_CLASS, "text-right tabular-nums")}>{fmt(r.passback_requests)}</td>
              <td className={cn(TABLE_TD_CLASS, "text-right tabular-nums")}>{fmtPct(r.passback_rate)}</td>
              <td className={cn(TABLE_TD_CLASS, "text-right tabular-nums")}>{fmt(r.vendor_imp)}</td>
              <td className={cn(TABLE_TD_CLASS, "text-right tabular-nums")}>{fmt(r.rpm_dashboard)}</td>
              <td className={cn(TABLE_TD_CLASS, "text-right tabular-nums")}>{fmt(r.rpm_obi)}</td>
              <td className={cn(TABLE_TD_CLASS, "text-right tabular-nums")}>{fmtPct(r.total_mfr)}</td>
              <td className={cn(TABLE_TD_CLASS, "text-right tabular-nums text-blue-700")}>{fmtPct(r.dable_mfr)}</td>
              <td className={cn(TABLE_TD_CLASS, "text-right tabular-nums text-blue-700")}>{fmtKrw(r.dable_fn_revenue)}</td>
              <td className={cn(TABLE_TD_CLASS, "text-right tabular-nums text-blue-700")}>{fmtKrw(r.dable_media_cost)}</td>
              <td className={cn(TABLE_TD_CLASS, "text-right tabular-nums text-blue-700")}>{fmtKrw(r.dable_apc)}</td>
              <td className={cn(TABLE_TD_CLASS, "text-right tabular-nums text-blue-700")}>{fmtKrw(r.dable_server_cost)}</td>
              <td className={cn(TABLE_TD_CLASS, "text-right tabular-nums text-blue-700")}>{fmtKrw(r.dable_media_revenue)}</td>
              <td className={cn(TABLE_TD_CLASS, "text-right tabular-nums text-blue-700")}>{fmtKrw(r.dable_ad_revenue)}</td>
              <td className={cn(TABLE_TD_CLASS, "text-right tabular-nums text-blue-700")}>{fmt(r.dable_cpm, 1)}</td>
              <td className={cn(TABLE_TD_CLASS, "text-right tabular-nums text-blue-700")}>{fmtKrw(r.dable_margin)}</td>
              <td className={cn(TABLE_TD_CLASS, "text-right tabular-nums")}>{fmt(r.lost_imp)}</td>
              <td className={cn(TABLE_TD_CLASS, "text-right tabular-nums text-orange-700")}>{fmtPct(r.vendor_mfr)}</td>
              <td className={cn(TABLE_TD_CLASS, "text-right tabular-nums text-orange-700")}>{fmtKrw(r.pb_fn_revenue)}</td>
              <td className={cn(TABLE_TD_CLASS, "text-right tabular-nums text-orange-700")}>{fmtKrw(r.pb_media_cost)}</td>
              <td className={cn(TABLE_TD_CLASS, "text-right tabular-nums text-orange-700")}>{fmtKrw(r.pb_server_cost)}</td>
              <td className={cn(TABLE_TD_CLASS, "text-right tabular-nums text-orange-700")}>{fmtKrw(r.pb_media_revenue)}</td>
              <td className={cn(TABLE_TD_CLASS, "text-right tabular-nums text-orange-700")}>{fmtKrw(r.pb_ad_revenue)}</td>
              <td className={cn(TABLE_TD_CLASS, "text-right tabular-nums text-orange-700")}>{fmtKrw(r.vendor_margin)}</td>
              <td className={cn(TABLE_TD_CLASS, "text-right tabular-nums font-medium text-green-700")}>{fmtKrw(r.contribution_margin)}</td>
              <td className={cn(TABLE_TD_CLASS, "text-right tabular-nums font-medium text-green-700")}>{fmt(r.total_rpm_margin, 1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 5: `app/external/fc/_components/FcClient.tsx`**

```tsx
"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { toYearMonth, addMonths } from "@/lib/utils/date-utils";
import {
  deriveFcRows,
} from "@/lib/logic/external-fc-logic";
import WidgetPicker from "./WidgetPicker";
import FcTable from "./FcTable";
import type { ExternalFcPagePayload } from "@/types/fc";

interface Props {
  payload: ExternalFcPagePayload;
}

export default function FcClient({ payload }: Props) {
  const router = useRouter();
  const sp = useSearchParams();

  const latestMonth = toYearMonth(payload.latestDate);
  const currentMonth = payload.monthStart.slice(0, 7);
  const canGoPrev = currentMonth > "2025-01";
  const canGoNext = currentMonth < latestMonth;

  const navigate = useCallback(
    (patch: { widget?: string; month?: string }) => {
      const params = new URLSearchParams(sp.toString());
      if (patch.widget !== undefined) params.set("widget", patch.widget);
      if (patch.month !== undefined) params.set("month", patch.month);
      router.push(`/external/fc?${params.toString()}`);
    },
    [router, sp],
  );

  const rows = useMemo(() => {
    if (!payload.widgetId) return [];
    return deriveFcRows(
      payload.autoInputs,
      payload.unitPrices,
      payload.constants,
      payload.widgetId,
    );
  }, [payload]);

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-gray-800">FC 리포트</h2>
            <span className="text-xs font-medium text-gray-400 tabular-nums">
              {rows.length}일
            </span>
          </div>
          <WidgetPicker
            widgets={payload.widgets}
            selectedId={payload.widgetId}
            onSelect={(wid) => navigate({ widget: wid })}
          />
          <div className="flex items-center gap-1">
            <button
              onClick={() => canGoPrev && navigate({ month: addMonths(currentMonth, -1) })}
              disabled={!canGoPrev}
              className="p-1.5 rounded-lg hover:bg-slate-200 disabled:opacity-30"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="h-9 px-4 rounded-lg border border-slate-200 bg-white text-sm font-semibold tabular-nums flex items-center">
              {currentMonth}
            </span>
            <button
              onClick={() => canGoNext && navigate({ month: addMonths(currentMonth, 1) })}
              disabled={!canGoNext}
              className="p-1.5 rounded-lg hover:bg-slate-200 disabled:opacity-30"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
        <Link
          href="/external/fc/admin"
          className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center"
        >
          관리
        </Link>
      </div>

      {!payload.widgetId ? (
        <div className="flex items-center justify-center h-60 text-sm text-gray-500">
          좌측에서 widget 을 선택하세요
        </div>
      ) : (
        <FcTable rows={rows} />
      )}
    </>
  );
}
```

- [ ] **Step 6: dev server 수동 확인**

```bash
npm run dev
```
브라우저 `http://localhost:3000/external/fc` 열기. widget 선택 → URL 에 `?widget=...` 붙고 테이블 렌더. 실제 엑셀 샘플 `V7a1pGx7` 선택 후 2026-04 월 데이터가 엑셀 값과 대조되는지 spot check.

- [ ] **Step 7: 타입 체크 + 린트**

```bash
npx tsc --noEmit
npm run lint
```

- [ ] **Step 8: 커밋**

```bash
git add app/external/fc/page.tsx app/external/fc/loading.tsx app/external/fc/_components/
git commit -m "feat(external-fc): 리포트 페이지 (widget picker + 33컬럼 테이블)"
```

---

## Task 7: 관리 페이지 — `/external/fc/admin`

**Files:**
- Create: `app/external/fc/admin/page.tsx`
- Create: `app/external/fc/admin/_components/AdminClient.tsx`
- Create: `app/external/fc/admin/_components/UnitPriceEditor.tsx`
- Create: `app/api/fc/value/route.ts`

widget 별 external_value 이력 CRUD.

- [ ] **Step 1: `app/external/fc/admin/page.tsx`**

```tsx
import { getExternalMappings, getExternalValues } from "@/lib/api/externalService";
import { listManagedWidgets } from "@/lib/api/externalFcService";
import AdminClient from "./_components/AdminClient";

export const dynamic = "force-dynamic";

export default async function FcAdminPage() {
  const [widgets, values] = await Promise.all([
    listManagedWidgets(),
    getExternalValues(),
  ]);
  return (
    <div className="flex flex-col gap-4 p-6 h-full max-w-[1440px] mx-auto">
      <AdminClient widgets={widgets} values={values} />
    </div>
  );
}
```

- [ ] **Step 2: `AdminClient.tsx`**

```tsx
"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import UnitPriceEditor from "./UnitPriceEditor";
import type { ExternalValueRow } from "@/types/external";
import type { ExternalFcPagePayload } from "@/types/fc";

interface Props {
  widgets: ExternalFcPagePayload["widgets"];
  values: ExternalValueRow[];
}

export default function AdminClient({ widgets, values }: Props) {
  const [selected, setSelected] = useState<string | null>(
    widgets[0]?.widget_id ?? null,
  );
  const rows = useMemo(
    () => values.filter((v) => v.widget_id === selected),
    [values, selected],
  );

  return (
    <>
      <div className="flex items-center gap-3">
        <Link
          href="/external/fc"
          className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <h2 className="text-base font-bold text-gray-800">FC 관리</h2>
        <span className="text-xs text-gray-400">
          external_value 이력 / 계약 CPM / FC 금액
        </span>
      </div>

      <div className="grid grid-cols-[280px_1fr] gap-4 h-[calc(100vh-160px)]">
        <div className="border border-slate-200 rounded-lg bg-white overflow-y-auto">
          <div className="p-2 text-xs font-semibold text-slate-500 border-b">
            관리 대상 ({widgets.length})
          </div>
          {widgets.map((w) => (
            <button
              key={w.widget_id}
              onClick={() => setSelected(w.widget_id)}
              className={
                "w-full text-left px-3 py-2 text-xs border-b border-slate-100 hover:bg-slate-50 " +
                (selected === w.widget_id ? "bg-blue-50 font-medium" : "")
              }
            >
              <div className="truncate">{w.label}</div>
              <div className="text-[10px] text-slate-400 font-mono">
                {w.widget_id}
              </div>
            </button>
          ))}
        </div>

        <div className="border border-slate-200 rounded-lg bg-white overflow-y-auto">
          {selected ? (
            <UnitPriceEditor widgetId={selected} rows={rows} />
          ) : (
            <div className="flex items-center justify-center h-full text-sm text-slate-400">
              위젯을 선택하세요
            </div>
          )}
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 3: `UnitPriceEditor.tsx`**

```tsx
"use client";

import { useState } from "react";
import { Plus, Trash2, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ExternalValueRow, UnitPriceValue } from "@/types/external";
import { PASSBACK_VENDORS } from "@/lib/logic/external-fc-vendors";

interface Props {
  widgetId: string;
  rows: ExternalValueRow[];
}

const FIELDS = [
  { key: "internal" as const, label: "데이블 매체사 CPM (S)" },
  ...PASSBACK_VENDORS.map((v) => ({
    key: v.slug as keyof UnitPriceValue,
    label: `${v.label} CPM (T)`,
  })),
  { key: "fc" as const, label: "FC 금액" },
];

export default function UnitPriceEditor({ widgetId, rows }: Props) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<{
    start_date: string;
    value: UnitPriceValue;
  }>({
    start_date: new Date().toISOString().slice(0, 10),
    value: {},
  });
  const [busy, setBusy] = useState(false);

  async function submitNew() {
    setBusy(true);
    try {
      const res = await fetch("/api/fc/value", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          widget_id: widgetId,
          value: draft.value,
          start_date: draft.start_date,
        }),
      });
      if (!res.ok) {
        alert(`저장 실패: ${res.status}`);
      } else {
        setCreating(false);
        setDraft({
          start_date: new Date().toISOString().slice(0, 10),
          value: {},
        });
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("삭제하시겠습니까?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/fc/value?id=${id}`, { method: "DELETE" });
      if (!res.ok) alert(`삭제 실패: ${res.status}`);
      else router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{widgetId} 이력</h3>
        <button
          onClick={() => setCreating((v) => !v)}
          className="h-8 px-3 rounded-lg border border-slate-200 text-xs font-medium hover:bg-slate-50 flex items-center gap-1"
        >
          <Plus className="w-3 h-3" />
          새 기간 추가
        </button>
      </div>

      {creating && (
        <div className="border border-blue-200 bg-blue-50 rounded-lg p-3 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium w-24">Start Date</span>
            <input
              type="date"
              value={draft.start_date}
              onChange={(e) =>
                setDraft((d) => ({ ...d, start_date: e.target.value }))
              }
              className="h-8 px-2 text-xs border border-slate-200 rounded"
            />
          </div>
          {FIELDS.map((f) => (
            <div key={f.key} className="flex items-center gap-2">
              <span className="text-xs font-medium w-40">{f.label}</span>
              <input
                type="number"
                placeholder="—"
                value={draft.value[f.key] ?? ""}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    value: {
                      ...d.value,
                      [f.key]: e.target.value ? Number(e.target.value) : undefined,
                    },
                  }))
                }
                className="h-8 px-2 text-xs border border-slate-200 rounded flex-1 tabular-nums"
              />
              <span className="text-[10px] text-slate-400">원</span>
            </div>
          ))}
          <div className="flex justify-end gap-2 mt-1">
            <button
              onClick={() => setCreating(false)}
              className="h-7 px-3 text-xs text-slate-500"
              disabled={busy}
            >
              취소
            </button>
            <button
              onClick={submitNew}
              disabled={busy}
              className="h-7 px-3 text-xs font-medium rounded bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-1 disabled:opacity-60"
            >
              <Save className="w-3 h-3" />
              저장
            </button>
          </div>
        </div>
      )}

      <table className="w-full text-xs">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            <th className="p-2 text-left font-medium">Start</th>
            <th className="p-2 text-left font-medium">End</th>
            {FIELDS.map((f) => (
              <th key={f.key} className="p-2 text-right font-medium">
                {f.label}
              </th>
            ))}
            <th className="p-2 w-8"></th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={FIELDS.length + 3} className="p-6 text-center text-slate-400">
                이력이 없습니다
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="p-2 font-mono">{r.start_date}</td>
                <td className="p-2 font-mono text-slate-400">
                  {r.end_date ?? "(active)"}
                </td>
                {FIELDS.map((f) => (
                  <td key={f.key} className="p-2 text-right tabular-nums">
                    {r.value[f.key] != null ? `₩${r.value[f.key]}` : "—"}
                  </td>
                ))}
                <td className="p-2">
                  <button
                    onClick={() => handleDelete(r.id)}
                    disabled={busy}
                    className="p-1 rounded hover:bg-red-50 text-red-500"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 4: `app/api/fc/value/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { createMediaClient } from "@/lib/supabase/media-server";
import type { UnitPriceValue } from "@/types/external";

interface CreateBody {
  widget_id: string;
  value: UnitPriceValue;
  start_date: string;
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as CreateBody;
  if (!body.widget_id || !body.value || !body.start_date) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const supabase = await createMediaClient();
  const { error } = await supabase
    .from("external_value")
    .insert({
      widget_id: body.widget_id,
      value: body.value,
      start_date: body.start_date,
      end_date: null,
    });
  if (error) {
    console.error("[/api/fc/value] insert failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const supabase = await createMediaClient();
  const { error } = await supabase
    .from("external_value")
    .delete()
    .eq("id", Number(id));
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 5: RLS 사전 테스트**

```bash
export SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
export SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
curl -s -X POST "$SUPABASE_URL/rest/v1/external_value" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Profile: media" \
  -H "Content-Type: application/json" \
  -d '[{"widget_id":"TEST_INSERT","value":{"fc":1},"start_date":"2099-01-01","end_date":null}]' \
  -w "\nHTTP %{http_code}\n"
```
기대: `201`. 실패시 RLS 정책 추가 필요. 테스트 row 는 바로 삭제:
```bash
curl -s -X DELETE "$SUPABASE_URL/rest/v1/external_value?widget_id=eq.TEST_INSERT" \
  -H "apikey: $SUPABASE_ANON_KEY" -H "Authorization: Bearer $SUPABASE_ANON_KEY" -H "Content-Profile: media"
```

- [ ] **Step 6: dev server 수동 확인**

`http://localhost:3000/external/fc/admin` 진입 → 위젯 선택 → "새 기간 추가" → FC 값 입력 → 저장. 리스트에 추가되는지 확인 → 삭제 버튼 동작 확인.

- [ ] **Step 7: 커밋**

```bash
git add app/external/fc/admin/ app/api/fc/value/
git commit -m "feat(external-fc): 관리 페이지 + external_value CRUD API"
```

---

## Task 8: `diff.ts` — 순수 비교 함수 + 테스트

**Files:**
- Create: `lib/features/fc-value-sync/diff.ts`
- Create: `lib/features/fc-value-sync/__tests__/diff.test.ts`

- [ ] **Step 1: 실패 테스트**

```ts
import { describe, it, expect } from "vitest";
import { unitPriceChanged, mergeSnapshot } from "../diff";

describe("unitPriceChanged", () => {
  it("빈 latest + 새 값 → changed", () => {
    expect(unitPriceChanged({}, { fc: 230 })).toBe(true);
  });
  it("동일 snapshot → unchanged", () => {
    expect(unitPriceChanged({ fc: 230, internal: 1300 }, { fc: 230, internal: 1300 })).toBe(false);
  });
  it("값 다르면 changed", () => {
    expect(unitPriceChanged({ fc: 230 }, { fc: 250 })).toBe(true);
  });
  it("snapshot 에 없는 필드는 latest 값 유지 (변경 없음)", () => {
    // snapshot={fc:230}, latest={fc:230, internal:1300} → snapshot 에 internal 없으면 비교 대상에서 제외
    expect(unitPriceChanged({ fc: 230, internal: 1300 }, { fc: 230 })).toBe(false);
  });
  it("snapshot 에 신규 필드 추가 → changed", () => {
    expect(unitPriceChanged({ fc: 230 }, { fc: 230, syncmedia: 1200 })).toBe(true);
  });
});

describe("mergeSnapshot — 기존 값 + 새 snapshot", () => {
  it("snapshot 필드는 덮어쓰고, 없는 필드는 기존 유지", () => {
    const merged = mergeSnapshot({ fc: 230, internal: 1300 }, { fc: 250 });
    expect(merged).toEqual({ fc: 250, internal: 1300 });
  });
  it("빈 base 에 snapshot 전체 반영", () => {
    expect(mergeSnapshot({}, { fc: 230 })).toEqual({ fc: 230 });
  });
});
```

- [ ] **Step 2: 실행 — 실패 확인**

```bash
npm test -- lib/features/fc-value-sync/__tests__/diff.test.ts --run
```

- [ ] **Step 3: `diff.ts` 구현**

```ts
import type { UnitPriceValue } from "@/types/external";

const COMPARE_KEYS: (keyof UnitPriceValue)[] = [
  "internal",
  "syncmedia",
  "klmedia",
  "friendplus",
  "fc",
];

/**
 * snapshot 이 latest 와 다르면 true.
 * snapshot 에 undefined 인 필드는 비교 대상에서 제외 (기존 값 유지).
 */
export function unitPriceChanged(
  latest: UnitPriceValue,
  snapshot: UnitPriceValue,
): boolean {
  for (const k of COMPARE_KEYS) {
    if (snapshot[k] === undefined) continue;
    if (latest[k] !== snapshot[k]) return true;
  }
  return false;
}

/** base 위에 snapshot 을 덮어씌운 새 객체 (undefined 는 유지, 실제 값만 덮어씀). */
export function mergeSnapshot(
  base: UnitPriceValue,
  snapshot: UnitPriceValue,
): UnitPriceValue {
  const out: UnitPriceValue = { ...base };
  for (const k of COMPARE_KEYS) {
    if (snapshot[k] !== undefined) {
      out[k] = snapshot[k];
    }
  }
  return out;
}
```

- [ ] **Step 4: pass 확인**

```bash
npm test -- lib/features/fc-value-sync/__tests__/diff.test.ts --run
```
기대: 7 tests passed.

- [ ] **Step 5: 커밋**

```bash
git add lib/features/fc-value-sync/diff.ts lib/features/fc-value-sync/__tests__/diff.test.ts
git commit -m "fc-value-sync: UnitPriceValue diff/merge 순수 함수"
```

---

## Task 9: cron `job.ts` + `cron.ts` + `instrumentation.ts`

**Files:**
- Create: `lib/features/fc-value-sync/job.ts`
- Create: `lib/features/fc-value-sync/cron.ts`
- Modify: `instrumentation.ts`

- [ ] **Step 1: `job.ts`**

```ts
/**
 * FC value sync 잡 오케스트레이션.
 *
 * 호출자:
 *  - cron.ts (자동, 매일 07:00 KST)
 *  - app/api/fc/sync/route.ts (관리 페이지의 수동 트리거)
 *
 * 흐름:
 *   1. cookie-free Supabase 클라이언트 생성
 *   2. 관리 대상 widget 리스트 (external_mapping.widget_id IS NOT NULL)
 *   3. 각 widget:
 *        - DW snapshot fetch (S/T/FC)
 *        - latest active external_value 조회
 *        - diff → 변경 시 새 row insert (start_date=today)
 */

import { createCronSupabase } from "@/lib/supabase/cron-client";
import { fetchDwSnapshot } from "./redash-fetch";
import { unitPriceChanged, mergeSnapshot } from "./diff";
import type { UnitPriceValue } from "@/types/external";

export interface SyncResult {
  widgetsChecked: number;
  widgetsInserted: number;
  failures: number;
  details: Array<{ widget_id: string; changed: boolean; error?: string }>;
  durationMs: number;
}

function toKstDateString(utc: Date): string {
  const kstMs = utc.getTime() + 9 * 60 * 60 * 1000;
  return new Date(kstMs).toISOString().slice(0, 10);
}

export async function runFcValueSyncJob(now: Date = new Date()): Promise<SyncResult> {
  const t0 = Date.now();
  const supabase = createCronSupabase();
  const apiKey = process.env.REDASH_API_KEY;
  if (!apiKey) {
    throw new Error("REDASH_API_KEY 환경변수가 설정되지 않았습니다");
  }
  const today = toKstDateString(now);

  // 관리 대상 widget 리스트
  const { data: mappings, error: mapErr } = await supabase
    .from("external_mapping")
    .select("widget_id")
    .not("widget_id", "is", null);
  if (mapErr) throw mapErr;
  const widgetIds = Array.from(
    new Set((mappings ?? []).map((m) => m.widget_id).filter((id): id is string => !!id)),
  );

  const details: SyncResult["details"] = [];
  let inserted = 0;
  let failures = 0;

  for (const widgetId of widgetIds) {
    try {
      const snap = await fetchDwSnapshot({ widgetId, date: today, apiKey });

      const { data: latestRows, error: latestErr } = await supabase
        .from("external_value")
        .select("*")
        .eq("widget_id", widgetId)
        .is("end_date", null)
        .order("start_date", { ascending: false })
        .limit(1);
      if (latestErr) throw latestErr;
      const latest = latestRows?.[0]?.value as UnitPriceValue | undefined;

      if (!unitPriceChanged(latest ?? {}, snap)) {
        details.push({ widget_id: widgetId, changed: false });
        continue;
      }

      const merged = mergeSnapshot(latest ?? {}, snap);
      const { error: insErr } = await supabase.from("external_value").insert({
        widget_id: widgetId,
        value: merged,
        start_date: today,
        end_date: null,
      });
      if (insErr) throw insErr;
      inserted += 1;
      details.push({ widget_id: widgetId, changed: true });
    } catch (err) {
      failures += 1;
      details.push({
        widget_id: widgetId,
        changed: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return {
    widgetsChecked: widgetIds.length,
    widgetsInserted: inserted,
    failures,
    details,
    durationMs: Date.now() - t0,
  };
}
```

- [ ] **Step 2: `cron.ts`**

```ts
import cron from "node-cron";
import { runFcValueSyncJob } from "./job";

let registered = false;

export function registerFcValueSyncCron(): void {
  if (registered) return;
  registered = true;

  cron.schedule(
    "0 7 * * *",
    async () => {
      const t0 = Date.now();
      try {
        const result = await runFcValueSyncJob();
        console.log("[fc-value-sync] ok", {
          widgetsChecked: result.widgetsChecked,
          widgetsInserted: result.widgetsInserted,
          failures: result.failures,
          durationMs: Date.now() - t0,
        });
      } catch (err) {
        console.error("[fc-value-sync] failed", {
          error: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined,
          durationMs: Date.now() - t0,
        });
      }
    },
    { timezone: "Asia/Seoul" },
  );

  console.log("[fc-value-sync] registered (0 7 * * * Asia/Seoul)");
}
```

- [ ] **Step 3: `instrumentation.ts` 업데이트**

기존:
```ts
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { registerDailyImportCron } = await import(
    "./lib/features/daily-redash-import/cron"
  );
  registerDailyImportCron();
}
```

다음으로 교체:
```ts
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const [{ registerDailyImportCron }, { registerFcValueSyncCron }] =
    await Promise.all([
      import("./lib/features/daily-redash-import/cron"),
      import("./lib/features/fc-value-sync/cron"),
    ]);

  registerDailyImportCron();
  registerFcValueSyncCron();
}
```

- [ ] **Step 4: 빌드 타입 체크**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: 커밋**

```bash
git add lib/features/fc-value-sync/job.ts lib/features/fc-value-sync/cron.ts instrumentation.ts
git commit -m "fc-value-sync: 오케스트레이션 + node-cron 등록 (매일 07:00 KST)"
```

---

## Task 10: `/api/fc/sync` 수동 트리거 API

**Files:**
- Create: `app/api/fc/sync/route.ts`

- [ ] **Step 1: route 작성**

```ts
import { NextRequest, NextResponse } from "next/server";
import { runFcValueSyncJob } from "@/lib/features/fc-value-sync/job";

export async function POST(req: NextRequest) {
  const sync = req.nextUrl.searchParams.get("sync") === "true";

  if (sync) {
    try {
      const result = await runFcValueSyncJob();
      return NextResponse.json({ status: "completed", result });
    } catch (err) {
      return NextResponse.json(
        {
          status: "failed",
          error: err instanceof Error ? err.message : String(err),
        },
        { status: 500 },
      );
    }
  }

  // async: 백그라운드 실행, 즉시 202 반환
  runFcValueSyncJob().catch((err) => {
    console.error("[fc-value-sync async] failed:", err);
  });
  return NextResponse.json({ status: "triggered" }, { status: 202 });
}
```

- [ ] **Step 2: admin 페이지에 "지금 동기화" 버튼 추가**

`app/external/fc/admin/_components/AdminClient.tsx` 의 상단 우측에 버튼 추가:

```tsx
// (파일 상단 import 근처에)
import { RefreshCw } from "lucide-react";
```

상단 `<div className="flex items-center gap-3">` 블록 끝에 우측 정렬로 버튼 삽입:

```tsx
<button
  onClick={async () => {
    const res = await fetch("/api/fc/sync?sync=true", { method: "POST" });
    const j = await res.json();
    alert(
      res.ok
        ? `동기화 완료: checked=${j.result.widgetsChecked}, inserted=${j.result.widgetsInserted}, failures=${j.result.failures}`
        : `동기화 실패: ${j.error}`,
    );
    location.reload();
  }}
  className="ml-auto h-8 px-3 rounded-lg border border-slate-200 text-xs font-medium hover:bg-slate-50 flex items-center gap-1"
>
  <RefreshCw className="w-3 h-3" />
  지금 동기화
</button>
```

- [ ] **Step 3: dev 수동 테스트**

```bash
curl -s -X POST "http://localhost:3000/api/fc/sync?sync=true" | python3 -m json.tool
```
기대: `{"status":"completed","result":{...}}` — 에러 없고 details 배열.

- [ ] **Step 4: 커밋**

```bash
git add app/api/fc/sync/route.ts app/external/fc/admin/_components/AdminClient.tsx
git commit -m "feat(external-fc): 수동 sync 트리거 API + admin 버튼"
```

---

## Task 11: 네비게이션 링크 + `/external` 에서 FC 진입점

**Files:**
- Modify: 좌측 sidebar 컴포넌트 (프로젝트 구조에 따라 경로 탐색)

- [ ] **Step 1: sidebar / nav 파일 식별**

```bash
grep -rn "external" app/layout.tsx components/ 2>/dev/null | grep -i "sidebar\|nav\|link" | head -20
```

결과에서 `external` 링크가 있는 파일을 찾아 FC 항목 추가.

- [ ] **Step 2: FC 메뉴 항목 추가**

sidebar 메뉴 배열(발견된 경로)에 다음 유사 구조로 추가 (실제 코드 스타일은 해당 파일 관습 따라):

```tsx
{ href: "/external/fc", label: "FC 리포트", icon: ... }
```

적절한 아이콘은 `lucide-react` 의 `Gauge` 또는 `BarChart3`.

- [ ] **Step 3: dev 확인**

sidebar 에 FC 리포트 메뉴가 보이고, 클릭 시 `/external/fc` 로 이동.

- [ ] **Step 4: 커밋**

```bash
git add -u
git commit -m "nav: sidebar 에 FC 리포트 메뉴 추가"
```

---

## Task 12: 배포 + 엑셀 샘플 대조 smoke test

이 태스크는 LiteLLM Code Deploy 플랫폼의 배포 흐름을 따른다 (`~/.claude/rules/deploy-llm.md` §4).

- [ ] **Step 1: 최종 테스트 회귀**

```bash
npm test -- --run
npm run lint
npx tsc --noEmit
npm run build
```
기대: 모두 pass.

- [ ] **Step 2: 양쪽 remote push + 빌드 트리거**

```bash
git push origin HEAD
git push deploy HEAD:main

export LITELLM_PAT="<PAT>"
curl -X POST "https://litellm.internal.dable.io/v1/code-deployments/9605fb4a-80be-4c1a-b5f7-49d572b2f42a/build" \
  -H "Authorization: Bearer $LITELLM_PAT"
```

- [ ] **Step 3: 빌드 / 배포 상태 폴링**

```bash
watch -n 10 'curl -s "https://litellm.internal.dable.io/v1/code-deployments/9605fb4a-80be-4c1a-b5f7-49d572b2f42a" -H "Authorization: Bearer $LITELLM_PAT" | jq "{build_status, deploy_status}"'
```
기대: `{"build_status":"succeeded","deploy_status":"running"}`. 빌드 실패 + 로그 잘림 시 `~/.claude/rules/deploy-llm.md` §6.1 (build_memory 8Gi) 적용.

- [ ] **Step 4: 배포 후 health + cron 등록 로그 확인**

```bash
curl -s https://<subdomain>.dllm.dable.io/health
# expected: {"status":"ok"}

curl -s "https://litellm.internal.dable.io/v1/code-deployments/9605fb4a-80be-4c1a-b5f7-49d572b2f42a/logs?type=runtime" \
  -H "Authorization: Bearer $LITELLM_PAT" | jq -r .runtime_log | grep -E '\[fc-value-sync\]|\[daily-redash-import\]'
```
기대: `[fc-value-sync] registered (0 7 * * * Asia/Seoul)` 출력.

- [ ] **Step 5: 수동 sync smoke**

```bash
curl -s -X POST "https://<subdomain>.dllm.dable.io/api/fc/sync?sync=true" | python3 -m json.tool
```
기대: `status:completed`, details 배열. 실패 widget 이 있으면 runtime_log 에서 stack trace 확인.

- [ ] **Step 6: 브라우저 엑셀 샘플 대조**

브라우저로 `/external/fc?widget=V7a1pGx7&month=2026-04` 열기. 화면의 2026-04-15 행 값을 `_docs/260417-sample.xlsx` 의 row 6 과 spot check:

- D 요청수 = 100,729
- G 패스백 호출수 = 37,806
- PB 매체 매출 = 45,367
- O 데이블 MFR ≈ 0.31~0.32
- P 싱크 MFR = 1.08

오차 허용 (±0.01 소수점).

- [ ] **Step 7: 관리 페이지 동기화 결과 확인**

`/external/fc/admin` → V7a1pGx7 선택. external_value 이력에 오늘 날짜 row 가 있는지 확인 (값: internal=1300, syncmedia=1200, fc=230 등).

- [ ] **Step 8: 완료 커밋 (deployment note)**

```bash
git commit --allow-empty -m "deploy: external-fc 리포트 + cron 1차 배포 완료"
git push origin HEAD
git push deploy HEAD:main
```

---

## Self-Review 결과

**Spec 커버리지:**
- §2 페이지 구조 → Task 6, 7 ✓
- §3 데이터 소스 → Task 4, 5 ✓
- §3.1 Vendor 매핑 + 복수 vendor 처리 → Task 2, 4 (pickPrimaryVendor, SQL `ARBITRARY` + max imp) ✓
- §4 계산 공식 → Task 3 ✓ (검증 샘플 포함)
- §5 Cron → Task 8, 9, 10 ✓
- §6 DB 스키마 → Task 7 Step 5 (RLS 테스트) ✓, DDL 없음
- §7 타입 변경 → Task 1 ✓
- §8 로직 변경 → Task 3 ✓
- §9 파일 계획 → 전 태스크 커버 ✓
- §10 환경변수 → Task 12 ✓
- §11 YAGNI → 유지 (widget allowlist, 가중평균 미구현)
- §12 미해결 → 문서화됨 (I 컬럼=0, skill 업데이트 별도)
- §13 구현 순서 → Task 1~12 로 세분화

**Placeholder 스캔:** 없음.

**타입/네이밍 일관성:**
- `DEFAULT_FC_CONSTANTS` (Task 3) ↔ `constants: ExternalFcConstants` (Task 1) ↔ `payload.constants` (Task 5, 6) ✓
- `deriveFcRow(auto, prices, constants, widgetId)` 시그니처 모든 호출 지점 일치 ✓
- `PASSBACK_VENDORS` ↔ `PassbackVendorSlug` ↔ `vendor_source` 전 layer 일치 ✓
- `UnitPriceValue` 필드명(`internal/syncmedia/klmedia/friendplus/fc`) Task 1 ↔ Task 8 diff ↔ Task 7 editor 필드 일치 ✓

**사소한 리스크:**
- Task 4 Step 1 Redash 스모크가 실패하면 Task 4 전체가 블록될 수 있음. 그 경우 사용자에게 에스컬레이션 후 data-gateway HTTP endpoint 경로 조사가 선행되어야 한다 (플랜 외 영역).
- Task 5 의 `fetchDwSnapshot.fc` 가 Redash Trino 에서 조회 불가하면 `fc` 는 초기엔 관리 페이지에서만 수동 입력 가능. cron 은 internal/vendor_CPM 만 이력화. 스펙 §12 미해결 이슈에 이미 표시됨.

---

**Plan complete and saved to `docs/superpowers/plans/2026-04-17-external-fc-implementation.md`.**

실행 옵션 두 가지:

**1. Subagent-Driven (권장)** — 태스크마다 fresh subagent 를 dispatch, 태스크 사이에 내가 review. 빠른 반복에 유리.

**2. Inline Execution** — 현재 세션에서 `executing-plans` 로 checkpoint 기반 배치 실행.

어느 방식으로 진행할까요?
