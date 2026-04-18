# Data Board (DATA 섹션)

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
| `@/app/data-board/daily/page.tsx` | Daily 서버 페이지 (Phase 2) |
| `@/app/data-board/weekly/page.tsx` | Weekly 서버 페이지 (Phase 2) |
| `@/app/data-board/monthly/page.tsx` | Monthly 서버 페이지 (Phase 2) |
| `@/app/data-board/_components/DataBoardClient.tsx` | Daily 클라이언트 (상태 + Phase 3) |
| `@/app/data-board/_components/WeeklyClient.tsx` | Weekly 클라이언트 (상태 + Phase 3) |
| `@/app/data-board/_components/MonthlyClient.tsx` | Monthly 클라이언트 (상태 + Phase 3) |
| `@/app/data-board/_components/DataTable.tsx` | 공용 테이블 (가상화 + 렌더링) |
| `@/app/data-board/_components/DataTableRow.tsx` | 개별 행 컴포넌트 |
| `@/app/data-board/_components/DataTableTotalRow.tsx` | 합계 행 컴포넌트 |
| `@/app/data-board/_components/DataFilters.tsx` | 필터 바 (C/S/W, 지표, 기간, 슬라이더) |
| `@/lib/logic/dataBoardGrouping.ts` | 그룹핑 로직 (daily/weekly/monthly) |
| `@/lib/logic/dataBoardCalculations.ts` | 평균, 전일비, 증감 계산 |
| `@/lib/api/dataBoardService.ts` | 데이터 fetch 서비스 |

## 1. Overview
- **Path:** `app/data-board/`
- **Purpose:** 일별/주별/월별 광고 성과 데이터를 C(Client)/S(Service)/W(Widget) 단위로 그룹핑하여 테이블로 표시. 정렬, 필터, 지표 전환 등 모든 인터랙션은 클라이언트에서 처리.

## 2. Key Props & State

### 서버 페이지 → 클라이언트 전달

| Period | Payload 타입 | 내용 |
|--------|-------------|------|
| Daily | `DataBoardPayload` | allDates, rawData (14일 서비스 레벨), holidays |
| Weekly | `WeeklyPayload` | allWeeks, rawData (8주 위젯 레벨), holidays |
| Monthly | `MonthlyPayload` | allMonths, rawData (3개월 위젯 레벨) |

### 클라이언트 공통 State (Daily/Weekly/Monthly 동일)

| State | Type | Default | Purpose |
|-------|------|---------|---------|
| `filterType` | `DataFilterType` | `"service"` | C/S/W 그룹핑 단위 |
| `metricType` | `DataMetricType` | `"adrevenue"` | 표시 지표 (7종) |
| `chartRange` | `number` | 14/8/3 | 표시할 기간 수 |
| `excludeSmall` | `boolean` | `true` | 소액 지면 제외 |
| `sort` | `SortState<SortField>` | none | 정렬 상태 |

## 3. Core Logic & Interactions

### 3-Phase 데이터 로딩

```
Phase 1: loading.tsx → TableSkeleton 즉시 표시
Phase 2: page.tsx → await getXxxQuickPayload() → 초기 데이터 (서비스 레벨)
Phase 3: React Query → fetchFullData() → 위젯 레벨 전체 데이터 (백그라운드)
```

### useMemo 파이프라인 (모든 인터랙션은 서버 요청 없이 재계산)

```
rawData (Phase 2 or 3)
  → groupXxxRawData(rawData, filterType, metricType)    // C/S/W 그룹핑
  → filteredData (search + excludeSmall 필터)            // 검색 + 소액 제외
  → buildTotalRow(filteredData, displayKeys, metricType) // 합계 행
  → sortDataRows(filteredData, sort, ...)                // 정렬
  → DataTable 렌더링 (가상화)
```

### Daily vs Weekly/Monthly 차이

| 항목 | Daily | Weekly | Monthly |
|------|-------|--------|---------|
| 데이터 소스 | v_daily (서비스→위젯) | v_weekly MV | v_monthly MV |
| Phase 3 필요 | O (위젯 레벨 확장) | O (전체 주 확장) | O (전체 월 확장) |
| 기간 키 | `YYYY-MM-DD` | `display_label` | `YYYY-MM` |
| 요일 색상 | O (holidays Set) | X (empty Set) | X (empty Set) |
| 당일 하이라이트 | O (amber-50) | X | X |

### DataTable 가상화

- `@tanstack/react-virtual` 사용
- `estimateSize`: 33px, `overscan`: 20
- 스티키 컬럼: Client, Service (S/W 모드), Widget ID/Name (W 모드)
- 스티키 헤더: blur 배경 + shadow

### 지표 7종

| 지표 | 계산 방식 | 포맷 |
|------|-----------|------|
| adrevenue | cost_spent 합산 | 천 단위 구분 |
| pubprofit | ad_revenue 합산 | 천 단위 구분 |
| mfr | (ad_revenue / cost_spent) × 100 | X.X% |
| imp | imp 합산 | 천 단위 구분 |
| vimp | vimp 합산 | 천 단위 구분 |
| vrate | (vimp / imp) × 100 | X.XX% |
| vctr | (cnt_click / vimp) × 100 | X.XXX% |

**비율 지표(mfr, vrate, vctr)는 합산된 분자/분모에서 재계산** — 개별 비율의 평균이 아님.

## 4. AI Implementation Guide (For vibe coding)

### State → Action → Implementation

| State / condition | Meaning | Use this function / API | Where to implement |
|---|---|---|---|
| filterType 변경 | C/S/W 전환 | `groupXxxRawData()` | Client 컴포넌트 handleFilterTypeChange |
| metricType 변경 | 지표 전환 | `computeMetricValue()` | Client 컴포넌트 handleMetricTypeChange |
| sort 변경 | 컬럼 정렬 | `sortDataRows()` | Client 컴포넌트 handleSort |
| chartRange 변경 | 표시 기간 조절 | displayKeys = allDates.slice(0, n) | Client 컴포넌트 setChartRange |
| excludeSmall 토글 | 소액 제외 | filteredData useMemo | Client 컴포넌트 |
| Phase 3 완료 | 위젯 모드 활성화 | isFullyLoaded 체크 | Widget 탭 guard |
| 새 지표 추가 | metricType 확장 | `computeMetricValue()` + `formatMetricValue()` | dataBoardGrouping.ts + number-utils.ts |
| 새 기간 타입 추가 | yearly 등 | 새 grouping 함수 + Client 컴포넌트 | dataBoardGrouping.ts + 새 Client |

### Modification rules

- **컬럼 추가**: `DataTable.tsx` 헤더 + `DataTableRow.tsx` 셀 + `DataTableTotalRow.tsx` 셀
- **정렬 필드 추가**: `SortField` 타입 + `sortDataRows()` 함수 + `DataTable.tsx` 헤더 onClick
- **필터 추가**: `DataFilters.tsx` UI + Client 컴포넌트 state + filteredData useMemo

### Dependencies
- `@/lib/logic/dataBoardGrouping` — groupRawData, groupWeeklyRawData, groupMonthlyRawData, buildTotalRow
- `@/lib/logic/dataBoardCalculations` — calculateAverage, calculatePreviousDay, calculateChange, sortDataRows
- `@/lib/api/dataBoardService` — getDataBoardQuickPayload, getWeeklyQuickPayload, getMonthlyQuickPayload
- `@/lib/utils/number-utils` — formatMetricValue, formatChange
- `@/lib/utils/date-utils` — getDayType, formatDateHeader
- `@/lib/utils/sort-utils` — cycleSortDirection, compareNullable
