# Data Loading Architecture

전체 앱의 **데이터 로딩 전략, API 구조, React Query 캐싱, 클라이언트 처리 파이프라인, DOM 최적화**를 기술한다.

---

## 1. 3-Phase 로딩 전략

모든 데이터 페이지(Dashboard, Data-Board, MA Charts)는 동일한 3단계 패턴을 따른다.

```
Phase 1 (0ms)       loading.tsx skeleton 표시
Phase 2 (~200-300ms) page.tsx await quickPayload → 핵심 UI 즉시 렌더
Phase 3 (300-500ms)  Client Component useQuery → 백그라운드 완전 데이터 로드
```

### 핵심 원칙

- **Phase 3는 Server Component Promise로 전달하지 않는다.**
  RSC 스트림이 열려 있으면 다른 섹션으로의 네비게이션이 차단되기 때문이다.
- Phase 3는 항상 **Client Component에서 API Route를 호출**하여 가져온다.
- `force-dynamic`을 사용한다 (Supabase SSR 클라이언트가 cookies를 읽기 때문).

### 섹션별 Phase 2 vs Phase 3

| 섹션 | Phase 2 (await) | Phase 3 (client fetch) |
|------|-----------------|----------------------|
| **Dashboard** | 90 dates + totalData(90행) + weeks | serviceData (~18k행, 서비스별 90일) |
| **Data-Board** | 90 dates + service-level 14일(~700행) + holidays + weeks | widget-level 90일(~18k행) |
| **MA Charts** | 150 dates + service-level 35일(~1,750행) + holidays | service-level 150일(~7,500행) + widget data(on-demand) |

---

## 2. 서버 데이터 서비스 (`lib/api/`)

### 2-1. 공통 패턴

모든 서비스는 `createMediaClient()`로 Supabase SSR 클라이언트를 생성하고, `media` 스키마의 뷰를 조회한다.

**Per-Date 병렬 쿼리 패턴:**

```typescript
// 단일 .in("date", [90개]) 쿼리는 인덱스를 타지 못하고 full scan 발생 가능
// → 날짜별 .eq("date", date) 쿼리를 Promise.all로 병렬 실행
const results = await Promise.all(dates.map(date =>
  supabase.from(view).select(cols).eq("date", date).range(offset, offset + BATCH_SIZE - 1)
));
```

- 각 `.eq("date")` 쿼리는 `idx_daily_date` 인덱스를 직접 사용 → O(1) 스캔
- 90개 병렬 요청의 wall-clock time ≈ 가장 느린 단일 쿼리 (~100ms)
- 날짜당 BATCH_SIZE(1000행) 초과 시 내부 페이지네이션 자동 처리

**Two-Query 전략:**

| 상황 | 전략 | 이유 |
|------|------|------|
| Phase 2 (14일, ~700행) | `.in("date", dates)` 단일 쿼리 | 1000행 미만 → 안전 |
| Phase 3 (90일, ~18k행) | 날짜별 `.eq()` 병렬 쿼리 | 페이지네이션 불필요, 인덱스 보장 |

### 2-2. boardService.ts (Dashboard)

| 함수 | 쿼리 대상 | 반환 | 비고 |
|------|-----------|------|------|
| `getBoardAllDates(n=90)` | `v_dates` | `string[]` | 최신 날짜 n개 |
| `getFilteredClientIds(filters)` | `media.client` | `string[] \| null` | 검색/tier/owner 필터 → client_id 리스트 |
| `getTotalData(dates)` | `v_daily_total` | `DailyTotalRow[]` | 전사 일별 집계 (90행) |
| `getServiceData(dates, clientIds)` | `v_daily_by_service` | `DailyServiceRow[]` | 서비스별 일별 (per-date 병렬) |
| `getRefWeeks(oldest, newest)` | `ref_week` | `RefWeekRow[]` | 주차 정의 |

**getBoardQuickPayload(filters)** — Phase 2:

```
1. [병렬] getBoardAllDates(90) + getFilteredClientIds(filters)
2. [병렬] getTotalData(allDates) + getRefWeeks(oldest, newest)
→ { allDates, totalData, weeks, clientIds }
```

**getBoardServiceData(allDates, clientIds)** — Phase 3 (API Route에서 호출):

```
getServiceData(allDates, clientIds)
→ 90일 × 서비스별 = ~18,000행 (per-date 병렬)
```

### 2-3. dataBoardService.ts (Data-Board)

| 함수 | 쿼리 대상 | 반환 | 비고 |
|------|-----------|------|------|
| `getDataBoardDates(n=90)` | `v_dates` | `string[]` | 별도 getLatestDataDate 불필요 |
| `getRawDailyDataBatch(dates, filterType)` | 뷰 선택 | `DailyRawRow[]` | Phase 2 전용 (단일 `.in()` 쿼리) |
| `getRawDailyData(dates, filterType)` | 뷰 선택 | `DailyRawRow[]` | Phase 3 (per-date 병렬 + 페이지네이션) |
| `getHolidays(start, end)` | `ref_holiday` + JS 주말 계산 | `string[]` | 공휴일 + 주말 통합 |

**filterType별 뷰 선택:**

| filterType | 뷰 | 컬럼 | 일별 행 수 |
|------------|-----|------|-----------|
| `"service"` / `"client"` | `v_daily_by_service` | base 10컬럼 | ~50 |
| `"widget"` | `v_daily` | base + widget_id, widget_name | ~200 |

**getDataBoardQuickPayload()** — Phase 2:

```
1. getDataBoardDates(90)                           — sequential
2. [병렬] getRawDailyDataBatch(14일, "service")    — 단일 쿼리
         getHolidays(oldest, newest)
         getRefWeeks(oldest, newest)
→ { allDates, rawData, holidays, weeks }
```

**getDataBoardFullData(allDates)** — Phase 3 (API Route에서 호출):

```
getRawDailyData(allDates, "widget")
→ 90일 × widget-level = ~18,000행 (per-date 병렬)
```

### 2-4. maChartService.ts (MA Charts)

boardService의 `getBoardAllDates`와 `getServiceData`를 재사용한다.

| 함수 | 내용 |
|------|------|
| `getMaChartQuickPayload()` | 150 dates + 35일 service data + holidays |
| `getMaChartFullData(allDates)` | 150일 전체 service data |

**getMaChartQuickPayload()** — Phase 2:

```
1. getBoardAllDates(150)                           — sequential
2. [병렬] getServiceData(35일, null)
         getHolidays(oldest, newest)
→ { allDates, serviceData, holidays }
```

---

## 3. API Routes

Phase 3 데이터를 Client Component에서 가져오기 위한 POST 엔드포인트.

| Route | Method | Body | 내부 호출 | 반환 |
|-------|--------|------|-----------|------|
| `/api/dashboard/service-data` | POST | `{ dates, clientIds }` | `getServiceData()` | `DailyServiceRow[]` |
| `/api/data-board/full-data` | POST | `{ dates }` | `getDataBoardFullData()` | `DailyRawRow[]` |
| `/api/charts/ma/full-data` | POST | `{ dates }` | `getServiceData()` | `DailyServiceRow[]` |
| `/api/charts/widget-data` | POST | `{ dates }` | 인라인 per-date 병렬 | `DailyRawRow[]` |

모든 API Route는:
- `NextResponse.json(data)` 반환
- Supabase 에러 시 `500` 응답
- Body에서 dates 배열을 받아 서버 서비스 함수에 위임

---

## 4. React Query (TanStack Query v5) — SWR 캐싱

### 4-1. Provider 설정 (`app/providers.tsx`)

```typescript
new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 60 * 1000,        // 60분 (데이터는 하루 1회 업데이트)
      gcTime: 2 * 60 * 60 * 1000,       // 120분 (캐시 수명)
      refetchOnWindowFocus: false,       // 대용량 데이터 → 포커스 자동 refetch 안함
      retry: 1,
    },
  },
})
```

`app/layout.tsx`에서 `<Providers>`로 전체 앱을 래핑.

### 4-2. Query Key Factory (`lib/queries/queryKeys.ts`)

```typescript
queryKeys = {
  dashboard.serviceData(allDates, clientIds)   → ["dashboard", "service-data", ...]
  dataBoard.fullData(allDates)                 → ["data-board", "full-data", ...]
  maCharts.fullServiceData(allDates)           → ["ma-charts", "full-service-data", ...]
  maCharts.widgetData(allDates)                → ["ma-charts", "widget-data", ...]
}
```

네이밍 규칙: `[섹션, 리소스, ...파라미터]`

### 4-3. Query Functions (`lib/queries/queryFns.ts`)

공통 `postFetch<T>(url, body, signal)` 헬퍼 + 4개 typed 함수:

| 함수 | API Route | 반환 타입 |
|------|-----------|-----------|
| `fetchDashboardServiceData(dates, clientIds, signal)` | `/api/dashboard/service-data` | `DailyServiceRow[]` |
| `fetchDataBoardFullData(dates, signal)` | `/api/data-board/full-data` | `DailyRawRow[]` |
| `fetchMaFullServiceData(dates, signal)` | `/api/charts/ma/full-data` | `DailyServiceRow[]` |
| `fetchMaWidgetData(dates, signal)` | `/api/charts/widget-data` | `DailyRawRow[]` |

React Query가 `queryFn({ signal })`로 AbortSignal을 자동 전달 → 수동 AbortController 불필요.

### 4-4. 3가지 useQuery 패턴

**패턴 A: 순수 fetch (Dashboard)**

Phase 2에 service data가 없으므로 `initialData` 없이 시작.

```typescript
const serviceQuery = useQuery({
  queryKey: queryKeys.dashboard.serviceData(allDates, clientIds),
  queryFn: ({ signal }) => fetchDashboardServiceData(allDates, clientIds, signal),
  enabled: allDates.length > 0,
});
const serviceData = serviceQuery.data ?? [];
const isServiceLoaded = serviceQuery.isFetched;
```

**패턴 B: initialData (Data-Board)**

Phase 2의 700행을 `initialData`로 즉시 표시, Phase 3 완료 시 교체.

```typescript
const fullDataQuery = useQuery({
  queryKey: queryKeys.dataBoard.fullData(allDates),
  queryFn: ({ signal }) => fetchDataBoardFullData(allDates, signal),
  enabled: allDates.length > 0,
  initialData: initialRawData,       // Phase 2 서비스 레벨 14일
  initialDataUpdatedAt: 0,           // 즉시 stale → 항상 백그라운드 fetch 실행
});
const rawData = fullDataQuery.data ?? initialRawData;
const isFullyLoaded = fullDataQuery.dataUpdatedAt > 0;
```

- `initialData`는 `dataUpdatedAt`을 설정하지 않음 (0 유지)
- 실제 네트워크 fetch 완료 시에만 `dataUpdatedAt > 0`
- `isFullyLoaded`로 Widget 모드(W 토글) 활성화 여부 결정

**패턴 C: 의존 체인 (MA Charts)**

Phase 3a 완료 후 Phase 3b를 자동 실행.

```typescript
// Phase 3a: 서비스 데이터
const serviceQuery = useQuery({
  queryKey: queryKeys.maCharts.fullServiceData(allDates),
  queryFn: ({ signal }) => fetchMaFullServiceData(allDates, signal),
  enabled: allDates.length > 0,
  initialData: initialServiceData,
  initialDataUpdatedAt: 0,
});
const isFullyLoaded = serviceQuery.dataUpdatedAt > 0;

// Phase 3b: 위젯 데이터 (Phase 3a 완료 시 자동 pre-load)
const widgetQuery = useQuery({
  queryKey: queryKeys.maCharts.widgetData(allDates),
  queryFn: ({ signal }) => fetchMaWidgetData(allDates, signal),
  enabled: isFullyLoaded && allDates.length > 0,   // ← 의존 조건
});
```

### 4-5. SWR 캐시 동작

| 시나리오 | 동작 |
|----------|------|
| 최초 방문 | Phase 2 즉시 → Phase 3 fetch (300-500ms) → 교체 |
| **60분 내 재방문** | **캐시 데이터 즉시 표시 (Zero Loading), fetch 안함** |
| 60-120분 사이 재방문 | 캐시 즉시 표시 + 백그라운드 revalidate |
| 120분 이후 재방문 | 캐시 GC됨 → 최초 방문과 동일 |

---

## 5. 클라이언트 처리 파이프라인

### 5-1. Dashboard (`DashboardClient.tsx`)

```
quickPayload (Phase 2)
├── allDates, totalData, weeks, clientIds
│
├─ useMemo(getPeriodDateRanges)       → currentDates, previousDates, chartGroups
├─ useMemo(effectiveTotalData)        → hasFilters ? aggregateServiceToTotal(serviceData) : totalData
├─ useMemo(calcBoardSummaryByDateRange)  → KPI 요약 { adRevenue, vimp, mfr }
├─ useMemo(comparisonLabel)           → "vs 전일" / "vs 전주" / "vs 3월"
│
└── Phase 3: serviceData 도착 후
    ├─ useMemo(calcChartPointsByGroups)    → 차트 데이터 포인트
    └─ useMemo(calcTrendListByDateRange)   → 서비스별 트렌드 (상위 10개)
```

**렌더 순서:**
1. KPI Cards 즉시 (totalData)
2. Controls 즉시 (상태만)
3. Chart skeleton → Phase 3 완료 → 차트 + 트렌드

### 5-2. Data-Board (`DataBoardClient.tsx`)

```
quickPayload (Phase 2: service-level 14일)
│
├─ useState(filterType)         — C/S/W (기본 "service")
├─ useState(metricType)         — adrevenue/vimp/mfr/...
├─ useState(periodType)         — daily/weekly/monthly
├─ useState(chartRange)         — 표시 기간 수
│
├─ useMemo(displayKeys)         → 표시할 날짜/기간 키 목록
├─ useMemo(groupedData)         → groupRawData(rawData, filterType) → DataBoardGroupedRow[]
├─ useMemo(average/previous/change) → 지표별 통계 컬럼 계산
├─ useMemo(filteredRows)        → 검색 + 소액필터 적용
├─ useMemo(sortedRows)          → 정렬 적용
│
└── Phase 3: rawData 교체 (widget-level 90일)
    ├─ isFullyLoaded = true → W 토글 활성화
    └─ 모든 useMemo 자동 재계산 (React dependency)
```

**핵심:** Phase 3 도착 후 모든 조작 (C/S/W, Metric, Period, 슬라이더, 검색) = 서버 요청 없이 즉시.

### 5-3. MA Charts (`MaChartSection.tsx`)

```
quickPayload (Phase 2: service-level 35일)
│
├─ useState(metric)             — ad_revenue/vimp/mfr/cost_spent
├─ useState(maWindow)           — 5/10/20/60
├─ useState(dateRange)          — 30d/60d/90d/custom
├─ useState(entityMode)         — service/widget
├─ useState(selectedEntityId)   — 선택된 엔티티
│
├─ useMemo(grouped)             → groupByEntity(data, entityMode)
├─ useMemo(displayDates)        → dateRange 기반 표시 날짜
├─ useMemo(rankedIds)           → rankEntitiesByRevenue(grouped, displayDates)
├─ useMemo(mainChartData)       → buildMainChartData(entity, metric, ..., maWindow)
├─ useMemo(miniCards)           → buildMiniCardsData(grouped, rankedIds, ..., count)
│
├── Phase 3a: 150일 서비스 데이터 교체 → 90d + MA60 활성화
└── Phase 3b: 위젯 데이터 pre-load → 위젯 모드 즉시 전환
```

---

## 6. DB 뷰 구조

모든 데이터 소스는 사전 집계된 뷰로 쿼리 성능을 최적화한다.

| 뷰 | 타입 | 집계 수준 | 일별 행 수 | 용도 |
|-----|------|-----------|-----------|------|
| `media.v_dates` | View | DISTINCT date | 1 | 날짜 수집 |
| `media.v_daily_total` | MV | GROUP BY date | 1 | 전사 KPI |
| `media.v_daily_by_service` | MV | GROUP BY date, client, service | ~50 | 서비스 트렌드/차트 |
| `media.v_daily` | View | No aggregation (widget-level) | ~200 | Data W모드 |
| `media.v_weekly` | MV | GROUP BY year, week, client, service, widget | - | Data 주간 집계 |
| `media.v_monthly` | MV | GROUP BY year_month, client, service, widget | - | Data 월간 집계 |
| `media.ref_holiday` | View | - | - | 공휴일 |
| `media.ref_week` | View | - | - | 주차 정의 |

**인덱스:** `idx_daily_date` on `media.daily(date)` — per-date `.eq()` 쿼리의 핵심.

---

## 7. DOM 가상화 & 렌더 최적화

### 7-1. Data-Board 테이블 (`DataTable.tsx`)

W 모드에서 ~500행을 렌더하는 테이블에 `@tanstack/react-virtual` 적용.

```typescript
const rowVirtualizer = useVirtualizer({
  count: sortedRows.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 33,    // ~33px per row
  overscan: 20,              // 화면 밖 20행 추가 렌더
});
```

**구조:**
- `<thead>` — sticky 헤더 (비가상화, 항상 표시)
- `<DataTableTotalRow>` — 총합 행 (비가상화, 항상 첫 번째)
- 데이터 행 — 가상화 (padding `<tr>` top/bottom으로 스크롤 높이 유지)

**효과:** W 모드 500행 → 실제 DOM에 ~40-50행만 렌더 (overscan 포함)

### 7-2. MA Mini Cards (`MaMiniCards.tsx`)

가상화 대신 `React.memo` 최적화 적용.

- 최대 60장은 가상화 임계점 미만
- CSS grid 자연 래핑 UX를 유지하기 위해 고정 높이 스크롤 컨테이너 도입 불필요
- `MiniCard` 컴포넌트에 `memo()` 적용 → props 변경 없는 카드 리렌더 방지
- `MiniTooltipContent`를 별도 컴포넌트로 분리 → 매 렌더마다 함수 재생성 방지

---

## 8. 핵심 타입

### Payload 타입

```typescript
// Dashboard
interface BoardQuickPayload {
  allDates: string[];              // 90일, newest first
  totalData: DailyTotalRow[];      // 90행
  weeks: RefWeekRow[];
  clientIds: string[] | null;      // 필터 결과 (null = 전체)
}

// Data-Board
interface DataBoardPayload {
  allDates: string[];              // 90일
  rawData: DailyRawRow[];          // Phase 2: 14일 service, Phase 3: 90일 widget
  holidays: string[];
  weeks: RefWeekRow[];
}

// MA Charts
interface MaChartQuickPayload {
  allDates: string[];              // 150일
  serviceData: DailyServiceRow[];  // Phase 2: 35일
  holidays: string[];
}
```

### Row 타입 계층

```typescript
interface DailyTotalRow {           // 전사 집계
  date: string;
  cost_spent: number;
  ad_revenue: number;
  imp: number;
  vimp: number;
  cnt_click: number;
}

interface DailyServiceRow           // 서비스별
  extends DailyTotalRow {
  client_id: string;
  client_name: string;
  service_id: string;
  service_name: string;
}

interface DailyRawRow               // 위젯별
  extends DailyServiceRow {
  widget_id: string | null;
  widget_name: string | null;
}
```

---

## 9. 에러 처리

### 서버 (page.tsx)

```typescript
const quickPayload = await getBoardQuickPayload(filters).catch((err) => {
  console.error("[DashboardPage] error:", err);
  return null;
});

if (!quickPayload) {
  return <p>데이터를 불러올 수 없습니다.</p>;
}
```

### 클라이언트 (React Query)

- `retry: 1` — 1회 자동 재시도
- 실패 시 Phase 2 `initialData`가 있으면 그대로 표시 (graceful degradation)
- Phase 3 실패 시 UI는 Phase 2 데이터로 계속 동작 (기능 제한: W 모드 비활성 등)

---

## 10. 관련 파일 요약

| 카테고리 | 파일 | 역할 |
|----------|------|------|
| **Provider** | `app/providers.tsx` | QueryClientProvider (staleTime 60분) |
| **Layout** | `app/layout.tsx` | `<Providers>` 래핑 |
| **Query Infra** | `lib/queries/queryKeys.ts` | Query key factory |
| **Query Infra** | `lib/queries/queryFns.ts` | POST fetch wrapper (4개 함수) |
| **Server Service** | `lib/api/boardService.ts` | Dashboard 데이터 조회 |
| **Server Service** | `lib/api/dataBoardService.ts` | Data-Board 데이터 조회 |
| **Server Service** | `lib/api/maChartService.ts` | MA Charts 데이터 조회 |
| **Server Service** | `lib/api/dateService.ts` | getLatestDataDate() |
| **API Route** | `app/api/dashboard/service-data/route.ts` | Dashboard Phase 3 |
| **API Route** | `app/api/data-board/full-data/route.ts` | Data-Board Phase 3 |
| **API Route** | `app/api/charts/ma/full-data/route.ts` | MA Charts Phase 3a |
| **API Route** | `app/api/charts/widget-data/route.ts` | MA Charts Phase 3b |
| **Page** | `app/dashboard/page.tsx` | Dashboard Server Component |
| **Page** | `app/data-board/page.tsx` | Data-Board Server Component |
| **Page** | `app/charts/moving-average/page.tsx` | MA Charts Server Component |
| **Client** | `app/dashboard/_components/DashboardClient.tsx` | Dashboard 클라이언트 오케스트레이터 |
| **Client** | `app/data-board/_components/DataBoardClient.tsx` | Data-Board 클라이언트 오케스트레이터 |
| **Client** | `app/charts/moving-average/_components/MaChartSection.tsx` | MA Charts 클라이언트 오케스트레이터 |
| **Logic** | `lib/logic/boardLogic.ts` | Dashboard 비즈니스 로직 |
| **Logic** | `lib/logic/dataBoardGrouping.ts` | Data-Board 그룹핑 |
| **Logic** | `lib/logic/dataBoardCalculations.ts` | Data-Board 통계 계산 |
| **Logic** | `lib/logic/maChartLogic.ts` | MA Charts 비즈니스 로직 |
| **Virtualization** | `app/data-board/_components/DataTable.tsx` | 행 가상화 (react-virtual) |
| **Optimization** | `app/charts/moving-average/_components/MaMiniCards.tsx` | React.memo 최적화 |
| **Types** | `types/app-db.types.ts` | DailyTotalRow, DailyServiceRow, DailyRawRow 등 |
| **Planning** | `_planning/loading-strategy.md` | 전체 전략 설계 문서 |
