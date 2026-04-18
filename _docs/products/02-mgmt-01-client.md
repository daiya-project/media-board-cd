# MGMT — Client Overview Sheet (MGMT 섹션)

## Document info
- **Created:** 2026-03-08 15:00:00
- **Last updated:** 2026-03-26 10:00:00

## Revision history
| Date | Description |
|------|-------------|
| 2026-03-08 15:00:00 | Initial version. |
| 2026-03-26 10:00:00 | 표준 템플릿 포맷으로 리팩터 |

## Covered files
| Path | Role |
|------|------|
| `@/components/modals/ClientOverviewSheet.tsx` | Sheet UI (Client Component) |
| `@/app/api/client-detail/route.ts` | API Route — GET 핸들러 |
| `@/lib/api/clientDetailService.ts` | 데이터 조회 서비스 (Server-side) |

## 1. Overview
- **Path:** `components/modals/ClientOverviewSheet.tsx`
- **Purpose:** MGMT 테이블에서 클라이언트 이름을 클릭하면 우측에서 슬라이드-인되는 Sheet. 클라이언트의 전체 서비스 → 위젯 → 계약 구조를 한눈에 파악할 수 있다.

## 2. Key Props & State

### 진입 경로

MGMT 테이블 **CLIENT** 열에서 클라이언트명 클릭 → `useModalStore.open("clientOverview", { clientId })`

### 클라이언트 State

| State | Type | Default | Purpose |
|-------|------|---------|---------|
| `data` | `ClientDetailFull \| null` | `null` | fetch 결과 |
| `loading` | `boolean` | `false` | 로딩 스피너 |
| `error` | `string \| null` | `null` | 에러 메시지 |
| `showActiveOnly` | `boolean` | `true` | Only Activate 필터 |

### 응답 타입

```typescript
interface ClientDetailFull {
  client_id: string;
  client_name: string;
  tier: "상" | "중" | "하" | "기타" | null;
  manager_id: number | null;
  manager_name: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  services: ServiceWithWidgets[];
  totalServices: number;
  totalWidgets: number;
  activeWidgets: number;
}
```

## 3. Core Logic & Interactions

### 데이터 플로우

```
MgmtTableRow (클릭)
  → useModalStore.open("clientOverview", { clientId })
    → ClientOverviewSheet (Sheet 렌더)
      → useEffect: fetch("/api/client-detail?clientId=...")
        → API Route (GET)
          → getClientDetailFull(clientId)  [Server]
            → Supabase 6개 테이블 병렬 쿼리
```

### 서버 쿼리 (2단계 병렬)

**1차 배치 (Promise.all):**

| 쿼리 | 테이블 | 내용 |
|------|--------|------|
| clientResult | `media.client` | 클라이언트 마스터 (single) |
| servicesResult | `media.service` | 소속 서비스 목록 |
| widgetsResult | `media.widget` | 소속 위젯 목록 |
| managersResult | `media.ref_manager` | 전체 매니저 목록 |

**2차 배치 (Promise.all):** — 위젯 ID 목록 확보 후

| 쿼리 | 테이블 | 내용 |
|------|--------|------|
| contractsResult | `media.widget_contract` | 위젯별 계약 (date_start DESC) |
| dailyResult | `media.daily` | 최근 30일 데이터 존재 위젯 |

### 데이터 가공

1. **Manager Map** — `id → name.split(" ")[0]` 매핑 (담당자 이름 규칙)
2. **Active Widget Set** — `media.daily` 30일 내 데이터가 있는 widget_id를 `Set<string>`으로 구성
3. **Contract Map** — `widget_id → 최신 계약` 매핑 (첫 번째만 채택, 이미 date_start DESC 정렬)
4. **Service → Widget 그룹핑** — 서비스별로 위젯을 묶고, 각 위젯에 계약 정보와 활성 상태를 병합

### Sheet 헤더

| 항목 | 설명 |
|------|------|
| Tier 배지 | 매체 중요도 (상 / 중 / 하 / 기타) |
| 클라이언트명 | `{client_id}. {client_name}` 형식 |
| Service 수 | 해당 클라이언트에 등록된 전체 서비스 수 |
| Widget 수 | 전체 위젯 수 |
| Activate 수 | 활성 위젯 수 (최근 30일 내 데이터 존재) |
| Only Activate 토글 | 체크 시 활성 위젯이 있는 서비스만 필터 |
| 담당자 배지 | 담당 매니저 이름 (공백 기준 첫 번째 단어만 표시) |

### 위젯 행 컬럼

| 컬럼 | 설명 |
|------|------|
| Widget ID | 위젯 고유 ID (모노스페이스 코드 스타일) |
| Widget Name | 위젯명 |
| Type | 계약 타입 배지 (RS, CPM, MCPM, CPC, HYBRID) |
| GRT Value | 계약 단가 — RS/HYBRID: `n%`, CPM/MCPM/CPC: `n,nnn원` |
| Period | 계약 기간 (`YYYY-MM-DD ~ YYYY-MM-DD`) |
| Activate | 활성 상태 불릿 (초록: 활성, 회색: 비활성) |

### 활성 위젯 판정

위젯의 **최근 30일 이내** `media.daily` 테이블에 데이터가 1건 이상 존재하면 "활성" 판정.

### 계약 타입 스타일링

| 타입 | 배경 | 텍스트 | 테두리 |
|------|------|--------|--------|
| RS / R/S | 빨강 계열 | #dc2626 | #fecaca |
| CPM / MCPM | 파랑 계열 | #2563eb | #bfdbfe |
| HYBRID | 초록 계열 | #16a34a | #bbf7d0 |
| CPC | 주황 계열 | #ea580c | #fed7aa |

### 컴포넌트 구조

```
ClientOverviewSheet          ← Sheet 최상위 (모달 상태 + fetch)
├── Header Section           ← Tier 배지, 클라이언트명, 통계, 토글, 액션 버튼
├── Sticky Table Header      ← 위젯 컬럼 헤더 (sticky top-0)
└── ServiceCard[]            ← 서비스별 카드 (내부 컴포넌트)
    └── WidgetRow[]          ← 위젯 행 (내부 컴포넌트)
        └── ShareTypeBadge   ← 계약 타입 배지 (내부 컴포넌트)
```

- 모든 하위 컴포넌트는 같은 파일 내 정의
- shadcn/ui `Sheet` + `SheetContent(side="right")` 사용, 너비 800px 고정

### 모달 간 전환

| 버튼 | 동작 |
|------|------|
| `+` (Plus) | `open("newPipeline", { mode: "add", clientId, clientName })` → 서비스/위젯 추가 |
| 연필 (Pencil) | `open("newPipeline", { mode: "edit", clientId, clientName, managerId, tier, ... })` → 정보 수정 |
| `×` (X) | Sheet 닫기 |

`useModalStore`는 단일 모달만 열 수 있으므로, 새 모달이 열리면 Sheet는 자동으로 닫힌다.

### cleanup 처리

- `useEffect` 내 `cancelled` 플래그로 언마운트/재실행 시 stale 응답 무시
- Sheet 닫힐 때 `data`, `error`를 `null`로 초기화

## 4. AI Implementation Guide (For vibe coding)

### State → Action → Implementation

| State / condition | Meaning | Use this function / API | Where to implement |
|---|---|---|---|
| 클라이언트명 클릭 | Sheet 열기 | `useModalStore.open("clientOverview")` | MgmtTableRow |
| Sheet isOpen 변경 | 데이터 fetch | `GET /api/client-detail` → `getClientDetailFull()` | ClientOverviewSheet useEffect |
| Only Activate 토글 | 서비스 필터 | `setShowActiveOnly()` | ClientOverviewSheet |
| 편집 버튼 클릭 | 모달 전환 | `open("newPipeline", { mode: "edit" })` | ClientOverviewSheet |
| 추가 버튼 클릭 | 모달 전환 | `open("newPipeline", { mode: "add" })` | ClientOverviewSheet |
| 위젯 컬럼 추가 | 행 확장 | WidgetRow 서브컴포넌트 | ClientOverviewSheet.tsx |
| 계약 포맷 변경 | 값 표시 변경 | `formatContractValue()` | contract-utils.ts |

### Modification rules

- **위젯 컬럼 추가**: `ClientOverviewSheet.tsx` 내 WidgetRow 서브컴포넌트 수정
- **계약 타입 추가**: `contract-utils.ts` `SHARE_TYPE_STYLES` + `formatContractValue()` 확장
- **새 헤더 정보 추가**: `ClientOverviewSheet.tsx` Header Section + `clientDetailService.ts` 쿼리 확장
- **API 응답 필드 추가**: `clientDetailService.ts` SELECT + `ClientDetailFull` 타입 확장

### Dependencies
- `@/lib/api/clientDetailService` — getClientDetailFull
- `@/lib/utils/contract-utils` — SHARE_TYPE_STYLES, formatContractValue, formatContractPeriod
- `@/lib/utils/table-display-utils` — getTierBadgeClass
- `@/stores/useModalStore` — open, close
