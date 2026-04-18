# Pipeline Board (Pipeline 섹션)

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
| `@/app/pipeline/page.tsx` | 서버 페이지 (Phase 2 fetch, 2-패널 레이아웃) |
| `@/app/pipeline/_components/ContactDueList.tsx` | 좌측 패널 (컨택 도래 클라이언트 목록) |
| `@/app/pipeline/_components/RecentActivities.tsx` | 우측 패널 (최근 활동 피드) |
| `@/lib/api/pipelineService.ts` | 데이터 fetch 서비스 (컨택 상태 계산, 활동 조회) |

## 1. Overview
- **Path:** `app/pipeline/`
- **Purpose:** CRM 스타일 대시보드. 좌측에 컨택 주기 도래/초과 클라이언트 목록, 우측에 최근 활동 타임라인을 표시.

## 2. Key Props & State

### 서버 → 클라이언트

```typescript
// ContactDueList
interface ContactDueListProps {
  clients: ContactStatusRow[];  // 컨택 도래 클라이언트 (overdue/urgent/upcoming만)
}

// RecentActivities
interface RecentActivitiesProps {
  activities: RecentActivity[];  // 최근 활동 목록 (50~100건)
  todayDate: string;             // DB 최신 날짜 (상대 날짜 계산용)
}
```

### 주요 타입

```typescript
interface ContactStatusRow {
  client_id: string;
  client_name: string;
  tier: "상" | "중" | "하" | "기타" | null;
  manager_name: string | null;
  rule_day: number;              // 티어별 컨택 주기 (일)
  last_action_date: string | null;
  last_stage: string | null;
  days_elapsed: number | null;   // 마지막 컨택 이후 경과일
  days_remaining: number | null; // 컨택 기한까지 남은 일
  contact_status: ContactStatus; // "overdue" | "urgent" | "upcoming"
}

interface RecentActivity {
  action_id: number;
  client_id: string;
  client_name: string;
  action_date: string;
  stage: ActionStage | null;     // "contact" | "meeting" | "propose" | "done" | "memo"
  memo: BlockNoteContent | null;
  has_followup: boolean;
}
```

## 3. Core Logic & Interactions

### Phase 2 로딩 (Phase 3 없음)

```
page.tsx (서버 await):
  getLatestDataDate() → todayDate
  Promise.all([
    getContactDueClients(todayDate),
    getRecentActivities(100)
  ])
  → ContactDueList + RecentActivities (props 전달)
```

### 컨택 상태 계산 알고리즘 (getContactDueClients)

```
1. 병렬 fetch:
   - contact_rule (티어별 주기 + 필수 스테이지)
   - client (활성 클라이언트 + tier)
   - ref_manager (media 팀만)

2. 필터: tier에 활성 contact_rule이 있는 클라이언트만

3. action 히스토리 조회:
   - media.action에서 대상 클라이언트의 모든 액션
   - 1000행 배치 페이지네이션

4. 클라이언트별 상태 계산:
   - 필수 스테이지(required_stages)에 해당하는 가장 최근 액션 찾기
   - daysElapsed = todayDate - lastActionDate
   - daysRemaining = rulDay - daysElapsed
   - 분류:
     daysElapsed > rule_day     → overdue
     daysRemaining ≤ 7          → urgent
     daysRemaining ≤ 30         → upcoming
     else                       → ok (결과에서 제외)

5. 정렬: days_remaining ASC (가장 긴급한 순)
```

### 컨택 상태 색상 & 아이콘

| 상태 | 아이콘 | 배경 | 텍스트 |
|------|--------|------|--------|
| overdue (초과) | AlertTriangle | bg-red-50 | text-red-600, "N일 초과" |
| urgent (긴급) | Clock | bg-amber-50 | text-amber-600, "N일 남음" |
| upcoming (도래) | CalendarClock | bg-blue-50 | text-blue-600, "N일 남음" |

### StatusSummary (상단 요약 배지)

```
[! overdue N건] [⏰ urgent N건] [📅 upcoming N건]
```
- 각 상태별 건수를 아이콘 + 숫자 배지로 표시

### 최근 활동 피드 (RecentActivities)

```
activities → useMemo groupByDate()
  → Map<date, Activity[]> (날짜별 그룹핑)

날짜 헤더 포맷:
  todayDate와 동일     → "오늘"
  todayDate - 1        → "어제"
  2~6일 전             → "N일 전"
  7일+ 전              → "M월 N일"
```

### 스테이지 아이콘 매핑

| Stage | 아이콘 | 색상 (배경) |
|-------|--------|-------------|
| contact | Phone | gray |
| meeting | Users | blue |
| propose | FileText | red |
| done | CheckCircle2 | green |
| memo | MessageSquareText | purple |

### 메모 프리뷰 & 모달

- `extractHeadingPreview(blocks, 60)` → 첫 H3 제목 추출 (60자 제한)
- 프리뷰 클릭 → `useModalStore.open("memoView", { memo, clientName })`
- `MemoViewModal` → BlockNote 뷰어로 전체 메모 표시 (동적 임포트)

### 팔로업 표시

- `has_followup = true` → 빨간 벨 아이콘 (BellRing) 표시

## 4. AI Implementation Guide (For vibe coding)

### State → Action → Implementation

| State / condition | Meaning | Use this function / API | Where to implement |
|---|---|---|---|
| 컨택 주기 변경 | 티어별 규칙 수정 | `media.contact_rule` 테이블 | DB 직접 수정 |
| 새 스테이지 추가 | 액션 타입 확장 | ActionStage 타입 + STATUS_CONFIG | app-db.types.ts + ContactDueList + RecentActivities |
| 메모 클릭 | 전체 메모 보기 | useModalStore.open("memoView") | RecentActivities |
| 활동 건수 변경 | 표시 건수 조절 | getRecentActivities(limit) | page.tsx |
| 상태 분류 기준 변경 | urgent/upcoming 임계값 | getContactDueClients 분류 로직 | pipelineService.ts |
| 새 컬럼/정보 추가 | 클라이언트 행 확장 | ContactStatusRow + ClientRow 컴포넌트 | pipelineService.ts + ContactDueList |

### Modification rules

- **상태 분류 기준 변경**: `pipelineService.ts` `getContactDueClients()` 내 분류 로직 수정
- **피드 항목 추가**: `RecentActivities` `ActivityItem` 서브컴포넌트 + `RecentActivity` 타입 확장
- **새 스테이지 아이콘**: `RecentActivities` `StageIcon` 서브컴포넌트에 case 추가
- **컨택 주기 규칙 변경**: `media.contact_rule` 테이블 (required_stages, rule_day)

### Dependencies
- `@/lib/api/pipelineService` — getContactDueClients, getRecentActivities
- `@/lib/api/managerService` — getAllManagers, buildManagerMap
- `@/lib/api/dateService` — getLatestDataDate
- `@/lib/utils/blocknote-utils` — extractHeadingPreview
- `@/lib/utils/table-display-utils` — getTierBadgeClass, getStageBadgeClass, getContactStatusStyle
- `@/stores/useModalStore` — memoView 모달 열기
