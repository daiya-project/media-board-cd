# CVR Manager (CVR 섹션)

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
| `@/app/cvr/page.tsx` | 서버 페이지 (getCvrPayload fetch) |
| `@/app/cvr/_components/CvrManagerClient.tsx` | 메인 클라이언트 (viewMode, 레벨 필터, 정렬, 검색) |
| `@/app/cvr/_components/CvrTableMonthly.tsx` | 월별 뷰 테이블 (14컬럼, 정렬 가능) |
| `@/app/cvr/_components/CvrTableYearly.tsx` | 연도별 뷰 테이블 (13개월 레벨 추이, 읽기 전용) |
| `@/lib/api/cvrService.ts` | 데이터 fetch 서비스 |

## 1. Overview
- **Path:** `app/cvr/`
- **Purpose:** 서비스별 CVR(전환율) 분석. 월별 뷰(상세 지표 + 정렬)와 연도별 뷰(13개월 레벨 추이 A-F)를 전환하여 표시.

## 2. Key Props & State

### 서버 → 클라이언트

```typescript
interface CvrPayload {
  selectedMonth: string;                    // 현재 선택 월 (YYYY-MM)
  availableMonths: string[];                // 선택 가능한 월 목록
  rows: CvrRawRow[];                        // 해당 월의 CVR 데이터
  prevLevels: Record<string, string|null>;  // service_id → 전월 레벨
  pastMonthLevels: Array<{                  // 13개월 레벨 히스토리
    month: string;
    levels: Record<string, string|null>;
  }>;
}
```

### 클라이언트 State

| State | Type | Default | Purpose |
|-------|------|---------|---------|
| `viewMode` | `"month" \| "year"` | `"month"` | 월별/연도별 뷰 전환 |
| `selectedLevels` | `string[]` | `[]` | 레벨 필터 (A-F, 비어있으면 전체) |
| `sort` | `SortState<CvrSortField>` | none | 정렬 상태 (월별 뷰만) |
| `search` | URL `?search=` | `""` | 검색어 (URL에서 읽기) |

## 3. Core Logic & Interactions

### 데이터 플로우

```
URL param ?month=YYYY-MM
  → [Server] getCvrPayload(month) → CvrPayload
  → [Client] CvrManagerClient
      → filteredRows = filter(rows, search, selectedLevels)
      → sortedRows = sortCvrRows(filteredRows, sort, prevLevels)
      → viewMode === "month" ? CvrTableMonthly : CvrTableYearly
```

### 월별 뷰 (CvrTableMonthly)

14개 컬럼, 모두 정렬 가능:

| 컬럼 | 필드 | 포맷 |
|------|------|------|
| Client (sticky) | client_id | 숫자 |
| Service (sticky) | service_name | 텍스트 |
| vIMP | vimp | 천 단위 구분 |
| 당월 레벨 | level | LevelBadge (A-F 색상) |
| 전월 레벨 | prevLevels[service_id] | LevelBadge |
| CMR | contribution_margin_rate_pct | X.XX% |
| CVR | normalized_cvr_pct | X.XX% |
| Type | service_type | 텍스트 |
| Revenue | revenue | 천 단위 구분 |
| RPM | rpm | 천 단위 구분 |
| vCTR | vctr_pct | X.XX% |
| CPC | cpc | 천 단위 구분 |
| Invalid | invalid_revenue_ratio_pct | X.XX% |
| Campaign | campaign_count | 숫자 |

### 연도별 뷰 (CvrTableYearly)

- Client, Service, vIMP + **13개월 레벨 컬럼**
- 정렬 없음 (vimp DESC 고정)
- 선택된 월 컬럼 amber 하이라이트
- 읽기 전용 (레벨 추이 확인용)

### 레벨 시스템 (A-F)

| Level | 조건 | 색상 |
|-------|------|------|
| A | CMR ≥ 10 AND CVR ≥ 100 | lime |
| B | CMR ≥ 10 AND CVR < 90 | blue |
| C | CMR < 0 AND CVR ≥ 100 | amber |
| D | CMR < 0 AND CVR < 90 | red |
| E | 0 ≤ CMR < 10 | violet |
| F | 둘 다 null | muted |

### 월 이동

`goToMonth(month)` → `router.push(/cvr?month=YYYY-MM)` → 서버 페이지 재로딩 (새 payload)

## 4. AI Implementation Guide (For vibe coding)

### State → Action → Implementation

| State / condition | Meaning | Use this function / API | Where to implement |
|---|---|---|---|
| viewMode 전환 | 월별↔연도별 | setViewMode | CvrManagerClient |
| 레벨 뱃지 클릭 | 레벨 필터 토글 | toggleLevel / clearLevels | CvrManagerClient |
| 컬럼 헤더 클릭 | 정렬 (월별만) | cycleSortDirection + sortCvrRows | CvrManagerClient handleSort |
| 월 선택 변경 | 서버 재fetch | router.push() | CvrManagerClient goToMonth |
| 검색어 변경 | 필터링 | filteredRows useMemo | URL search param |
| 새 컬럼 추가 | 표시 + 정렬 | CvrSortField 타입 + sortCvrRows 케이스 + Th + 셀 | CvrTableMonthly |
| 레벨 기준 변경 | calcLevel 수정 | `@/lib/utils/calculate-utils` | calculate-utils.ts |

### Dependencies
- `@/lib/api/cvrService` — getCvrPayload
- `@/lib/utils/sort-utils` — cycleSortDirection, compareNullable
- `@/lib/utils/calculate-utils` — calcLevel (임포트 시에만)
