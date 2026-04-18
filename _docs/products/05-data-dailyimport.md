# Daily Data Import 구조

이 문서는 Google Sheets에 게시된 CSV를 가져와 Supabase `media.daily` 테이블에 적재하는 일별 데이터 import 파이프라인의 구조를 설명한다.

전체 흐름은 **풀 클라이언트 사이드** — 별도의 서버 라우트 없이 브라우저에서 직접 Google Sheets에 fetch하고, 브라우저용 Supabase 클라이언트로 upsert한다.

---

## 1. 진입점 — Import 모달

[components/modals/ImportModal/ImportModal.tsx](../components/modals/ImportModal/ImportModal.tsx)

3-step 워크플로우(`confirm → progress → result`)와 2개 탭(DATA / CVR)을 가진 전역 모달.

- Zustand `useModalStore` 로 전역 노출 (`openModal === "import"`) — [ImportModal.tsx:53-119](../components/modals/ImportModal/ImportModal.tsx#L53)
- DATA 임포트 핸들러 — [ImportModal.tsx:134-186](../components/modals/ImportModal/ImportModal.tsx#L134)
- CVR 임포트 핸들러 — [ImportModal.tsx:194-237](../components/modals/ImportModal/ImportModal.tsx#L194)
- 진행 중 cancel은 `useRef` 플래그로 처리, `onCancel?.()` 콜백으로 오케스트레이션이 폴링

### 트리거 위치

- [components/layout/AppHeader/ImportTriggerButton.tsx:16](../components/layout/AppHeader/ImportTriggerButton.tsx#L16) — 헤더 "Import" 버튼
- [components/layout/AppSidebar.tsx:512](../components/layout/AppSidebar.tsx#L512) — 사이드바 메뉴
- [app/cvr/_components/CvrFilters.tsx:250](../app/cvr/_components/CvrFilters.tsx#L250) — CVR 페이지 필터 영역

---

## 2. CSV 다운로드 — Google Sheets

[lib/api/importFetch.ts:15-78](../lib/api/importFetch.ts#L15) — `fetchCSVFromGoogleSheets(url)`

두 가지 URL 형식을 모두 지원한다.

1. **Published URL**: `/spreadsheets/d/e/.../pub` → `output=csv` 파라미터 자동 부착
2. **Regular URL**: `/spreadsheets/d/.../edit` → `/export?format=csv&gid=...` 로 변환

### 동작 특징

- `gid` 파라미터 처리: 명시 안 되면 default 0 안 붙임 (Google 400 방지)
- 응답이 HTML로 오면 "공개 설정 안 됨" 오류 throw — [importFetch.ts:68-75](../lib/api/importFetch.ts#L68)
- **CORS 모드로 브라우저에서 직접 fetch** (서버 경유 X)
- `credentials: "omit"` — 인증 정보 미전송

### URL 환경변수

[lib/config.ts:45-54](../lib/config.ts#L45)

| 변수명 | 용도 |
|--------|------|
| `NEXT_PUBLIC_IMPORT_CSV_URL` | Daily 데이터 CSV |
| `NEXT_PUBLIC_IMPORT_CVR_CSV_URL` | CVR 데이터 CSV |

> Next.js의 `NEXT_PUBLIC_*` 변수는 빌드 타임에 클라이언트 번들에 포함된다. URL이 비어 있으면 [ImportModal.tsx:146-151](../components/modals/ImportModal/ImportModal.tsx#L146) 에서 즉시 검증 오류 표출.

---

## 3. CSV 파싱 — 커스텀 구현

[lib/utils/csvParser.ts:22-130](../lib/utils/csvParser.ts#L22) — `parseCSV()`

papaparse 같은 외부 라이브러리를 사용하지 않고 자체 파서로 구현되어 있다.

### 컬럼 매핑

영문/한글 헤더 모두 지원 (case-insensitive, 공백/언더스코어 정규화).

| CSV 헤더 | DB 필드 | 타입 |
|---------|--------|-----|
| `date` / `날짜` | `date` | string |
| `client_id` / `media_id` / `매체_id` | `client_id` | **string** (DB TEXT) |
| `service_id` / `서비스_id` | `service_id` | **string** (DB TEXT) |
| `service_name` / `서비스명` / `서비스_이름` | `service_name` | string |
| `widget_id` / `위젯_id` | `widget_id` | string |
| `widget_name` / `위젯_이름` / `위젯명` | `widget_name` | string |
| `cost_spent` / `광고비용` / `cost` | `cost_spent` | number |
| `pub_profit` / `퍼블리셔수익` / `profit` / `revenue` | `pub_profit` | number |
| `imp` / `노출` / `impression` | `imp` | number |
| `vimp` / `조회가능노출` / `viewable_impression` | `vimp` | number |
| `click` / `cnt_click` / `클릭` | **`cnt_click`** | number |
| `service_cv` / `servce_cv`¹ / `cnt_cv` / `전환` / `cv` / `conversion` | **`cnt_cv`** | number |

¹ `servce_cv` 는 원본 reference 코드의 typo 잔재로 하위 호환을 위해 유지 — [csvParser.ts:96](../lib/utils/csvParser.ts#L96)

### 파서 세부 동작

- 헤더 정규화: `trim().toLowerCase().replace(/\s+/g, "_")` — [csvParser.ts:36](../lib/utils/csvParser.ts#L36)
- 인용부호/이스케이프 처리하는 자체 line parser — [csvParser.ts:168-194](../lib/utils/csvParser.ts#L168)
- 숫자 파싱: 쉼표 제거 후 정수 round — [csvParser.ts:197-208](../lib/utils/csvParser.ts#L197)
- 날짜 정규화: `YYYY-MM-DD` / `YYYY/MM/DD` / `YYYY.MM.DD` / Date-parseable → `YYYY-MM-DD` — [csvParser.ts:139-161](../lib/utils/csvParser.ts#L139)
- identity 필드(date / client_id / service_id) 모두 비면 행 drop — [csvParser.ts:108-111](../lib/utils/csvParser.ts#L108)

---

## 4. 오케스트레이션 — 검증·필터·등록·Upsert

[lib/logic/importOrchestration.ts:70-355](../lib/logic/importOrchestration.ts#L70) — `importCSVData()`

### 파이프라인

1. **Parse** → `parseCSV()` — [importOrchestration.ts:102](../lib/logic/importOrchestration.ts#L102)

2. **Range 결정**
   - `forceDateRange` 있으면 해당 범위 데이터 DELETE 후 진행 — [importOrchestration.ts:113-121](../lib/logic/importOrchestration.ts#L113)
   - 없으면 `getLastImportedDate()` + 1일부터 (증분) — [importOrchestration.ts:122-126](../lib/logic/importOrchestration.ts#L122)

3. **Reverse 순회 + 행별 검증** (`validateRow()`) — [importOrchestration.ts:131-166](../lib/logic/importOrchestration.ts#L131)
   - 최신순 CSV 가정, 오래된 데이터 만나면 early break

4. **PK 기준 dedup** (`date|client_id|service_id|widget_id`) — [importOrchestration.ts:178-187](../lib/logic/importOrchestration.ts#L178)
   - "ON CONFLICT DO UPDATE cannot affect row a second time" 방지

5. **병렬 스캔** (`Promise.all`) — [importOrchestration.ts:197-202](../lib/logic/importOrchestration.ts#L197)
   - `fetchRegisteredClientIds()` — client 화이트리스트
   - `scanMissingServices()` — 누락된 service_id
   - `scanMissingWidgets()` — 누락된 widget_id

6. **미등록 client 행 reject** — [importOrchestration.ts:206-231](../lib/logic/importOrchestration.ts#L206)

7. **누락 entity 자동 등록** (FK 순서: service → widget) — [importOrchestration.ts:235-267](../lib/logic/importOrchestration.ts#L235)

8. **배치 Upsert + progress callback** — [importOrchestration.ts:271-322](../lib/logic/importOrchestration.ts#L271)

9. **실패 행 저장** + **Materialized view refresh** (30초 timeout, 비치명적) — [importOrchestration.ts:324-341](../lib/logic/importOrchestration.ts#L324)

---

## 5. Batch Upsert — Supabase

[lib/api/importBatchService.ts:19-55](../lib/api/importBatchService.ts#L19) — `importBatch()`

| 항목 | 값 |
|------|-----|
| 대상 테이블 | `media.daily` |
| 충돌 키 | `date,client_id,service_id,widget_id` |
| 옵션 | `ignoreDuplicates: true` (DO NOTHING) |
| Fallback | 배치 실패 시 row-by-row insert ([importBatchService.ts:61-109](../lib/api/importBatchService.ts#L61)) |

### 동적 배치 사이즈

[lib/config.ts:73-82](../lib/config.ts#L73), [importOrchestration.ts:42-46](../lib/logic/importOrchestration.ts#L42)

| 행 수 | 배치 사이즈 |
|------|------------|
| 100,000행 이상 | 200 |
| 10,000행 이상 | 500 |
| 그 외 | 1,000 |

배치 간 지연: `IMPORT_BATCH_DELAY_MS = 10ms` — [config.ts:67](../lib/config.ts#L67)

---

## 6. 전체 데이터 흐름

```
사용자가 모달 열기
  ↓
[ImportModal] getLastImportedDate() 표시 + 옵션 입력
  ↓ handleDataConfirm()
[importFetch] fetchCSVFromGoogleSheets(NEXT_PUBLIC_IMPORT_CSV_URL)
  ↓ raw CSV string
[csvParser]   parseCSV() → ParsedCSVRow[]
  ↓
[importOrchestration]
  ├─ validateRow() (행별)
  ├─ normalizeDate()
  ├─ PK dedup
  ├─ fetchRegisteredClientIds() ⎫
  ├─ scanMissingServices()      ⎬ Promise.all
  ├─ scanMissingWidgets()       ⎭
  ├─ registerMissingServices()
  ├─ registerMissingWidgets()
  └─ importBatch() × N (배치)
       ↓ onProgress 콜백
       UI 진행상황 갱신
  ↓
saveFailedRows() + refreshDailyViews() (RPC, 30s timeout)
  ↓
ResultStep 표시 (success / cancelled / error + 상세 로그)
```

---

## 7. 주목할 특징

- **풀 브라우저 실행**: 서버 라우트 없이 브라우저 Supabase 클라이언트로 직접 upsert. 사용자 권한이 곧 RLS 적용 단위.
- **증분 import 기본** + **강제 범위 재import** 옵션 (해당 범위 DELETE → INSERT)
- **자동 entity 등록**: 미등록 service/widget을 import 중에 생성 (FK 위반 방지를 위해 accepted 행만 대상)
- **Cancel 가능**: `useRef` 기반 플래그로 검증/배치 사이마다 폴링
- **실패 행 영구 저장** (`media.daily_failed`)으로 재시도/감사 가능 — [importDbOps.ts](../lib/api/importDbOps.ts)
- **Materialized view 자동 refresh** — `media.refresh_daily_views()` RPC 호출. 대상은 `v_daily_total`, `v_daily_by_service` 두 개. `CONCURRENTLY` 옵션으로 테이블 락 없이 갱신 — [importDbOps.ts:160-179](../lib/api/importDbOps.ts#L160)
- **외부 라이브러리 의존성 최소** — papaparse / xlsx 없이 자체 파서

---

## 8. Google Sheets 원본 (참고)

[lib/config.ts:6-11](../lib/config.ts#L6) — 운영자가 데이터를 입력하는 원본 스프레드시트 링크.

| 변수 | gid | 용도 |
|------|-----|------|
| `DB_LINK` | 0 | Daily 데이터 탭 |
| `CVR_DB_LINK` | 2116998053 | CVR 데이터 탭 |

운영 흐름: 운영자가 Redash 쿼리 결과를 위 스프레드시트에 붙여넣기 → "웹에 게시"로 만든 CSV URL을 `NEXT_PUBLIC_IMPORT_CSV_URL` 로 등록 → 사용자가 모달에서 Import 버튼 클릭.

---

## 9. 관련 파일

| 역할 | 파일 |
|------|-----|
| UI 모달 | [components/modals/ImportModal/](../components/modals/ImportModal/) |
| CSV 다운로드 | [lib/api/importFetch.ts](../lib/api/importFetch.ts) |
| CSV 파서 | [lib/utils/csvParser.ts](../lib/utils/csvParser.ts) |
| 오케스트레이션 | [lib/logic/importOrchestration.ts](../lib/logic/importOrchestration.ts) |
| 행 검증 | [lib/logic/importValidation.ts](../lib/logic/importValidation.ts) |
| 배치 Upsert | [lib/api/importBatchService.ts](../lib/api/importBatchService.ts) |
| Entity 자동 등록 | [lib/api/importEntityService.ts](../lib/api/importEntityService.ts) |
| DB I/O | [lib/api/importDbOps.ts](../lib/api/importDbOps.ts) |
| 설정 상수 | [lib/config.ts](../lib/config.ts) |
| 타입 정의 | [types/app-db.types.ts](../types/app-db.types.ts) |
