# Normalized Chart (Charts 섹션)

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
| `@/app/charts/normalized/page.tsx` | 서버 페이지 (getBoardQuickPayload) |
| `@/app/charts/normalized/_components/NormalizedClient.tsx` | 클라이언트 (상태 + 차트 렌더링) |
| `@/lib/logic/chartsLogic.ts` | min-max 정규화 계산 |

## 1. Overview
- **Path:** `app/charts/normalized/`
- **Purpose:** Ad Revenue, vIMP, MFR 3개 지표를 0-100 스케일로 정규화하여 하나의 차트에 겹쳐 표시. 서로 다른 단위의 지표를 비교 가능.

## 2. Key Props & State

### 서버 → 클라이언트

```typescript
// getBoardQuickPayload()에서 totalData만 사용
totalData: DailyTotalRow[]  // 전체 합산 일별 데이터
```

**다른 차트와의 차이**: MA/Data Chart는 `getMaChartQuickPayload()` 사용, Normalized는 `getBoardQuickPayload()` 사용 (엔티티별 데이터 불필요)

### 클라이언트 State

| State | Type | Default | Purpose |
|-------|------|---------|---------|
| `dateRange` | `number` | `30` | 표시 일수 (14/30/60/90) |
| `activeMetrics` | `Set<MetricKey>` | `{ad_revenue, vimp, mfr}` | 표시할 지표 (최소 1개) |

**가장 단순한 차트**: State 2개, Phase 3 없음, 엔티티 선택 없음.

## 3. Core Logic & Interactions

### 정규화 계산

```typescript
// chartsLogic.ts
function minMax(values: number[]): number[] {
  // 각 값을 0-100 스케일로 변환
  // min → 0, max → 100
  // 모든 값이 동일하면 50 반환
}

function calcNormChartPoints(totalData, dateRange): NormChartPoint[] {
  // 1. totalData를 dateRange만큼 슬라이스
  // 2. ad_revenue, vimp, mfr 각각 minMax 정규화
  // 3. 결과: { date, label, adRevenue: 0-100, vimp: 0-100, mfr: 0-100 }
}
```

### 데이터 플로우

```
totalData (서버 Phase 2)
  → calcNormChartPoints(totalData, dateRange)  // useMemo
  → Recharts LineChart (activeMetrics만 렌더링)
```

### 인터랙션

| 조작 | 핸들러 | 효과 |
|------|--------|------|
| 기간 버튼 (14D/30D/60D/90D) | `setDateRange(n)` | 표시 범위 변경 → 정규화 재계산 |
| 지표 토글 버튼 | `toggleMetric(m)` | activeMetrics Set 토글 (최소 1개 유지) |

## 4. AI Implementation Guide (For vibe coding)

### State → Action → Implementation

| State / condition | Meaning | Use this function / API | Where to implement |
|---|---|---|---|
| dateRange 변경 | 표시 기간 | `calcNormChartPoints()` | NormalizedClient setDateRange |
| activeMetrics 토글 | 지표 표시/숨김 | Recharts Line visible 제어 | NormalizedClient toggleMetric |
| 새 지표 추가 | MetricKey 확장 | `calcNormChartPoints()` + minMax 적용 | chartsLogic.ts |

### Dependencies
- `@/lib/logic/chartsLogic` — calcNormChartPoints, minMax
- `@/lib/api/boardService` — getBoardQuickPayload (totalData만 사용)
