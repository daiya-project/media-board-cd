# External FC (Passback) Report — 설계 문서

**작성일**: 2026-04-17
**영역**: `/external/fc` (신규), `/external/fc/admin` (신규), `lib/features/fc-value-sync` (신규 cron)
**관련 자료**: `_docs/260417-sample.xlsx` (원본 엑셀), `_docs/80-3rdparty-billing.md` (데이터 레퍼런스)

---

## 1. 배경

원본 엑셀 `FC관리` 시트 ("lineDSP 타겟CPM 관리 시트") 는 lineDSP / syncmedia / klmedia / friendplus 같은 **외부 passback 벤더** 의 정산·공헌이익을 widget 단위 × 30일 시계열로 관리하는 운영 시트다. 수작업 엑셀 관리를 웹 대시보드로 대체한다.

- 원본 시트: widget 1개 × 30일 × 33컬럼
- 이전에 준비된 자산: `types/external.ts:124-211` 의 FC 타입들, `lib/logic/external-fc-logic.ts` 의 `deriveFcRow()` 계산 로직
- 미구현: DB 테이블·UI 페이지·DW fetch·cron 이력화

---

## 2. 페이지 구조

| 경로 | 역할 | 주요 컴포넌트 |
|---|---|---|
| `/external/fc` | FC 리포트 — widget 1개 × 30일 × 33컬럼 테이블 | WidgetPicker, FcTable, PeriodNav |
| `/external/fc/admin` | 관리 — widget 별 `external_value` 이력 CRUD | WidgetList, UnitPriceEditor, HistoryTable |

리포트 페이지 UX:
- 상단 widget picker (검색 + 목록). `external_mapping` 에 등록된 widget + FC 리포트 대상 widget 전체.
- 기본 월은 `latestDate` 기준 이번 달. 월 네비게이터 (이전/다음/MonthPicker) 는 기존 `/external` 패턴 재사용.
- 테이블 본문은 날짜 내림차순. 33컬럼이므로 가로 스크롤 허용. 수동 입력 컬럼은 없음 — 모두 자동 계산.

관리 페이지 UX:
- 좌측에 관리 대상 widget 리스트 (여러 widget 동시 관리).
- 우측에 선택한 widget 의 `external_value` 이력 테이블 (start_date, end_date, internal/syncmedia/klmedia/friendplus/fc).
- 행별 편집/삭제, "새 기간 추가" 버튼. 신규 row 저장 시 이전 active row 의 `end_date` 자동 close 는 기존 DB 트리거가 처리.

---

## 3. 데이터 소스

### 3.1 DW (data-gateway MCP, read-only)

리포트 계산의 **날짜별 raw 지표**는 DW 에서 날짜 단위로 fetch. 이력이 이미 DW 에 쌓여있으므로 별도 보관 불필요.

| 엑셀 컬럼 | DW 소스 | 비고 |
|---|---|---|
| **D** 요청수 | `ad_stats.DAILY_CTR_4MEDIA_BY_SERVICE_WIDGET.impressions` | widget × date |
| **G** 패스백 호출수 | `ad_stats.DAILY_PASSBACK_STATS.impressions` | widget × date × vendor, vendor_id ∈ {2,4,5} |
| **a** 데이블 매체비 | `ad_stats.DAILY_ACTUAL_SHARING_COST_BY_SERVICE_WIDGET.media_fee_dsp1` | dsp1 단독 (dsp1==dsp2 중복, 합산 금지) |
| **b** 데이블 매출 | `1.10 org_cost_spent_dsp1 + org_cost_spent_dsp2` | passback 제외한 매출 |
| **c** PB 매체비 | `1.1 media_fee_dsp3` | |
| **d** PB 매출 | `DAILY_PASSBACK_STATS.org_cost_spent_krw` | |
| **M** RPM 대시보드 | `1.10 org_cost_spent * 1000 / impressions` | 계산 |

**Vendor 매핑** (공용 상수 `lib/logic/external-fc-vendors.ts`, 서버/클라이언트 공용):
- `vendor_id=2` → `syncmedia` (Sync Media)
- `vendor_id=4` → `klmedia` (KL Media)
- `vendor_id=5` → `friendplus` (친구플러스)
- `vendor_id=-1` 및 기타 → FC 리포트에서 제외

**복수 vendor 처리**: 한 widget 이 같은 날짜에 여러 vendor 로 passback 할 수 있음 (현 V7a1pGx7 은 vendor 2 단독이나 다른 widget 은 2+5 가능). 각 date × widget 행에서:
- `G` 는 허용 vendor 들의 `impressions` **합산**
- `d` 는 허용 vendor 들의 `org_cost_spent_krw` **합산**
- `vendor_source` 는 해당 날짜 imp 최대 vendor (표시용 단일 slug)
- `T` (업체 단가) 는 `vendor_source` 기준으로 `external_value.value[vendor_source]` 조회. 혼합 vendor 의 경우 가중평균은 구현 복잡도 때문에 초기 버전에서 지원하지 않음 (§11 YAGNI).

### 3.2 Supabase `media.external_value` (단일 이력 테이블)

모든 CPM·FC 변경 이력의 single source of truth. **value JSONB 구조 확장**:

```ts
interface UnitPriceValue {
  internal?: number;        // 데이블 ↔ 매체사 CPM (S, KRW 정수)
  syncmedia?: number;       // 데이블 ↔ syncmedia CPM (T, KRW 정수)
  klmedia?: number;         // 데이블 ↔ klmedia CPM
  friendplus?: number;      // 데이블 ↔ friendplus CPM (신규)
  fc?: number;              // Widget FC / Floor CPM (KRW 정수)
}
```

row 구조는 기존 유지: `(id, widget_id, value, start_date, end_date, created_at)`. `end_date = NULL` 이면 현재 활성.

조회는 `lib/logic/external-unit-price.ts:findUnitPriceForDate(date)` 재사용 — 주어진 날짜를 포함하는 유효 row 반환.

---

## 4. 계산 공식 (엑셀 33컬럼 1:1)

`lib/logic/external-fc-logic.ts:deriveFcRow()` 의 공식을 그대로 유지. 입력만 재구성.

### 변수 정의

| 변수 | 의미 | 출처 |
|---|---|---|
| D | 요청수 | DW 1.10 `impressions` |
| E | 데이블 응답수 | `D - G` |
| G | 패스백 호출수 | DW `DAILY_PASSBACK_STATS.impressions` (vendor 2/4/5 합계) |
| J | 싱크 노출수 | `media.external_daily.imp` (기존) |
| I | 데이블 패스백 노출수 | 0 또는 null (원본도 비워둠) |
| M | RPM 대시보드 | DW 계산 |
| S | 데이블 단가 | `external_value.value.internal` (for date) |
| T | 업체 단가 | `external_value.value[vendor_slug]` (for date) |
| a | 데이블 매체비 | DW `1.1 media_fee_dsp1` |
| b | 데이블 매출 | DW `1.10 (dsp1+dsp2)` |
| c | PB 매체비 | DW `1.1 media_fee_dsp3` |
| d | PB 매출 | DW `DAILY_PASSBACK_STATS.org_cost_spent_krw` |
| FC | Widget FC 금액 | `external_value.value.fc` (for date) |
| 상수 | rpm_obi_ratio=0.34, server_cost=0.047, apc=0.017, fn_media=0.75, fn_ad=0.25, ad_rev=0.95, pb_discount=0.1 | `external-fc-defaults.ts` |

### 계산식 (엑셀 수식 재현)

```
F = E / D
H = G / D
K = G - J - I                          (유실분)
L = M / rpm_obi_ratio                  (RPM OBI)

# MFR 3종 (기존은 manual input 이었으나 이제 DW 기반 자동 계산)
O (데이블 MFR) = a / b
P (싱크 MFR)   = c / d
N (전체 MFR)   = (a + c) / (b + d)

# 데이블 블록
AB = O                                 (데이블 MFR ref)
AA = S / AB                            (데이블 CPM)
Y  = (E / 1000) * AA                   (데이블 매체 매출)
Z  = Y * ad_revenue_rate               (데이블 광고 매출)
X  = Y * server_cost_rate              (데이블 서버비)
W  = Z * apc_rate                      (데이블 APC)
V  = (E / 1000) * S                    (데이블 매체비, = DW a 와 근사)
U  = Y * fn_media_weight + Z * fn_ad_weight  (데이블 FN 매출)
R  = U - (V + W + X)                   (데이블 공헌이익)

# 패스백 블록
AF = (G / 1000) * T                    (PB 매체 매출)
AG = AF                                (PB 광고 매출)
AE = AF * server_cost_rate * pb_server_discount  (PB 서버비)
AD = (G / 1000) * S                    (PB 매체비, = DW c 와 근사)
AC = AF * fn_media_weight + AG * fn_ad_weight    (PB FN 매출)
S_margin = AC - (AD + AE)              (싱크 공헌이익)

# 종합
Q = R + S_margin                       (전체 공헌이익)
T_margin = (Q / D) * 1000              (전체 RPM 공헌이익 기준)
```

### 검증 샘플

widget V7a1pGx7 (m.mt.co.kr "본문2번째_300x300"), 2026-04-15:

| 지표 | 엑셀 | DW/계산 | 일치 |
|---|---|---|---|
| D 요청수 | 100,729 | 100,729 | ✅ |
| G 패스백 호출수 | 37,806 | 37,806 | ✅ |
| PB 매체 매출 (AF) | 45,367.2 | 45,367 | ✅ |
| S 데이블 단가 | 1,300 | 1.1 `share_value` = 1300 | ✅ |
| T 업체 단가 | 1,200 | `DAILY_PASSBACK_STATS.cpm_value` = 1200 | ✅ |
| O 데이블 MFR | 0.31 | a/b = 81799/256280 = 0.32 | ✅ (±0.01) |
| P 싱크 MFR | 1.08 | c/d = 49147/45367 = 1.08 | ✅ |
| N 전체 MFR | 0.43 | (a+c)/(b+d) = 130946/301647 = 0.43 | ✅ |

---

## 5. Cron 이력화 (`lib/features/fc-value-sync/`)

매일 KST 07:00 실행. DW snapshot 을 fetch 해서 `external_value` 최신 row 와 비교, 변경 시 새 row 추가.

### 5.1 표준 파일 구조 (rules/deploy-llm-schedule.md §2 준수)

```
instrumentation.ts                              (기존 파일, import 한 줄 추가)
lib/features/fc-value-sync/
├─ cron.ts           # node-cron 등록, idempotent + try/catch
├─ job.ts            # 오케스트레이션 (runJob export)
├─ dw-fetch.ts       # data-gateway MCP 호출 (공용)
└─ diff.ts           # 변경 감지 + upsert 로직 (순수 함수)
```

### 5.2 Cron 동작

```
매일 07:00 KST:
  for widget in 관리대상_위젯:
    dw = fetchDwSnapshot(widget)
      # { internal: 1.1 share_value (cpm only),
      #   syncmedia: passback cpm for vendor_id=2,
      #   klmedia: passback cpm for vendor_id=4,
      #   friendplus: passback cpm for vendor_id=5,
      #   fc: WIDGET.default_settings.passback.ad_low_rpm_passback }

    latest = findLatestActiveExternalValue(widget)
    if shallowEqual(latest.value, dw):
      skip
    else:
      insert external_value { widget_id, value: dw, start_date: today, end_date: null }
      # DB 트리거가 이전 active row 의 end_date 를 today-1 로 자동 close
```

### 5.3 "관리대상 위젯" 정의

- `external_mapping.widget_id IS NOT NULL` 인 widget 전체
- 또는 명시적 allow-list 테이블 (추후 확장)
- 초기: external_mapping 기준 단순 시작

### 5.4 DW fetch 쿼리 (widget 단위, 오늘 기준)

```sql
-- S (internal)
SELECT share_value
FROM ad_stats.DAILY_ACTUAL_SHARING_COST_BY_SERVICE_WIDGET
WHERE widget_id = ?
  AND local_basic_time = ?  -- today
  AND share_type = 'cpm'
LIMIT 1

-- T (vendor CPMs) — vendor_id 별로 row 여러개 가능
SELECT vendor_id, cpm_value
FROM ad_stats.DAILY_PASSBACK_STATS
WHERE widget_id = ?
  AND local_basic_time = ?
  AND vendor_id IN (2, 4, 5)

-- FC
SELECT JSON_UNQUOTE(JSON_EXTRACT(default_settings, '$.passback.ad_low_rpm_passback'))
FROM dable.WIDGET
WHERE widget_id = ?
```

이 3개 쿼리 결과를 하나의 `UnitPriceValue` 객체로 조합.

### 5.5 변경 감지 규칙

- undefined 필드는 비교 대상에서 제외 (DW 에 값 없으면 이전 값 유지)
- 숫자 엄격 비교 (1300 === 1300)
- 어느 하나라도 차이나면 "변경됨" → 새 row insert

### 5.6 Cron 설정 공통 제약

- `replicas: 1` 강제, `hpa_enabled: false` (공통 제약 §1.1)
- `instrumentation.ts` 에서 `NEXT_RUNTIME === 'nodejs'` 가드
- `registered` 플래그로 idempotent 등록
- 콜백 최상위 try/catch + duration 로깅
- 로그 prefix `[fc-value-sync]`

### 5.7 수동 트리거 API

`POST /api/fc/sync` — Admin 페이지의 "지금 동기화" 버튼. 내부적으로 같은 `runJob()` 을 호출.

---

## 6. DB 스키마 변경

### 6.1 `media.external_value` (기존 테이블)

테이블 구조 변경 없음. JSONB 스키마만 확장:

- `value.friendplus` 추가 (number, KRW 정수)
- `value.fc` 추가 (number, KRW 정수)

마이그레이션 불필요 (JSONB 이므로 DDL 변경 없음). 기존 row 는 해당 필드 미존재 → `undefined` 로 취급.

### 6.2 RLS 정책

기존 anon key + RLS 로 write 가능한지 확인 필요 (`rules/deploy-llm-schedule.md §3.8`). 사전 curl 테스트:

```bash
curl -s -X POST "$SUPABASE_URL/rest/v1/external_value?on_conflict=widget_id,start_date" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Content-Profile: media" \
  -H "Prefer: resolution=merge-duplicates" \
  -d '[{"widget_id":"V7a1pGx7","value":{"fc":230,"internal":1300},"start_date":"2026-04-17","end_date":null}]'
```

403 이면 RLS 정책 조정 또는 service_role key 사용.

### 6.3 신규 테이블 없음

사용자 결정: 모든 값 이력을 `external_value` 로 통일. `external_fc_inputs`, `external_fc_config` 는 **생성하지 않음**. 관련 타입 (`ExternalFcInputs`) 도 제거.

---

## 7. 타입 변경 (`types/external.ts`)

### 수정

```ts
interface UnitPriceValue {
  internal?: number;
  syncmedia?: number;
  klmedia?: number;
  friendplus?: number;    // 신규
  fc?: number;            // 신규 (KRW 정수)
}
```

### 제거

- `ExternalFcInputs` — 수동 입력 없음
- `ExternalFcConfig` — DB 테이블 없음, `DEFAULT_FC_CONFIG` 상수만 남김

### 추가

```ts
interface ExternalFcAutoInputs {
  date: string;                 // YYYY-MM-DD
  requests: number;             // D
  passback_imp: number;         // G (vendor_id 2/4/5 합계)
  dable_media_cost: number;     // a (= media_fee_dsp1)
  dable_revenue: number;        // b (= org_cost_spent_dsp1+dsp2)
  pb_media_cost: number;        // c (= media_fee_dsp3)
  pb_revenue: number;           // d (= passback org_cost_spent_krw)
  rpm_dashboard: number;        // M
  vendor_source: "syncmedia" | "klmedia" | "friendplus" | null;  // 주요 vendor (imp 최대)
}
```

### 수정된 `ExternalFcRow`

`ExternalFcInputs` 필드 제거 (fc_amount, total_mfr, dable_mfr, vendor_mfr). 대신 `fc_amount` 는 `UnitPriceValue.fc` 에서, MFR 3종은 DW auto-input 에서 계산.

---

## 8. 로직 변경 (`lib/logic/external-fc-logic.ts`)

### `deriveFcRow()` 시그니처 변경

before:
```ts
deriveFcRow(inputs: ExternalFcInputs, auto: ExternalFcAutoInputs, prices, config, source)
```

after:
```ts
deriveFcRow(auto: ExternalFcAutoInputs, prices: ExternalValueRow[], config: Omit<ExternalFcConfig, 'widget_id'|'note'>)
```

### 내부 로직 변경

- `S = findUnitPriceForDate(prices, auto.date).internal ?? 0`
- `T = findUnitPriceForDate(prices, auto.date)[auto.vendor_source] ?? 0`
- `FC = findUnitPriceForDate(prices, auto.date).fc ?? 0` (표시용, 계산 미사용)
- `O = safeDiv(auto.dable_media_cost, auto.dable_revenue)`
- `P = safeDiv(auto.pb_media_cost, auto.pb_revenue)`
- `N = safeDiv(auto.dable_media_cost + auto.pb_media_cost, auto.dable_revenue + auto.pb_revenue)`
- 나머지 공식 유지 (Y, Z, X, W, V, U, R, AF, AG, AE, AD, AC, S_margin, Q, T_margin)

---

## 9. 파일 계획

### 신규

```
app/external/fc/
├─ page.tsx                              # 서버 컴포넌트, getExternalFcPayload
├─ loading.tsx
└─ _components/
   ├─ FcClient.tsx                       # widget picker + period nav
   ├─ FcTable.tsx                        # 33컬럼 테이블
   └─ WidgetPicker.tsx

app/external/fc/admin/
├─ page.tsx
└─ _components/
   ├─ AdminClient.tsx
   ├─ WidgetList.tsx
   └─ UnitPriceEditor.tsx                # external_value CRUD 폼

app/api/fc/
└─ sync/route.ts                         # POST 수동 sync 트리거

lib/api/
└─ externalFcService.ts                  # DW fetch + Supabase 조합, getExternalFcPayload()

lib/dw/
└─ dataGatewayClient.ts                  # data-gateway MCP 래퍼 (신규)

lib/logic/
└─ external-fc-vendors.ts                # vendor_id ↔ slug 공용 상수 (신규)

lib/features/fc-value-sync/
├─ cron.ts
├─ job.ts
├─ dw-fetch.ts
└─ diff.ts
```

### 수정

```
types/external.ts                         # UnitPriceValue 확장, ExternalFcInputs 제거, ExternalFcAutoInputs 수정
lib/logic/external-fc-logic.ts            # deriveFcRow 시그니처 변경, MFR 자동 계산
lib/logic/external-fc-defaults.ts         # 유지
instrumentation.ts                        # fc-value-sync cron 등록 import 추가
```

### 삭제

없음 (기존 코드 영향 최소화).

---

## 10. 환경 변수 / 운영

### Credentials

- **`MCP_SERVER_*`** (플랫폼 자동 주입) — data-gateway MCP 접근. 별도 credential 불필요.
- **`NEXT_PUBLIC_SUPABASE_URL/KEY`** (기존) — cookie-free 클라이언트로 cron 에서 사용.

### 신규 credential 없음.

### Dockerfile

변경 불필요. `NEXT_PUBLIC_*` 는 이미 builder ENV 로 인라인됨.

### 배포 후 smoke test

1. `/external/fc` 진입, widget 선택, 30일 테이블 렌더링 확인
2. 엑셀 샘플 widget V7a1pGx7 의 2026-04-15 행 값이 엑셀과 일치하는지 비교
3. `POST /api/fc/sync?sync=true` 로 수동 트리거 → 로그에서 `[fc-value-sync] ok` 확인
4. `external_value` 에 오늘 날짜 row 가 추가됐는지 SQL 로 확인

---

## 11. YAGNI / 향후 확장

- **"관리대상 위젯" 명시 테이블**: 초기엔 `external_mapping` 기반. 제외 목록 필요 시 `widget_allowlist` 테이블 추가.
- **Vendor 추가**: 현재 3개 (syncmedia/klmedia/friendplus). 4번째 vendor 추가 시 `PASSBACK_VENDORS` 상수 + `UnitPriceValue` 필드 추가, `vendor_id` 매핑 업데이트.
- **Widget 단위 FC config 상수 override**: 지금은 전역 `DEFAULT_FC_CONFIG`. widget 별 다른 상수가 필요해지면 `external_fc_config` 테이블 도입 검토.
- **조회 성능**: 관리대상 위젯이 100+ 되면 cron 내부 쿼리 순차 호출이 느려질 수 있음. 그땐 병렬화 + 벌크 쿼리로 전환.

---

## 12. 미해결 이슈

1. **I (데이블 패스백 노출수)** — 엑셀 원본도 비워둠. 초기 구현에서 0/null 로 처리. 운영자 확인 후 별도 소스 발견되면 반영.
2. **`/dable-query` 스킬 업데이트** — `DAILY_PASSBACK_STATS` + `WIDGET.default_settings.passback` 을 스킬 reference 에 추가해야 함. 샌드박스 권한 이슈로 보류.
3. **Vendor 추가 (5번째+)** 시 스키마 확장 전략 — 현재는 JSONB 키 하드코딩. 벤더가 많아지면 `value.vendors: {[vendor_id]: cpm}` 패턴 고려.
4. **Widget default_settings JSON 의 기타 필드** (`ad_passback_type`, `ad_passback_height`, `ad_passback` iframe HTML) 관리 페이지 노출 여부 — 현 spec 에는 미포함. 추후 요구 시 추가.

---

## 13. 구현 순서 (writing-plans 에서 상세화 예정)

고수준 시퀀스:

1. `types/external.ts` 변경 (UnitPriceValue 확장, ExternalFcInputs 제거)
2. `lib/dw/dataGatewayClient.ts` 신규 — data-gateway MCP 호출 래퍼
3. `lib/logic/external-fc-logic.ts` 리팩토링 — deriveFcRow 시그니처 변경, MFR 자동 계산
4. `lib/api/externalFcService.ts` 신규 — getExternalFcPayload (DW + Supabase)
5. `app/external/fc/page.tsx` + client components — 리포트 페이지
6. `app/external/fc/admin/page.tsx` + editor — 관리 페이지
7. `lib/features/fc-value-sync/*` — cron 이력화 기능
8. `instrumentation.ts` 에 cron 등록 import 추가
9. `app/api/fc/sync/route.ts` — 수동 트리거 API
10. 배포 후 smoke test + 엑셀 샘플 대조 검증
