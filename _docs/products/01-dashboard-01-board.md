# Dashboard (Board 섹션)

## Document info
- **Created:** 2026-03-08 15:00:00
- **Last updated:** 2026-03-08 15:00:00

## Revision history
| Date | Description |
|------|-------------|
| 2026-03-08 15:00:00 | Initial version. |

## Covered files
| Path | Role |
|------|------|
| `@/app/dashboard/page.tsx` | 서버 페이지 (Phase 2 fetch + 필터 해석) |
| `@/app/dashboard/_components/DashboardClient.tsx` | 메인 클라이언트 (상태 + Phase 3 + useMemo 파이프라인) |
| `@/lib/logic/boardLogic.ts` | KPI 계산, 차트 포인트, 트렌드 리스트 로직 |
| `@/lib/api/boardService.ts` | 데이터 fetch 서비스 (총합, 서비스별, ref_week) |

## 1. Overview
- **Path:** `app/dashboard/`
- **Purpose:** 3개 KPI 카드(Ad Revenue, vIMP, MFR) + 3개 시계열 차트 + 서비스별 Top-10 트렌드 리스트를 일별/주별/월별로 표시하는 대시보드.

## 2. Key Props & State

### 서버 → 클라이언트

```typescript
interface BoardQuickPayload {
  allDates: string[];           // 90일 날짜 배열 (newest first)
  totalData: DailyTotalRow[];   // 전체 합산 일별 데이터
  weeks: RefWeekRow[];          // ref_week 정의
  clientIds: string[] | null;   // 필터된 client ID (null = 전체)
}
```

### 클라이언트 State

| State | Type | Default | Purpose |
|-------|------|---------|---------|
| `periodType` | `PeriodType` | `"daily"` | 차트 기간 단위 |
| `chartRange` | `number` | 14/8/3 | 표시 기간 수 |
| `selectedService` | `{id, name} \| null` | `null` | 서비스 드릴다운 |
| `adRevenueTrend` | `"up" \| "down"` | `"up"` | Ad Revenue Top-10 방향 |
| `vimpTrend` | `"up" \| "down"` | `"up"` | vIMP Top-10 방향 |
| `mfrTrend` | `"up" \| "down"` | `"up"` | MFR Top-10 방향 |

## 3. Core Logic & Interactions

### 2+3 Phase 로딩

```
Phase 2 (서버 await ~300ms):
  getBoardQuickPayload(filters)
    → allDates, totalData, weeks, clientIds

Phase 3 (클라이언트 React Query):
  fetchDashboardServiceData(allDates, clientIds)
    → DailyServiceRow[] (~18k rows)
```

- **Phase 2 즉시**: KPI 카드 렌더 가능 (totalData)
- **Phase 3 완료 후**: 차트 + 트렌드 리스트 렌더

### useMemo 파이프라인

```
totalData + serviceData (Phase 3)
  → periodRanges = getPeriodDateRanges(allDates, periodType, chartRange, weeks)
  → effectiveTotalData = hasFilters ? aggregateServiceToTotal(serviceData) : totalData
  → summary = calcBoardSummaryByDateRange(effectiveTotalData, current, previous)
  → chartPoints = calcChartPointsByGroups(effectiveTotalData, serviceData, groups, selectedService)
  → trendItems = calcTrendListByDateRange(serviceData, current, previous, metric, direction)
```

### 필터가 있을 때 데이터 소스 전환

| 조건 | KPI/차트 데이터 소스 | 이유 |
|------|---------------------|------|
| 필터 없음 | `totalData` (v_daily_total) | 전체 합산 사전 집계 |
| 필터 있음 | `aggregateServiceToTotal(serviceData)` | v_daily_total은 필터 미지원, serviceData를 재집계 |

### 기간별 그룹핑 (getPeriodDateRanges)

| periodType | current | previous | chartGroups |
|------------|---------|----------|-------------|
| daily | 최신 1일 | 전일 1일 | 최근 chartRange일, oldest→newest |
| weekly | ref_week 최신 주 | 직전 주 | 최근 chartRange주 (ref_week 기준) |
| monthly | 최신 월 전체 | 직전 월 전체 | 최근 chartRange월 (YYYY-MM) |

### 서비스 드릴다운

- 트렌드 리스트에서 서비스 클릭 → `selectedService` 설정
- 차트가 해당 서비스만의 데이터로 전환 (totalData → serviceData 필터)
- periodType 변경 시 자동 초기화 (useEffect)

## 4. AI Implementation Guide (For vibe coding)

### State → Action → Implementation

| State / condition | Meaning | Use this function / API | Where to implement |
|---|---|---|---|
| periodType 변경 | 일/주/월 전환 | `getPeriodDateRanges()` | handlePeriodTypeChange (chartRange도 리셋) |
| chartRange 변경 | 표시 기간 조절 | periodRanges useMemo | setChartRange |
| selectedService 변경 | 서비스 드릴다운 | `calcChartPointsByGroups()` | handleServiceSelect |
| trend direction 변경 | Top-10 방향 전환 | `calcTrendListByDateRange()` | setXxxTrend + selectedService 초기화 |
| 새 KPI 지표 추가 | summary 확장 | `calcBoardSummaryByDateRange()` | boardLogic.ts + SummaryCards 컴포넌트 |
| 차트 스타일 변경 | Chart.js 설정 | BoardChart 컴포넌트 | dashboard/_components/BoardChart.tsx |

### Modification rules

- **KPI 카드 추가**: boardLogic.ts `calcBoardSummaryByDateRange` 확장 + SummaryCards 컴포넌트
- **차트 지표 추가**: boardLogic.ts `calcChartPointsByGroups` + BoardChart 인스턴스 추가
- **필터 추가**: boardService.ts `getFilteredClientIds` 확장 + page.tsx searchParams 파싱

### Dependencies
- `@/lib/logic/boardLogic` — getPeriodDateRanges, calcBoardSummaryByDateRange, calcChartPointsByGroups, calcTrendListByDateRange, aggregateServiceToTotal
- `@/lib/api/boardService` — getBoardQuickPayload, getBoardServiceData, getFilteredClientIds
