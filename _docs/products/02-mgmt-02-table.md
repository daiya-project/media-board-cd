# Management Table (MGMT 섹션)

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
| `@/app/management/page.tsx` | 서버 페이지 (데이터 fetch + 에러 처리) |
| `@/app/management/_components/MgmtTable.tsx` | 메인 테이블 (정렬 상태 관리) |
| `@/app/management/_components/MgmtTableRow.tsx` | 개별 행 (모달 트리거) |
| `@/app/management/_components/MgmtTableSort.tsx` | 정렬 로직 + Th 컴포넌트 |
| `@/lib/api/mgmtService.ts` | 데이터 fetch 서비스 |

## 1. Overview
- **Path:** `app/management/`
- **Purpose:** 클라이언트(광고주)별 관리 현황 테이블. 11개 컬럼 정렬, URL 기반 필터(search, tier, owner, stage, followup), 행 클릭으로 상세 모달 진입.

## 2. Key Props & State

### 서버 → 클라이언트

```typescript
interface Props {
  initialData: MgmtTableRow[];  // 서버에서 필터 적용된 결과
}
```

### 클라이언트 State

| State | Type | Default | Purpose |
|-------|------|---------|---------|
| `sort` | `SortState<SortField>` | `{ field: null, direction: "none" }` | 컬럼 정렬 |

**단순 구조**: Phase 2만으로 완료 (Phase 3 없음). 필터는 서버 사이드 URL 파라미터.

## 3. Core Logic & Interactions

### 데이터 플로우

```
URL params (search, tier, owner, stage, followup)
  → [Server] getMgmtTableData(params) → MgmtTableRow[]
  → [Client] MgmtTable: sortRows(initialData, sort)
  → 렌더링
```

### 정렬 (11개 필드)

| Field | 정렬 방식 |
|-------|-----------|
| lastDate | 문자열 비교 (YYYY-MM-DD) |
| product (매중도) | TIER_ORDER 맵 (상=1, 중=2, 하=3, 기타=4) |
| client | 대소문자 무시 문자열 |
| count (History) | 숫자 (actionCount) |
| followup (F/up) | 숫자 (followupCount) |
| owner (담당자) | 대소문자 무시 문자열 |
| currentStage | STAGE_ORDER 맵 (contact=1, meeting=2, propose=3, done=4) |
| lastMemo | BlockNote에서 추출한 plain text |
| contactName/Phone/Email | 문자열 비교 |

모든 필드에 `compareNullable()` 사용 (null은 항상 마지막).

### 모달 트리거 (MgmtTableRow)

| 클릭 대상 | 모달 | 전달 데이터 |
|-----------|------|-------------|
| CLIENT 이름 | `clientOverview` | `{ clientId }` |
| History 숫자 | `actionHistory` | `{ clientId, clientName }` |
| F/up 벨 아이콘 | `followup` | `{ clientId }` |
| STAGE + 아이콘 | `recordAction` | `{ clientId, clientName }` |
| MEMO 텍스트 | `memoView` | `{ memo }` |

모달은 `useModalStore.open(type, data)` 으로 트리거.

## 4. AI Implementation Guide (For vibe coding)

### State → Action → Implementation

| State / condition | Meaning | Use this function / API | Where to implement |
|---|---|---|---|
| 컬럼 헤더 클릭 | 정렬 전환 | `cycleSortDirection()` + `sortRows()` | MgmtTable handleSort |
| 행 버튼 클릭 | 모달 열기 | `useModalStore.open()` | MgmtTableRow |
| URL 필터 변경 | 서버 재fetch | `getMgmtTableData()` | page.tsx (서버 컴포넌트) |
| 새 컬럼 추가 | 정렬 + 표시 | SortField 타입 + sortRows 케이스 + Th + TableRow 셀 | MgmtTableSort + MgmtTable + MgmtTableRow |
| 새 모달 추가 | 행 인터랙션 | useModalStore + 모달 컴포넌트 | MgmtTableRow + components/modals/ |

### Dependencies
- `@/lib/api/mgmtService` — getMgmtTableData
- `@/lib/utils/sort-utils` — cycleSortDirection, compareNullable, SortState
- `@/stores/useModalStore` — open(type, data)
