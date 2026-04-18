# Data Chart (Charts 섹션)

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
| `@/app/charts/data-chart/page.tsx` | 서버 페이지 (Phase 2 fetch) |
| `@/app/charts/data-chart/_components/DataChartClient.tsx` | 클라이언트 래퍼 |
| `@/app/charts/data-chart/_components/DataChartSection.tsx` | 상태 오케스트레이션 + useMemo |
| `@/app/charts/data-chart/_components/DataMainChart.tsx` | 메인 차트 렌더링 |
| `@/app/charts/data-chart/_components/DataMidChartRow.tsx` | 보조 4개 차트 |
| `@/app/charts/data-chart/_components/DataMiniCards.tsx` | Top-N 미니 카드 |
| `@/lib/logic/dataChartLogic.ts` | 엔티티별 데이터 차트 계산 (MA 없음) |

## 1. Overview
- **Path:** `app/charts/data-chart/`
- **Purpose:** Moving Average와 동일한 구조이나 SMA 없이 실제값만 표시. 선택적으로 2번째 지표를 오버레이 가능.

## 2. Key Props & State

### 서버 → 클라이언트

MA와 동일: `MaChartQuickPayload` (35일 서비스 데이터 + holidays)

### 클라이언트 State (DataChartSection)

| State | Type | Default | Purpose |
|-------|------|---------|---------|
| `metric` | `MaMetricType` | `"ad_revenue"` | 주력 지표 |
| `secondaryMetric` | `MaMetricType \| null` | `null` | 오버레이 2번째 지표 (최대 1개) |
| `dateRange` | `MaDateRange` | `"30d"` | 표시 기간 |
| `customDateRange` | `{from, to} \| null` | `null` | 커스텀 날짜 |
| `includeHolidays` | `boolean` | `false` | 공휴일 포함 |
| `entityMode` | `"service" \| "widget"` | `"service"` | 그룹핑 단위 |
| `selectedEntityId` | `string \| null` | `null` | 선택 엔티티 |
| `miniChartCount` | `number` | `20` | Top-N 수 |

**MA와의 차이**: `maWindow` 없음, `secondaryMetric` 추가됨

## 3. Core Logic & Interactions

### MA 차트와의 차이점

| 항목 | Moving Average | Data Chart |
|------|---------------|------------|
| SMA 계산 | O (maWindow 설정) | X |
| gap/bands | O (실제값 vs MA 차이) | X |
| 2nd 지표 오버레이 | X | O (secondaryMetric) |
| 데이터 포인트 | `{ actual, ma, gap, bands }` | `{ actual, secondary }` |

### useMemo 파이프라인

```
grouped → rankedIds → displayDates
  → buildDataChartData(entity, metric, ..., secondaryMetric)  // actual + secondary
  → buildDataMiniCardsData(grouped, rankedIds, ...)           // Top-N (no MA)
  → midChartsData (비주력 4개)
```

## 4. AI Implementation Guide (For vibe coding)

### State → Action → Implementation

| State / condition | Meaning | Use this function / API | Where to implement |
|---|---|---|---|
| metric 변경 | 주력 지표 전환 | `buildDataChartData()` | DataChartSection handleMetricChange |
| secondaryMetric 변경 | 오버레이 추가/제거 | `buildDataChartData(..., secondaryMetric)` | DataChartSection setSecondaryMetric |
| entityMode 변경 | 서비스↔위젯 | `groupByEntity()` | DataChartSection handleEntityModeChange |
| metric과 secondary 충돌 | 같은 지표 선택 시 | secondary를 null로 리셋 | handleMetricChange 내부 |

### Dependencies
- `@/lib/logic/dataChartLogic` — buildDataChartData, buildDataMiniCardsData
- `@/lib/logic/maChartLogic` — groupByEntity, rankEntitiesByRevenue, computeDisplayDates (공유)
