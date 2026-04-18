# Media Board 외부 API 가이드

> 세일즈 액션 로그, 클라이언트 정보를 외부 시스템에서 조회하기 위한 REST API 문서.

## Base URL

```
https://media-board.netlify.app
```

---

## 목차

1. [GET /api/actions](#1-get-apiactions) — 세일즈 액션(미팅 로그) 조회
2. [GET /api/client-detail](#2-get-apiclient-detail) — 클라이언트 상세 정보 조회

---

## 1. GET /api/actions

세일즈 활동 기록(미팅, 컨택, 제안, 메모 등)을 조회한다. 메모(BlockNote JSONB)를 평문 텍스트로 변환하여 반환할 수 있다.

### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `clientId` | string | No | — | 클라이언트 ID 필터 |
| `stage` | string | No | — | 영업 단계 필터 (아래 표 참조) |
| `from` | string | No | — | 시작 날짜 (inclusive, `YYYY-MM-DD`) |
| `to` | string | No | — | 종료 날짜 (inclusive, `YYYY-MM-DD`) |
| `limit` | number | No | 100 | 최대 반환 행 수 (최대 1000) |
| `format` | string | No | `plain` | `plain`: 메모를 평문 텍스트로 변환 / `raw`: BlockNote JSONB 원본 반환 |

### Stage 값

| Stage | 의미 | 설명 |
|-------|------|------|
| `contact` | 최초 연락 | 이메일/전화 등 첫 접점 |
| `meeting` | 미팅 진행 | 대면/비대면 미팅 |
| `propose` | 제안서 제출 | 공식 제안 단계 |
| `done` | 완료/종료 | 계약 완료 또는 종료 |
| `memo` | 메모 | 일반 기록 (기본값) |

### Response (200 OK)

```jsonc
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

### Response 필드 설명

| Field | Type | Description |
|-------|------|-------------|
| `action_id` | number | 액션 고유 ID |
| `client_id` | string | 클라이언트 ID |
| `client_name` | string | 클라이언트 이름 |
| `service_id` | string \| null | 서비스 ID (없으면 null) |
| `widget_id` | string \| null | 위젯 ID (없으면 null) |
| `action_date` | string | 액션 날짜 (`YYYY-MM-DD`) |
| `stage` | string \| null | 영업 단계 |
| `memo` | string \| object | `format=plain`: 평문 텍스트 / `format=raw`: BlockNote JSON |
| `has_followup` | boolean | 후속 조치 필요 여부 |
| `created_at` | string | 생성 시각 (ISO 8601) |

### Error Response

```jsonc
// 400 Bad Request — 잘못된 stage 값
{ "error": "Invalid stage \"xyz\". Valid: contact, meeting, propose, done, memo" }

// 500 Internal Server Error
{ "error": "Failed to fetch actions" }
```

### 사용 예시

```bash
# 최근 미팅 로그 100건
curl 'https://media-board.netlify.app/api/actions?stage=meeting'

# 특정 클라이언트의 전체 액션
curl 'https://media-board.netlify.app/api/actions?clientId=3851'

# 날짜 범위 + 단계 필터
curl 'https://media-board.netlify.app/api/actions?stage=meeting&from=2026-03-01&to=2026-03-31'

# 최근 5건만
curl 'https://media-board.netlify.app/api/actions?limit=5'

# BlockNote 원본 JSONB로 조회
curl 'https://media-board.netlify.app/api/actions?format=raw&limit=3'

# jq로 특정 필드만 추출
curl -s 'https://media-board.netlify.app/api/actions?stage=meeting' \
  | jq '.[] | {date: .action_date, client: .client_name, memo}'
```

---

## 2. GET /api/client-detail

클라이언트의 기본 정보, 서비스, 위젯, 계약, 활성 상태를 포함한 전체 상세 정보를 조회한다.

### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `clientId` | string | **Yes** | — | 클라이언트 ID |

### Response (200 OK)

```jsonc
{
  "client_id": "3851",
  "client_name": "오토데일리(엠투데이)",
  "tier": "A",
  "manager_id": "m001",
  "manager_name": "홍길동",
  "contact_name": "김담당",
  "contact_phone": "010-1234-5678",
  "contact_email": "kim@example.com",
  "services": [
    {
      "service_id": "s100",
      "service_name": "오토데일리 PC",
      "widgets": [
        {
          "widget_id": "w200",
          "widget_name": "메인 위젯",
          "contract_type": "CPC",
          "contract_value": 50,
          "start_date": "2026-01-01",
          "end_date": null,
          "is_active": true,
          "contracts": [
            {
              "id": 1,
              "widget_id": "w200",
              "contract_type": "CPC",
              "contract_value": 50,
              "date_start": "2026-01-01",
              "date_end": null
            }
          ]
        }
      ],
      "activeWidgetCount": 1
    }
  ],
  "totalServices": 1,
  "totalWidgets": 1,
  "activeWidgets": 1
}
```

### Response 필드 설명

| Field | Type | Description |
|-------|------|-------------|
| `client_id` | string | 클라이언트 ID |
| `client_name` | string | 클라이언트 이름 |
| `tier` | string \| null | 클라이언트 등급 (A, B, C 등) |
| `manager_id` | string \| null | 담당 매니저 ID |
| `manager_name` | string \| null | 담당 매니저 이름 |
| `contact_name` | string \| null | 담당자 이름 |
| `contact_phone` | string \| null | 담당자 전화번호 |
| `contact_email` | string \| null | 담당자 이메일 |
| `services` | array | 서비스 목록 (위젯 포함) |
| `services[].service_id` | string | 서비스 ID |
| `services[].service_name` | string | 서비스 이름 |
| `services[].widgets` | array | 서비스에 속한 위젯 목록 |
| `services[].widgets[].widget_id` | string | 위젯 ID |
| `services[].widgets[].widget_name` | string \| null | 위젯 이름 |
| `services[].widgets[].contract_type` | string \| null | 현재 계약 유형 (CPC, CPM 등) |
| `services[].widgets[].contract_value` | number \| null | 현재 계약 단가 |
| `services[].widgets[].start_date` | string \| null | 계약 시작일 |
| `services[].widgets[].end_date` | string \| null | 계약 종료일 (null이면 무기한) |
| `services[].widgets[].is_active` | boolean | 최근 30일 데이터 존재 여부 |
| `services[].widgets[].contracts` | array | 전체 계약 이력 |
| `services[].activeWidgetCount` | number | 서비스 내 활성 위젯 수 |
| `totalServices` | number | 전체 서비스 수 |
| `totalWidgets` | number | 전체 위젯 수 |
| `activeWidgets` | number | 활성 위젯 수 (최근 30일 데이터 존재) |

### Error Response

```jsonc
// 400 Bad Request — clientId 누락
{ "error": "clientId is required" }

// 500 Internal Server Error
{ "error": "Failed to fetch client detail" }
```

### 사용 예시

```bash
# 클라이언트 상세 조회
curl 'https://media-board.netlify.app/api/client-detail?clientId=3851'

# jq로 서비스/위젯 구조만 추출
curl -s 'https://media-board.netlify.app/api/client-detail?clientId=3851' \
  | jq '{name: .client_name, tier: .tier, services: [.services[] | {name: .service_name, widgets: [.widgets[] | {name: .widget_name, active: .is_active}]}]}'
```

---

## 공통 사항

### 인증

현재 별도 인증(API Key, Bearer Token) 없이 호출 가능하다.

### Rate Limit

별도 rate limit 없음. 과도한 호출 시 Netlify Functions 제한에 의해 429 응답이 발생할 수 있다.

### CORS

기본 Next.js CORS 정책 적용. 브라우저에서 직접 호출 시 CORS 이슈가 발생할 수 있으며, 서버 사이드 또는 CLI 환경에서 호출을 권장한다.

### 정렬

- `/api/actions`: `action_date` 내림차순 → `created_at` 내림차순
- `/api/client-detail`: 서비스/위젯 ID 오름차순
