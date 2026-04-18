# Shared Queries & Stores

## Document info
- **Created:** 2026-03-08 17:00:00
- **Last updated:** 2026-03-26 10:00:00

## Revision history
| Date | Description |
|------|-------------|
| 2026-03-08 17:00:00 | Initial version. |
| 2026-03-26 10:00:00 | External 쿼리 키/함수 추가 |

## Covered files
| Path | Role |
|------|------|
| `@/lib/queries/queryKeys.ts` | React Query 키 팩토리 |
| `@/lib/queries/queryFns.ts` | React Query fetch 래퍼 |
| `@/stores/useModalStore.ts` | 글로벌 모달 상태 (Zustand) |
| `@/stores/useToastStore.ts` | 글로벌 토스트 상태 (Zustand) |
| `@/hooks/useFilters.ts` | URL 기반 필터 상태 |

## 1. React Query Layer

### queryKeys (`lib/queries/queryKeys.ts`)

모든 React Query 키를 중앙에서 관리. 캐시 무효화 및 키 일관성 보장.

| 키 | 용도 | 사용처 |
|----|------|--------|
| `queryKeys.dashboard.serviceData(dates, clientIds)` | Dashboard 서비스 데이터 | DashboardClient Phase 3 |
| `queryKeys.dataBoard.fullData(dates)` | DATA 일별 전체 데이터 | DataBoardClient Phase 3 |
| `queryKeys.dataBoard.weeklyFullData(weeks)` | DATA 주별 전체 데이터 | WeeklyClient Phase 3 |
| `queryKeys.dataBoard.monthlyFullData(months)` | DATA 월별 전체 데이터 | MonthlyClient Phase 3 |
| `queryKeys.maCharts.fullServiceData(dates)` | Charts 서비스 데이터 | MA/DataChart Phase 3a |
| `queryKeys.maCharts.widgetData(dates)` | Charts 위젯 데이터 | MA/DataChart Phase 3b |
| `queryKeys.external.daily(startDate, endDate)` | External 일별 데이터 | ExternalClient 월 전환 |

### queryFns (`lib/queries/queryFns.ts`)

AbortSignal을 지원하는 fetch 래퍼. 모든 Phase 3 데이터를 API Route 경유로 가져옴.

| 함수 | API Route | 반환 타입 |
|------|-----------|-----------|
| `fetchDashboardServiceData` | POST `/api/dashboard/service-data` | `DailyServiceRow[]` |
| `fetchDataBoardFullData` | POST `/api/data-board/full-data` | `DailyRawRow[]` |
| `fetchDataBoardWeeklyFullData` | POST `/api/data-board/weekly` | `WeeklyRawRow[]` |
| `fetchDataBoardMonthlyFullData` | POST `/api/data-board/monthly` | `MonthlyRawRow[]` |
| `fetchMaFullServiceData` | POST `/api/charts/ma/full-data` | `DailyServiceRow[]` |
| `fetchMaWidgetData` | POST `/api/charts/widget-data` | `DailyRawRow[]` |
| `fetchExternalData` | POST `/api/external/data` | `{ externalRows, mappings, unitPrices, internalRows }` |

### 사용 패턴

```typescript
const query = useQuery({
  queryKey: queryKeys.dataBoard.fullData(allDates),
  queryFn: ({ signal }) => fetchDataBoardFullData(allDates, signal),
  initialData: quickPayload.rawData,  // Phase 2 데이터
  initialDataUpdatedAt: 0,            // 항상 stale → 백그라운드 refetch
});
```

## 2. Zustand Stores

### useModalStore

```typescript
type ModalType =
  | "recordAction" | "newPipeline" | "clientOverview" | "clientEdit"
  | "actionHistory" | "memo" | "memoView" | "followup"
  | "cvrImport" | "import";

interface ModalStore {
  openModal: ModalType | null;
  payload: Record<string, unknown>;
  open(modal: ModalType, payload?: Record<string, unknown>): void;
  close(): void;
}
```

### useToastStore

```typescript
interface Toast {
  id: string;                              // auto-generated UUID
  type: "success" | "error" | "warning";
  title?: string;
  message: string;
  duration?: number;                       // default: success 3s, error 6s, warning 5s
}

interface ToastStore {
  toasts: Toast[];
  add(toast: Omit<Toast, "id">): void;
  remove(id: string): void;
}
```

## 3. Custom Hooks

### useFilters (`hooks/useFilters.ts`)

URL searchParams 기반 필터 관리.

```typescript
interface GlobalFilters {
  search: string;
  tier: string;
  owner: string;
  stage: string;
  followup: string;
}

function useFilters(): {
  filters: GlobalFilters;
  setFilter(key: keyof GlobalFilters, value: string): void;  // URL param 업데이트
  resetAll(): void;                                            // 전체 필터 초기화
}
```

사용처: FilterNavBar → MGMT, CVR 페이지 필터링

## 4. AI Implementation Guide

### 새 React Query 추가 시

1. `queryKeys.ts`에 키 추가 (네임스페이스.메서드 패턴)
2. `queryFns.ts`에 fetch 함수 추가 (AbortSignal 지원 필수)
3. 대응하는 API Route 생성 (`app/api/...`)
4. Client 컴포넌트에서 `useQuery` 호출

### 새 Store 추가 시

1. `stores/useXxxStore.ts` 생성
2. Zustand `create()` 패턴 사용
3. 상태 최소화 — 파생 값은 `useMemo`로 컴포넌트에서 계산
