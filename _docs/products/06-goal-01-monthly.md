# Goal Monthly (Goal 섹션)

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
| `@/app/goal/monthly/page.tsx` | 서버 페이지 (Phase 2 fetch, 매니저 목표 조회) |
| `@/app/goal/monthly/_components/MonthlyGoalClient.tsx` | 메인 클라이언트 (매니저 탭 전환 + 데이터 리페치) |
| `@/app/goal/monthly/_components/MonthlyKpiCardGrid.tsx` | 4개 KPI 카드 그리드 |
| `@/app/goal/monthly/_components/CumulativeVimpChart.tsx` | 누적 vIMP 라인 차트 (Recharts) |
| `@/app/goal/monthly/_components/ClientMonthlyVimpTable.tsx` | 13개월 클라이언트별 vIMP 테이블 |
| `@/lib/api/goalMonthlyService.ts` | 데이터 fetch 서비스 (KPI, 차트, 클라이언트 집계) |
| `@/lib/logic/goalLogic.ts` | 비즈니스 로직 (예상치 계산, KPI 카드 빌드, 차트 포인트) |
| `@/app/api/goal/monthly/route.ts` | API 라우트 (매니저 전환 시 데이터 반환) |

## 1. Overview
- **Path:** `app/goal/monthly/`
- **Purpose:** 월별 vIMP(가상 노출) 목표 달성 현황 대시보드. 4개 KPI 카드(2개월 전, 1개월 전, 당월 실적, 당월 예상) + 누적 차트 + 클라이언트별 13개월 vIMP 테이블을 매니저별로 전환하여 표시.

## 2. Key Props & State

### 서버 → 클라이언트

```typescript
interface Props {
  initialKpiCards: MonthlyKpiCard[];          // 4개 KPI 카드
  initialMonths: string[];                    // 13개 월 키 (newest→oldest)
  initialClientRows: ClientMonthlyVimpRow[];  // 클라이언트별 월간 vIMP
  initialChartPoints: CumulativeChartPoint[]; // 누적 차트 포인트 (1~31일)
  initialCurrentMonthKey: string;             // 현재 월 "YYYY-MM"
  initialMonthGoal: number;                   // 현재 월 목표치
  managers: ManagerRow[];                     // 매니저 목록 (탭용)
}
```

### 클라이언트 State

| State | Type | Default | Purpose |
|-------|------|---------|---------|
| `activeManagerId` | `number \| null` | `null` | 선택된 매니저 (null = 전체/팀) |
| `goalData` | `GoalData` | initialProps | KPI, 차트, 테이블 통합 상태 |
| `loading` | `boolean` | `false` | 매니저 전환 중 로딩 스피너 |

## 3. Core Logic & Interactions

### 2+3 Phase 로딩

```
Phase 2 (서버 await):
  page.tsx → Promise.all([
    getMonthlyKpiCards(),
    getClientMonthlyVimp(),
    getAllManagers(),
    getTeamGoalsForYear(year),
    getCumulativeChartData(null, monthGoal)
  ])
  → MonthlyGoalClient (initialData)

Phase 3 (클라이언트 fetch):
  매니저 탭 클릭 → GET /api/goal/monthly?managerId=X
  → goalData 상태 업데이트 → 3개 자식 컴포넌트 리렌더
```

### 데이터 소스 전략

| 데이터 | 과거 월 소스 | 당월 소스 | 이유 |
|--------|------------|----------|------|
| KPI 카드 | `v_monthly` MV | `daily` 테이블 | MV는 갱신 전 stale, daily가 실시간 |
| 클라이언트 테이블 | `v_monthly` MV | `daily` 테이블 | 동일 |
| 누적 차트 | N/A | `v_daily` 뷰 | 당월 일별 데이터만 필요 |

### KPI 카드 구조

| 카드 | 월 | 데이터 | isProjected |
|------|---|--------|-------------|
| 1 | 2개월 전 | 실적 | false |
| 2 | 1개월 전 | 실적 | false |
| 3 | 당월 | 실적 (현재까지) | false |
| 4 | 당월 | 예상치 (pace 기반) | true |

- 예상치 공식: `(currentVimp / elapsedDays) * totalDays`
- 전월 대비 변화율: `(current - previous) / previous * 100`

### 누적 차트 (CumulativeVimpChart)

```
Recharts LineChart (3 lines):
  actual   — 실선 초록 (#10b981): 1일부터 최신일까지 누적 vIMP
  projected — 점선 초록 (#10b981): 최신일부터 월말까지 pace 기반 연장
  goalLine  — 점선 파랑 (#3b82f6): 0에서 monthGoal까지 선형 보간

X축: 1~31일, Y축: vIMP (K/M/B 포맷)
```

### 매니저 전환 플로우

```
매니저 탭 클릭
  → setLoading(true)
  → fetch GET /api/goal/monthly?managerId=X
  → API route:
      getMonthlyKpiCards(managerId)       // 매니저 클라이언트만 필터
      getClientMonthlyVimp(managerId)     // 매니저 클라이언트만
      getCumulativeChartData(managerId, goal) // 매니저별 차트
      getTeamGoalsForYear / getManagerGoalsForYear
  → setGoalData(response)
  → setLoading(false)
```

### 클라이언트 테이블 (ClientMonthlyVimpTable)

- 13개월 수평 스크롤 테이블
- 좌측 고정 컬럼: 클라이언트명
- 최상단 합계 행 (sticky)
- 예상 vIMP 컬럼 (당월 pace 기반)
- 최신 월 텍스트 진하게, 오래된 월 회색

## 4. AI Implementation Guide (For vibe coding)

### State → Action → Implementation

| State / condition | Meaning | Use this function / API | Where to implement |
|---|---|---|---|
| 매니저 탭 클릭 | 매니저별 데이터 전환 | `GET /api/goal/monthly?managerId=X` | MonthlyGoalClient handleManagerChange |
| KPI 카드 지표 추가 | 새 카드/지표 표시 | `buildKpiCards()` 확장 | goalLogic.ts + MonthlyKpiCardGrid |
| 차트 라인 추가 | 새 비교 라인 | `buildCumulativeChart()` 확장 | goalLogic.ts + CumulativeVimpChart |
| 테이블 컬럼 추가 | 새 지표 표시 | `getClientMonthlyVimp()` 확장 | goalMonthlyService.ts + ClientMonthlyVimpTable |
| 예상치 로직 변경 | 산출 공식 수정 | `calcProjectedVimp()` | goalLogic.ts |
| 월 범위 변경 | 13개월 → N개월 | `getLast13Months()` 수정 | goalMonthlyService.ts |

### Modification rules

- **KPI 카드 추가/수정**: `goalLogic.ts` `buildKpiCards()` 수정 + `MonthlyKpiCardGrid` 렌더링 추가
- **차트 요소 추가**: `goalLogic.ts` `buildCumulativeChart()` + `CumulativeVimpChart` Line 추가
- **매니저 필터 로직 변경**: `goalMonthlyService.ts` `getClientIdsForManager()` 수정
- **테이블 포맷 변경**: `ClientMonthlyVimpTable` 컬럼/셀 수정

### Dependencies
- `@/lib/logic/goalLogic` — calcProjectedVimp, buildKpiCards, buildCumulativeChart
- `@/lib/api/goalMonthlyService` — getMonthlyKpiCards, getClientMonthlyVimp, getCumulativeChartData
- `@/lib/api/goalSettingService` — getTeamGoalsForYear, getManagerGoalsForYear
- `@/lib/api/managerService` — getAllManagers
- `@/lib/api/dateService` — getLatestDataDate
- `@/lib/utils/number-utils` — formatNumberForDisplay, formatChange
- `@/lib/utils/date-utils` — toYearMonth, addMonths, getDaysInMonth
