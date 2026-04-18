# Moving Average Chart (Charts 섹션)

## Document info
- **Created:** 2026-03-08 16:00:00
- **Last updated:** 2026-03-08 16:00:00

## Revision history
| Date | Description |
|------|-------------|
| 2026-03-08 16:00:00 | Initial version. |

## Covered files
| Path | Role |
|------|------|
| `@/app/charts/moving-average/page.tsx` | 서버 페이지 (Phase 2 fetch) |
| `@/app/charts/moving-average/_components/MovingAverageClient.tsx` | 클라이언트 래퍼 |
| `@/app/charts/moving-average/_components/MaChartSection.tsx` | 상태 오케스트레이션 + useMemo 파이프라인 |
| `@/app/charts/moving-average/_components/MaMainChart.tsx` | 메인 차트 렌더링 (Recharts) |
| `@/app/charts/moving-average/_components/MaMidChartRow.tsx` | 비주력 지표 4개 소형 차트 |
| `@/app/charts/moving-average/_components/MaMiniCards.tsx` | Top-N 엔티티 미니 카드 그리드 |
| `@/lib/logic/maChartLogic.ts` | 엔티티별 MA 계산 (순수 로직) |
| `@/lib/logic/chartsLogic.ts` | SMA, 정규화 공용 계산 |

## 1. Overview
- **Path:** `app/charts/moving-average/`
- **Purpose:** 서비스/위젯별 일별 지표에 SMA(단순이동평균)를 적용하여 실제값 vs MA 추이를 차트로 표시. 메인 차트 + 4개 보조 차트 + Top-N 미니 카드 구성.

## 2. Key Props & State

### 서버 → 클라이언트

```typescript
MaChartQuickPayload {
  allDates: string[];              // 35일 (newest first)
  serviceData: DailyServiceRow[];  // 서비스 레벨 일별 데이터
  holidays: string[];              // 공휴일 배열
}
```

### 클라이언트 State (MaChartSection)

| State | Type | Default | Purpose |
|-------|------|---------|---------|
| `metric` | `MaMetricType` | `"ad_revenue"` | 주력 지표 (5종) |
| `maWindow` | `MaWindow` | `5` | SMA 윈도우 (5/10/15/30/60일) |
| `dateRange` | `MaDateRange` | `"30d"` | 표시 기간 (15d/30d/90d/custom) |
| `customDateRange` | `{from, to} \| null` | `null` | 커스텀 날짜 범위 |
| `includeHolidays` | `boolean` | `false` | 공휴일 포함 여부 |
| `entityMode` | `"service" \| "widget"` | `"service"` | 그룹핑 단위 |
| `selectedEntityId` | `string \| null` | `null` | 선택된 엔티티 (null = 1위) |
| `miniChartCount` | `number` | `20` | Top-N 미니 카드 수 (20-60) |

## 3. Core Logic & Interactions

### Phase 로딩

```
Phase 2: getMaChartQuickPayload() → 35일 서비스 데이터
Phase 3a: React Query → 150일 서비스 데이터 (백그라운드)
Phase 3b: React Query → 위젯 데이터 (entityMode="widget" 전환 시)
```

### useMemo 파이프라인

```
serviceData / widgetData
  → groupByEntity(data, entityMode)          // Map<entityId, MaEntitySeries>
  → rankEntitiesByRevenue(grouped, dates)    // 매출순 정렬
  → buildMainChartData(entity, metric, ..., maWindow)  // SMA + gap + bands
  → buildMiniCardsData(grouped, rankedIds, ...)        // Top-N 미니 카드
  → midChartsData (비주력 4개 지표)
```

### SMA 계산 핵심

```typescript
// 1. 전체 날짜로 SMA 워밍업 (allSortedDates)
// 2. displayDates 범위만 차트에 표시
// 3. gap = ((actual - ma) / ma) × 100%
// 4. bands: actual > ma → red, actual < ma → blue
```

### 지표 5종

| 지표 | 계산 | Y축 포맷 |
|------|------|----------|
| ad_revenue | raw | 억/만 |
| vimp | raw | 억/만 |
| mfr | (ad_revenue / cost_spent) × 100 | X% |
| vctr | (cnt_click / vimp) × 100 | X.XX% |
| vrate | (vimp / imp) × 100 | X.X% |

## 4. AI Implementation Guide (For vibe coding)

### State → Action → Implementation

| State / condition | Meaning | Use this function / API | Where to implement |
|---|---|---|---|
| metric 변경 | 주력 지표 전환 | `computeMetric()` → `buildMainChartData()` | MaChartSection setMetric |
| maWindow 변경 | SMA 윈도우 크기 | `sma(values, window)` | MaChartSection setMaWindow |
| dateRange 변경 | 표시 기간 | `computeDisplayDates()` | MaChartSection setDateRange |
| entityMode 변경 | 서비스↔위젯 | `groupByEntity()` + widgetQuery | MaChartSection handleEntityModeChange |
| 미니 카드 클릭 | 엔티티 드릴다운 | mainChartData useMemo | MaChartSection setSelectedEntityId |
| 새 지표 추가 | MaMetricType 확장 | `computeMetric()` + MA_METRICS 상수 | maChartLogic.ts |

### Dependencies
- `@/lib/logic/maChartLogic` — groupByEntity, rankEntitiesByRevenue, buildMainChartData, buildMiniCardsData, computeMetric
- `@/lib/logic/chartsLogic` — sma
- `@/lib/api/maChartService` — getMaChartQuickPayload
