# Shared Components & Modals

## Document info
- **Created:** 2026-03-08 17:00:00
- **Last updated:** 2026-03-26 10:00:00

## Revision history
| Date | Description |
|------|-------------|
| 2026-03-08 17:00:00 | Initial version. |
| 2026-03-26 10:00:00 | EmptyState, ErrorFallback 컴포넌트 추가 |

## Covered files
| Path | Role |
|------|------|
| `@/components/common/PageSkeleton.tsx` | 스켈레톤 프리셋 |
| `@/components/common/CascadeSelector.tsx` | Client→Service→Widget 드롭다운 |
| `@/components/common/Combobox.tsx` | 검색 가능 드롭다운 |
| `@/components/common/Toast.tsx` | 글로벌 토스트 렌더러 |
| `@/components/common/ChartTooltip.tsx` | Recharts 툴팁 래퍼 |
| `@/components/common/EmptyState.tsx` | 데이터 없음 상태 표시 |
| `@/components/common/ErrorFallback.tsx` | 에러 폴백 UI |
| `@/components/common/PeriodTypeToggle.tsx` | 월/주/일 토글 |
| `@/components/common/PeriodRangeSlider.tsx` | 기간 슬라이더 |
| `@/components/modals/*` | 전역 모달 컴포넌트 |

## 1. Common Components

### Skeleton (`PageSkeleton.tsx`)

| 컴포넌트 | 용도 | Props |
|----------|------|-------|
| `CardSkeleton` | KPI 카드 로딩 | `className?` |
| `ChartSkeleton` | 차트 영역 로딩 | `className?` |
| `TableSkeleton` | 테이블 로딩 | `cols=8, rows=10, className?` |
| `CardRowSkeleton` | 카드 행 로딩 | `count=3, className?` |
| `PageSkeleton` | 래퍼 (p-6 space-y-6) | `children, className?` |

모든 `loading.tsx`에서 사용. Phase 1 즉시 렌더.

---

### EmptyState

데이터 없음 상태의 중앙 정렬 메시지.

```typescript
interface Props {
  message?: string;        // 기본: "데이터가 없습니다"
  className?: string;      // 레이아웃 조정용
}
```

사용처: ClientMonthlyVimpTable, Pipeline, External 등

---

### ErrorFallback

에러 발생 시 중앙 정렬된 에러 메시지 UI.

```typescript
interface Props {
  message?: string;        // 주요 에러 메시지
  detail?: string;         // 상세 에러 (error.message)
  className?: string;      // 레이아웃 조정용
}
```

사용처: page.tsx 서버 컴포넌트의 fetch 실패 시

---

### CascadeSelector

Client → Service → Widget 3단 연쇄 드롭다운.

```typescript
interface Props {
  defaultClientId?: string;
  lockClient?: boolean;          // Client 고정 (수정 불가)
  onChange: (selection: CascadeSelection) => void;
}
```

사용처: RecordActionModal, AddClientModal

---

### Combobox

검색 가능 드롭다운 (Popover + Command 패턴).

```typescript
interface Props {
  options: { id: string; name: string }[];
  value: string | null;
  onChange: (id: string | null) => void;
  placeholder?: string;
  allLabel?: string;             // "전체" 항목 라벨
  searchable?: boolean;
}
```

사용처: CascadeSelector 내부, 필터 드롭다운

---

### PeriodTypeToggle

월/주/일 전환 버튼.

```typescript
interface Props {
  value: PeriodType;             // "daily" | "weekly" | "monthly"
  onChange: (type: PeriodType) => void;
  variant?: "default" | "dense"; // default: 회색, dense: 파란색
}
```

사용처: Dashboard, Charts

---

### PeriodRangeSlider

기간 범위 슬라이더.

```typescript
interface Props {
  periodType: PeriodType;
  value: number;
  onChange: (n: number) => void;
  maxOverride?: number;          // Phase 3 로딩 중 제한
}
```

범위: daily 7–90, weekly 4–52, monthly 2–12

사용처: Dashboard, Data-Board 필터 바

---

### ChartTooltip

Recharts 커스텀 툴팁.

```typescript
interface Props {
  items: { color: string; label: string; value: string | number }[];
  title?: ReactNode;
}
```

사용처: 모든 차트 컴포넌트

---

### Toast

글로벌 토스트 (Root Layout에 싱글턴).

- success (3초), error (6초), warning (5초) 자동 닫힘
- `useToastStore().add({ type, message })` 로 호출

## 2. Modal System

### 아키텍처

```
useModalStore.open(type, payload)
  → openModal 상태 변경
  → Root Layout의 Modal 컴포넌트가 렌더링
  → 닫기: useModalStore.close()
```

### Modal 목록

| Type | 컴포넌트 | 용도 | 트리거 |
|------|----------|------|--------|
| `recordAction` | RecordActionModal | 활동 기록 | MGMT Stage + 클릭 |
| `actionHistory` | ActionHistoryModal | 활동 이력 조회 | MGMT History 클릭 |
| `clientOverview` | ClientOverviewSheet | 클라이언트 상세 (사이드 시트) | MGMT Client 클릭 |
| `clientEdit` | AddClientModal | 클라이언트/서비스/위젯 추가 | 시트 내 편집 |
| `followup` | (FollowupModal) | 후속 조치 | MGMT F/up 벨 클릭 |
| `memoView` | MemoViewModal | 메모 읽기 전용 | MGMT Memo 클릭 |
| `memo` | MemoEditor | 메모 편집 (BlockNote) | 활동 기록 내 |
| `import` | ImportModal | 데이터 임포트 (다단계) | 헤더 임포트 버튼 |
| `cvrImport` | ImportModal (CVR 모드) | CVR 임포트 | CVR 임포트 버튼 |

### 모달 호출 예시

```typescript
const { open } = useModalStore();
open("clientOverview", { clientId: "123" });
open("actionHistory", { clientId: "123", clientName: "광고주A" });
```

## 3. AI Implementation Guide

### 새 공용 컴포넌트 추가 시

1. `components/common/`에 생성
2. 2곳 이상에서 사용될 때만 공용으로 추출
3. Props interface export 필수
4. JSDoc 필수

### 새 모달 추가 시

1. `components/modals/ModalName/` 폴더 생성
2. `index.ts`에서 re-export
3. `ModalType` union에 타입 추가 (`stores/useModalStore.ts`)
4. Root Layout에 렌더링 추가
5. `useModalStore.open("newType", payload)` 로 호출
