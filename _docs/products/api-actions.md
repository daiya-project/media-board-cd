# Actions API (Meeting Log)

## Document info
- **Created:** 2026-03-18 15:00:00
- **Last updated:** 2026-03-18 15:00:00

## Revision history
| Date | Description |
|------|-------------|
| 2026-03-18 15:00:00 | Initial version. |

## Covered files
Files documented by this doc. **When you modify any of these, update this doc.**

| Path | Role |
|------|------|
| `@/app/api/actions/route.ts` | API route handler |
| `@/lib/api/actionService.ts` | Action CRUD service (browser-side) |
| `@/lib/utils/blocknote-utils.ts` | BlockNote plain-text extraction |

## 1. Overview
- **Path:** `app/api/actions/route.ts`
- **Purpose:** 클라이언트 미팅/영업 활동 기록(Action)을 조회하는 REST API. Claude Code 등 외부 도구에서 미팅 로그를 가져올 때 사용.

## 2. Base URL

```
https://media-board.netlify.app/api/actions
```

## 3. Endpoint

### `GET /api/actions`

액션(미팅 로그) 목록을 조회한다.

### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `clientId` | string | No | - | 클라이언트 ID로 필터 |
| `stage` | string | No | - | 영업 단계 필터. `contact` \| `meeting` \| `propose` \| `done` \| `memo` |
| `from` | string | No | - | 시작 날짜 (inclusive, `YYYY-MM-DD`) |
| `to` | string | No | - | 종료 날짜 (inclusive, `YYYY-MM-DD`) |
| `limit` | number | No | 100 | 최대 반환 행 수 (최대 1000) |
| `format` | string | No | `plain` | `plain`: memo를 평문 텍스트로 변환. `raw`: BlockNote JSONB 원본 반환 |

### Response

```jsonc
// 200 OK — Array of action records
[
  {
    "action_id": 173,
    "client_id": "3851",
    "client_name": "오토데일리(엠투데이)",
    "service_id": null,
    "widget_id": null,
    "action_date": "2026-03-13",
    "stage": "meeting",
    "memo": "5년 4분기 중단매체 재활성화 목표로 미팅 진행 ...",
    "has_followup": false,
    "created_at": "2026-03-16T00:35:22.448671+00:00"
  }
]
```

```jsonc
// 400 Bad Request — invalid stage
{ "error": "Invalid stage \"xyz\". Valid: contact, meeting, propose, done, memo" }

// 500 Internal Server Error
{ "error": "Failed to fetch actions" }
```

## 4. Usage Examples

### 전체 미팅 로그 조회 (최근 100건)
```bash
curl 'https://media-board.netlify.app/api/actions?stage=meeting'
```

### 특정 클라이언트의 전체 액션 조회
```bash
curl 'https://media-board.netlify.app/api/actions?clientId=3851'
```

### 날짜 범위 + 단계 필터
```bash
curl 'https://media-board.netlify.app/api/actions?stage=meeting&from=2026-03-01&to=2026-03-31'
```

### 최근 5건만 조회
```bash
curl 'https://media-board.netlify.app/api/actions?limit=5'
```

### BlockNote 원본 JSONB로 조회
```bash
curl 'https://media-board.netlify.app/api/actions?format=raw&limit=3'
```

### jq로 특정 필드만 추출
```bash
curl -s 'https://media-board.netlify.app/api/actions?stage=meeting' \
  | jq '.[] | {date: .action_date, client: .client_name, memo}'
```

### Claude Code에서 MCP fetch로 사용
```
WebFetch https://media-board.netlify.app/api/actions?stage=meeting&from=2026-03-01
```

## 5. Stage Pipeline Reference

| Stage | 의미 | 설명 |
|-------|------|------|
| `contact` | 최초 연락 | 이메일/전화 등 첫 접점 |
| `meeting` | 미팅 진행 | 대면/비대면 미팅 |
| `propose` | 제안서 제출 | 공식 제안 단계 |
| `done` | 완료/종료 | 계약 완료 또는 종료 |
| `memo` | 메모 | 일반 기록 (기본값) |

## 6. AI Implementation Guide (For vibe coding)

### State → Action → Implementation
| State / condition | Meaning | Use this function / API | Where to implement |
|-------------------|---------|-------------------------|--------------------|
| Need action list | 액션 목록 조회 | `GET /api/actions` | `app/api/actions/route.ts` |
| Need plain-text memo | BlockNote → 텍스트 | `extractPlainText()` | `lib/utils/blocknote-utils.ts` |
| Need browser-side CRUD | 생성/수정/삭제 | `createAction()`, `updateAction()`, `softDeleteAction()` | `lib/api/actionService.ts` |

- **Modification rules:**
  - 새 필터 추가 → `app/api/actions/route.ts`의 query builder에 조건 추가
  - 응답 필드 추가 → SELECT 컬럼과 mapping 객체에 필드 추가
  - 인증 추가 → route handler 상단에 Supabase auth 체크 삽입
- **Dependencies:** `lib/supabase/media-server.ts`, `lib/utils/blocknote-utils.ts`
