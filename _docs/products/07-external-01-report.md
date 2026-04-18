# External Report (External 섹션)

## Document info
- **Created:** 2026-03-26 10:00:00
- **Last updated:** 2026-03-26 10:00:00

## Revision history
| Date | Description |
|------|-------------|
| 2026-03-26 10:00:00 | Initial version. |

## Covered files
| Path | Role |
|------|------|
| `@/app/external/page.tsx` | 서버 페이지 (Phase 2 fetch, 날짜 범위 파싱) |
| `@/app/external/_components/ExternalClient.tsx` | 메인 클라이언트 (월 전환, React Query, 동기화 트리거) |
| `@/app/external/_components/SummaryCards.tsx` | KPI 요약 카드 (3개: 노출, 매출, 지면 수) |
| `@/app/external/_components/ExternalTable.tsx` | 결합 데이터 테이블 (Internal + External + Total) |
| `@/app/external/_components/ExternalSyncModal.tsx` | 동기화 모달 (3단계: 확인 → 진행 → 결과) |
| `@/app/external/_components/DatePicker.tsx` | 캘린더 날짜 선택 (동기화 모달용) |
| `@/app/external/_components/MonthPicker.tsx` | 월 드롭다운 선택기 |
| `@/lib/api/externalService.ts` | 데이터 fetch + 외부 API 호출 + DB upsert |
| `@/lib/logic/external-logic.ts` | 비즈니스 로직 (결합, CPM 감지, 요약 계산) |
| `@/app/api/external/sync/route.ts` | API 라우트 (외부 데이터 동기화) |
| `@/app/api/external/data/route.ts` | API 라우트 (데이터 조회) |
| `@/app/api/external/detect-prices/route.ts` | API 라우트 (CPM 단가 기간 감지) |
| `@/types/external.ts` | 타입 정의 (External 전용) |

## 1. Overview
- **Path:** `app/external/`
- **Purpose:** 외부 매체(KL Media, SyncMedia)의 광고 성과와 내부 성과를 결합하여 월별로 표시하는 리포트. 외부 데이터 동기화, CPM 단가 감지, 소스별 비교 기능 제공.

## 2. Key Props & State

### 서버 → 클라이언트

```typescript
interface ExternalPagePayload {
  externalRows: ExternalDailyRow[];   // 외부 일별 데이터
  mappings: ExternalMappingRow[];     // 외부→내부 매핑
  unitPrices: ExternalValueRow[];     // CPM 단가 기간
  internalRows: DailyRawRow[];        // 매핑된 위젯의 내부 데이터
  latestDate: string;                 // DB 최신 날짜
}
```

### 클라이언트 State

| State | Type | Default | Purpose |
|-------|------|---------|---------|
| `selectedMonth` | `string` | latestDate 기준 월 | 표시 월 (YYYY-MM) |
| `pickerOpen` | `boolean` | `false` | MonthPicker 드롭다운 열림 |
| `syncModalOpen` | `boolean` | `false` | 동기화 모달 열림 |

### React Query

```typescript
useQuery({
  queryKey: queryKeys.external.daily(start, end),
  queryFn: ({ signal }) => fetchExternalData(start, end, signal),
  initialData: payload (현재 월과 일치 시),
})
```

## 3. Core Logic & Interactions

### 2+3 Phase 로딩

```
Phase 2 (서버 await):
  getExternalPagePayload(start?, end?)
    → getLatestDataDate()
    → Promise.all([
        getExternalDaily(start, end),
        getExternalMappings(),
        getExternalValues()
      ])
    → getInternalDailyForWidgets(mappedWidgetIds, start, end)

Phase 3 (클라이언트):
  월 전환 시 → useQuery refetch → POST /api/external/data
```

### 데이터 결합 파이프라인

```
combineExternalWithInternal(externalRows, mappings, internalRows, unitPrices)
  1. mappingLookup = "source:externalKey" → MappingRow
  2. internalLookup = "date:widgetId" → 집계된 내부 메트릭
  3. unitPriceLookup = widgetId → UnitPriceValue[]
  4. 외부 행마다:
     → 매핑 매칭 (source + external_key)
     → 내부 메트릭 조회 (widget_id + date)
     → 단가 매칭 (widget_id + date 범위)
     → ExternalCombinedRow 생성
```

### 테이블 구조 (ExternalTable)

12개 컬럼, 3개 그룹:

| 그룹 | 컬럼 | 색상 |
|------|------|------|
| Base | date, source (배지), label | - |
| Internal (파랑) | impressions, CPM, revenue | bg-blue-50 |
| External (주황) | impressions, CPM, revenue | bg-orange-50 |
| Total (초록) | impressions, revenue | bg-green-50 |

- 11개 필드 정렬 가능 (cycle: unsorted → asc → desc)
- 라벨 클릭 → 해당 라벨만 필터링 토글
- 기본 정렬: date DESC

### 소스 배지 색상

| 소스 | 배지 색상 |
|------|-----------|
| KL Media | sky-50 / sky-700 |
| SyncMedia | purple-50 / purple-700 |

### 요약 카드 (SummaryCards)

| 카드 | 아이콘 | 색상 | 표시 |
|------|--------|------|------|
| 총 노출수 | Eye | Indigo | 전체 + 소스별 분리 |
| 총 매출 | Banknote | Emerald | 전체 + 소스별 분리 |
| 지면 수 | LayoutGrid | Violet | 고유 라벨 수 + 소스별 |

### 동기화 플로우 (ExternalSyncModal)

```
Step 1: confirm (날짜 범위 선택 + 검증)
  → startDate, endDate 입력
  → 검증: 둘 다 필수, startDate ≤ endDate

Step 2: progress (로딩 스피너)
  → POST /api/external/sync { startDate, endDate }
  → 서버:
      fetchKlMediaData() + fetchSyncMediaData() (병렬)
      → klMediaToInsert() / syncMediaToInsert() (변환)
      → upsertExternalDaily() (병렬 upsert)
      → backfillMappings() (새 키 자동 매핑 생성)

Step 3: result (성공/실패)
  → 성공: { klmedia: N건, syncMedia: M건 }
  → 실패: 에러 메시지 표시
  → onSyncComplete() → React Query refetch + toast
```

### CPM 단가 감지 (detect-prices)

```
POST /api/external/detect-prices { startDate, endDate, dryRun? }
  → getExternalDaily() + getExternalMappings()
  → detectCpmPeriods():
      위젯별 일별 CPM 계산 (revenue / imp * 1000)
      → 10원 단위 반올림
      → 동일 CPM 연속일 그룹핑 → 기간 생성
      → 마지막 기간: end_date = null (진행 중)
  → !dryRun: upsertExternalValues() → DB 저장
  → { periods, upserted }
```

### 월 전환

```
MonthPicker (12개월 그리드, 연도 네비게이션)
  → onSelect(YYYY-MM)
  → selectedMonth 변경
  → monthRange(YYYY-MM) → { start: YYYY-MM-01, end: YYYY-MM-DD }
  → useQuery refetch with new date range
  → combineExternalWithInternal() → computeExternalSummary()
```

## 4. AI Implementation Guide (For vibe coding)

### State → Action → Implementation

| State / condition | Meaning | Use this function / API | Where to implement |
|---|---|---|---|
| 월 전환 | 다른 월 데이터 조회 | useQuery refetch → `POST /api/external/data` | ExternalClient |
| 동기화 실행 | 외부 데이터 갱신 | `POST /api/external/sync` | ExternalSyncModal |
| CPM 감지 실행 | 단가 기간 자동 생성 | `POST /api/external/detect-prices` | API 호출 |
| 라벨 필터 | 특정 라벨만 표시 | filterLabel 상태 | ExternalTable |
| 테이블 정렬 | 컬럼 정렬 전환 | cycleSortDirection + compareNullable | ExternalTable |
| 새 소스 추가 | 새 외부 매체 | fetchXxxData() + xxxToInsert() | externalService.ts |
| 매핑 수정 | 외부↔내부 연결 | external_mapping 테이블 | externalService.ts |
| 새 테이블 컬럼 | 지표 추가 | ExternalCombinedRow 확장 | external-logic.ts + ExternalTable |

### Modification rules

- **새 외부 소스 추가**: `externalService.ts`에 fetcher + transformer 추가 → `syncExternalData()` 확장
- **테이블 컬럼 추가**: `external-logic.ts` `combineExternalWithInternal()` 확장 + `ExternalTable` 컬럼 추가
- **요약 카드 추가/수정**: `external-logic.ts` `computeExternalSummary()` + `SummaryCards` 수정
- **동기화 로직 변경**: `externalService.ts` `syncExternalData()` 수정
- **CPM 감지 로직 변경**: `external-logic.ts` `detectCpmPeriods()` 수정

### Dependencies
- `@/lib/logic/external-logic` — combineExternalWithInternal, computeExternalSummary, detectCpmPeriods
- `@/lib/api/externalService` — getExternalPagePayload, syncExternalData, upsertExternalValues
- `@/lib/queries/queryKeys` — queryKeys.external.daily
- `@/lib/queries/queryFns` — fetchExternalData
- `@/lib/utils/number-utils` — formatNumberForDisplay
- `@/lib/utils/sort-utils` — cycleSortDirection, compareNullable
- `@/lib/utils/date-utils` — toYearMonth, addMonths, getLastDayOfMonth
- `@/stores/useToastStore` — 동기화 결과 토스트
- `@/types/external` — ExternalSource, ExternalCombinedRow, ExternalPagePayload 등
