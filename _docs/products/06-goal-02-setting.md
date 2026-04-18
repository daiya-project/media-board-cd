# Goal Setting (Settings 섹션)

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
| `@/app/settings/goal-setting/page.tsx` | 서버 페이지 (Phase 2 fetch, 연도 결정) |
| `@/app/settings/goal-setting/_components/GoalSettingTable.tsx` | 메인 클라이언트 (인라인 편집 테이블) |
| `@/lib/api/goalSettingService.ts` | 데이터 fetch + upsert 서비스 |
| `@/app/api/goal/setting/route.ts` | API 라우트 (GET/POST) |

## 1. Overview
- **Path:** `app/settings/goal-setting/`
- **Purpose:** 월별 vIMP 목표를 팀 레벨 + 매니저별로 설정하는 인라인 편집 테이블. 12개 월 × (팀 목표 + 합계 + 갭 + N명 매니저) 구조.

## 2. Key Props & State

### 서버 → 클라이언트

```typescript
interface Props {
  year: number;              // DB 최신 날짜 기준 연도
  teamGoals: GoalRow[];      // 팀 레벨 목표 (manager_id = null)
  managerGoals: GoalRow[];   // 매니저별 목표
  managers: ManagerRow[];    // media 팀 매니저 목록
}
```

### 클라이언트 State

| State | Type | Default | Purpose |
|-------|------|---------|---------|
| `goalMap` | `Map<string, number>` | buildGoalMap(goals) | `"managerId\|month"` → vimp_target 매핑 |
| `editingCell` | `CellKey \| null` | `null` | 현재 편집 중인 셀 { month, managerId } |
| `editValue` | `string` | `""` | 편집 입력값 |
| `saving` | `boolean` | `false` | 저장 진행 중 |

## 3. Core Logic & Interactions

### 테이블 구조

```
| 월 (sticky) | Team Goal | Total | Gap | 매니저1 | 매니저2 | ... |
|-------------|-----------|-------|-----|---------|---------|-----|
| 2026년 01월 | 1,000,000 | 950,000 | 50,000 | 500,000 | 450,000 | ... |
| ...         | ...       | ...     | ... | ...     | ...     | ... |
| 2026년 12월 | ...       | ...     | ... | ...     | ...     | ... |
```

- **12행** (1월~12월)
- **Team Goal**: 팀 전체 목표 (편집 가능, manager_id = null)
- **Total**: 매니저 목표 합계 (읽기 전용, 자동 계산)
- **Gap**: Team Goal - Total (읽기 전용, 자동 계산)
- **매니저 컬럼**: 개별 매니저 목표 (편집 가능)

### goalMap 키 구조

```typescript
// 키: "{managerId ?? 'null'}|{month}"
"null|3"  → 팀 3월 목표
"5|3"     → 매니저(id=5) 3월 목표
```

### 인라인 편집 플로우

```
Double-click 셀
  → setEditingCell({ month, managerId })
  → setEditValue(현재값)
  → input.focus()

Enter / Blur
  → handleSave()
    → POST /api/goal/setting {
        managerId, monthStart, monthEnd, vimpTarget
      }
    → upsertMonthlyGoal()
      → 기존 행 존재? UPDATE : INSERT
    → setGoalMap() (로컬 상태 업데이트)
    → 성공: 편집 모드 종료
    → 실패: toast("목표 저장에 실패했습니다.")

Escape
  → handleCancel() → 편집 모드 종료 (변경 취소)
```

### Gap 계산 & 색상

```typescript
const rawGap = teamGoal - managerTotal;
const gap = Math.abs(rawGap) <= 101 ? 0 : rawGap;
// ±101 이하 → 0으로 처리 (노이즈 제거)
```

| 조건 | 의미 | 색상 |
|------|------|------|
| gap > 0 | 미배분 (under-allocated) | 빨강 (text-red-600) |
| gap < 0 | 초과 배분 (over-allocated) | 주황 (text-amber-600) |
| gap = 0 | 균형 | 회색 (text-gray-400) |

### API 엔드포인트

**GET /api/goal/setting?year=2026**
- 응답: `{ teamGoals: GoalRow[], managerGoals: GoalRow[] }`

**POST /api/goal/setting**
- 요청: `{ managerId, monthStart, monthEnd, vimpTarget }`
- 응답: `{ success: true }`
- upsert: (manager_id, date_start) 기준으로 UPDATE 또는 INSERT

## 4. AI Implementation Guide (For vibe coding)

### State → Action → Implementation

| State / condition | Meaning | Use this function / API | Where to implement |
|---|---|---|---|
| 셀 더블클릭 | 편집 모드 진입 | handleDoubleClick | GoalSettingTable |
| Enter / Blur | 저장 | `POST /api/goal/setting` → upsertMonthlyGoal | GoalSettingTable handleSave |
| Escape | 편집 취소 | handleCancel | GoalSettingTable |
| Gap 표시 로직 변경 | 임계값/색상 수정 | gap 계산 로직 | GoalSettingTable (인라인) |
| 새 목표 타입 추가 | goal_type 확장 | upsertMonthlyGoal + 쿼리 필터 | goalSettingService.ts |
| 연도 전환 추가 | 다른 연도 목표 조회 | year param 변경 | page.tsx searchParams |

### Modification rules

- **컬럼 추가**: GoalSettingTable 테이블 헤더 + 셀 렌더링 추가
- **목표 타입 추가**: `goalSettingService.ts` 쿼리 필터 + API route 확장
- **일괄 편집 기능**: GoalSettingTable에 bulk edit 모드 + batch API 호출
- **연도 네비게이션**: page.tsx에 searchParams `year` 파싱 + UI 추가

### Dependencies
- `@/lib/api/goalSettingService` — getTeamGoalsForYear, getManagerGoalsForYear, upsertMonthlyGoal
- `@/lib/api/managerService` — getAllManagers
- `@/lib/api/dateService` — getLatestDataDate
- `@/lib/utils/number-utils` — formatNumberForDisplay
- `@/stores/useToastStore` — 에러/성공 토스트
