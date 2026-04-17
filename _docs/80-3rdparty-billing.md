# 3rd-party Billing (lineDSP FC 리포트)

이 문서는 `/external/fc` 페이지(신규)의 **데이터 소스·계산식 레퍼런스**이다. lineDSP / Sync 등 passback 벤더의 정산·공헌이익을 widget × date 단위로 집계하는 리포트이며, 참고 원본은 `_docs/260417-sample.xlsx` 시트 `FC관리`("lineDSP 타겟CPM 관리 시트")이다.

추후 구현 플랜에서 "어디서 가져와서 어떻게 계산하나"를 한 곳에서 찾을 수 있게 하는 것이 목적이다.

---

## 1. 개요

- 대상: lineDSP / Sync 같은 3rd-party passback 벤더의 정산·공헌이익을 **widget 단위**로 관리
- 원본: `_docs/260417-sample.xlsx` 시트 `FC관리` — **33개 컬럼** 구조를 그대로 유지
- 페이지 경로: `/external/fc` (신규 생성 예정)
- 계산 로직: [lib/logic/external-fc-logic.ts](../lib/logic/external-fc-logic.ts)의 `deriveFcRow()` 가 이미 구현되어 있음 — 이 문서는 그 공식을 문서화한 것

---

## 2. 엑셀 컬럼 ↔ 데이터 소스 매핑

총 33개 컬럼. 소스별로 4개 카테고리로 분류한다.

### 2.1 수동 입력 (4개)

운영자가 일별로 시트에 직접 기입. DB에는 `external_fc_inputs` 테이블을 신설해서 저장할 예정.

| 컬럼 | 이름 | 소스 | 주의 |
|---|---|---|---|
| B | FC금액 | 수동 | widget 단위 고정 정산 단가 (통상 월 고정, 변경 시 수동 수정) |
| N | 전체 MFR | 수동 | 일별 변동 (샘플 0.43~0.58 관찰) |
| O | 데이블 MFR | 수동 | 일별 변동 (샘플 0.31~0.50 관찰) |
| P | 싱크 MFR | 수동 | 샘플 범위 내 1.08 상수 관찰. 변동 여부 운영자 확인 필요 |

### 2.2 DW 직접 fetch (4개)

data-gateway MCP (`ad_dev` database) 를 통해 widget × date 단위로 조회.

| 컬럼 | 이름 | 소스 | 주의 |
|---|---|---|---|
| D | 요청수 | `ad_stats.DAILY_CTR_4MEDIA_BY_SERVICE_WIDGET.impressions` | widget 의 총 요청수(1.10 기준) |
| G | 패스백 호출수 | `ad_stats.DAILY_PASSBACK_STATS.impressions` | widget+date PK 1행 (검증됨) |
| M | RPM | `org_cost_spent * 1000 / impressions` (1.10) | 대시보드 표시용 RPM |
| AF (PB매체매출) | 패스백 매체 매출 | `ad_stats.DAILY_PASSBACK_STATS.org_cost_spent_krw` | KRW 환산된 passback 매출 |

### 2.3 외부 API (1개)

| 컬럼 | 이름 | 소스 | 주의 |
|---|---|---|---|
| J | 싱크 노출수 (vendor imp) | `media.external_daily.imp` (이미 적재됨) | vendor(=Sync 등) 가 집계한 impression. 기존 daily import 와 연계됨 |

### 2.4 계산식 (24개)

엑셀 원본 공식을 그대로 적용. 상세는 §4 참조.

| 컬럼 | 이름 | 비고 |
|---|---|---|
| A | 날짜 | 파티션 키 |
| C | widget 이름 | `dable.WIDGET.widget_name` (단순 조회) |
| E | 데이블 응답수 | = D − G |
| F | 응답률 | = E / D |
| H | 패스백률 | = G / D |
| I | 데이블 패스백 노출수 | **출처 불명** — §7 이슈 참조. 현재 0 또는 null |
| K | 광고주 노출수 | = G − J − I |
| L | 광고주 RPM (환산) | = M / 0.34 (OBI RPM 비율 상수) |
| Q | 전체 공헌이익 | = R + Smargin |
| R | 데이블 공헌이익 | = U − (V + W + X) |
| S | 데이블 단가 | `external_value` 에서 로드 (데이블 측 CPM) |
| T | 업체 단가 | vendor 단가 |
| U | 데이블 종합 매출 | = Y × 0.75 + Z × 0.25 |
| V | 데이블 미디어 매출 | = (E / 1000) × S |
| W | 서버 비용 | = Z × 0.017 (APC rate) |
| X | 광고비용 | = Y × 0.047 (server cost rate) |
| Y | 데이블 광고 매출 | = (E / 1000) × AA |
| Z | 데이블 미디어 매출(ad rev 보정) | = Y × 0.95 |
| AA | 데이블 단가 (adj) | = S / AB |
| AB | 데이블 MFR (= O) | 수동 입력 |
| AC | 패스백 종합 매출 | = AF × 0.75 + AG × 0.25 |
| AD | 패스백 미디어 매출 | = (G / 1000) × S |
| AE | 패스백 서버비 | = AF × 0.047 × 0.1 (pb_server_discount) |
| AG | 패스백 광고 매출 | = AF (동일) |
| (Smargin) | 싱크 공헌이익 | = AC − (AD + AE) |
| (Tmargin) | 전체 RPM 공헌이익 | = (Q / D) × 1000 |

---

## 3. DW 테이블 레퍼런스

widget × date 단위 raw data 를 가져오는 3개 테이블. 이 프로젝트에서는 data-gateway MCP 의 `execute_db_query(database="ad_dev", sql=...)` 로 접근.

### 3.1 `ad_stats.DAILY_CTR_4MEDIA_BY_SERVICE_WIDGET` (1.10)

- **역할**: widget 단위 요청수(impressions) + 매출
- **Key**: `local_basic_time` (date 파티션) + `service_id` + `widget_id`

| 컬럼 | 타입 | 역할 |
|---|---|---|
| `local_basic_time` | DATE | 파티션 키 (KST 기준) |
| `service_id` | VARCHAR | media 식별자 |
| `widget_id` | VARCHAR | widget 식별자 |
| `impressions` | BIGINT | **= 엑셀 D 요청수** |
| `exposes` | BIGINT | 노출수 (viewable) |
| `clicks` | BIGINT | 클릭수 |
| `org_cost_spent` | DOUBLE | 데이블 매체 매출 raw (KRW) |

> 주의: Redash Trino 의 `fact_daily.ad_stats__daily_ctr_4media_by_service_widget` 와 동일 테이블. 이 프로젝트에서는 data-gateway MCP 경유로만 접근한다.

### 3.2 `ad_stats.DAILY_PASSBACK_STATS`

- **역할**: widget 단위 passback 호출수 + passback 매출
- **PK**: `(local_basic_time, widget_id)` — widget+date 당 1행만 (검증 완료)

| 컬럼 | 타입 | 역할 |
|---|---|---|
| `local_basic_time` | DATE | 파티션 키 |
| `service_id` | VARCHAR | media 식별자 |
| `widget_id` | VARCHAR | widget 식별자 |
| `impressions` | BIGINT | **= 엑셀 G 패스백 호출수** |
| `vendor_id` | INT | passback 벤더 식별자 (§7 매핑 이슈 참조) |
| `cpm_value` | DOUBLE | 벤더 측 CPM |
| `org_cost_spent` | DOUBLE | 벤더 통화 기준 매출 |
| `org_cost_spent_krw` | DOUBLE | **= 엑셀 PB 매체 매출 AF** (KRW) |
| `tzoffset` | INT | 타임존 오프셋 |

### 3.3 `dable.WIDGET` / `dable.SERVICE`

- **역할**: widget_id / service_id 에서 이름 조회
- 이 페이지에서는 표시용 (widget_name / service_name) 으로만 사용

| 테이블 | 핵심 컬럼 |
|---|---|
| `dable.WIDGET` | `widget_id`, `widget_name`, `service_id`, `status` |
| `dable.SERVICE` | `service_id`, `service_name`, `status` |

---

## 4. 계산 공식 (엑셀 원본 ↔ 로직 1:1 매핑)

[lib/logic/external-fc-logic.ts](../lib/logic/external-fc-logic.ts) 의 `deriveFcRow()` 가 이미 구현. 아래는 변수 명명과 공식을 문서로 정리한 것.

### 4.1 변수 정의

| 변수 | 엑셀 컬럼 | 의미 |
|---|---|---|
| `requests` | D | 요청수 |
| `dable_response` | E | 데이블 응답수 |
| `dable_passback_imp` | I | 데이블 패스백 노출수 (§7 미해결) |
| `vendor_imp` | J | vendor imp (싱크 노출수) |
| `rpm_dashboard` | M | 대시보드 RPM |
| `dable_mfr` | O | 데이블 MFR (수동) |
| `internal_unit_price` | S | 데이블 단가 (`external_value` 에서 fetch) |
| `vendor_unit_price` | T | 업체 단가 |

### 4.2 상수

```ts
rpm_obi_ratio      = 0.34   // OBI RPM 환산 비율
server_cost_rate   = 0.047  // 서버 비용률
apc_rate           = 0.017  // APC rate
fn_media_weight    = 0.75   // 종합 매출 내 media 가중치
fn_ad_weight       = 0.25   // 종합 매출 내 ad 가중치
ad_revenue_rate    = 0.95   // Z 보정 비율
pb_server_discount = 0.1    // 패스백 서버비 할인율
```

### 4.3 기본 공식

```
F = E / D
G = max(D − E, 0)          // 검증용. 실제는 DW DAILY_PASSBACK_STATS 에서 fetch
H = G / D
K = G − J − I
L = M / rpm_obi_ratio
```

### 4.4 데이블 블록

```
AB = O                                                       // 데이블 MFR
AA = S / AB
Y  = (E / 1000) × AA
Z  = Y × ad_revenue_rate                       // 0.95
X  = Y × server_cost_rate                      // 0.047
W  = Z × apc_rate                              // 0.017
V  = (E / 1000) × S
U  = Y × fn_media_weight + Z × fn_ad_weight    // 0.75/0.25
R  = U − (V + W + X)
```

### 4.5 패스백 블록

```
AF      = (G / 1000) × T                       // or DW.org_cost_spent_krw 직접 사용
AG      = AF
AE      = AF × server_cost_rate × pb_server_discount   // 0.047 × 0.1
AD      = (G / 1000) × S
AC      = AF × fn_media_weight + AG × fn_ad_weight
Smargin = AC − (AD + AE)
```

### 4.6 전체 공헌이익

```
Q       = R + Smargin
Tmargin = (Q / D) × 1000                        // 전체 RPM 공헌이익
```

---

## 5. 검증 샘플

widget `V7a1pGx7` (service: `m.mt.co.kr` / widget_name: "본문2번째_300x300", vendor_id=2) 를 2026-04-08 ~ 04-15 까지 엑셀 원본과 DW 조회 결과 비교 결과:

| 날짜 | 엑셀 D | DW 1.10 imp | 엑셀 G | DW passback.imp | 엑셀 PB매출 | DW org_cost_spent_krw |
|---|---|---|---|---|---|---|
| 4-15 | 100,729 | 100,729 ✓ | 37,806 | 37,806 ✓ | 45,367.2 | 45,367 ✓ |
| 4-14 | 102,015 | 102,016 ✓ | 23,728 | 23,728 ✓ | 28,473.6 | 28,473 ✓ |
| 4-13 | 99,304 | 99,307 ✓ | 20,535 | 20,535 ✓ | 24,642 | 24,642 ✓ |
| 4-12 | 106,970 | 106,972 ✓ | 25,582 | 25,582 ✓ | 30,698.4 | 30,698 ✓ |

8일 전부 일치 (1 단위 차이는 반올림). **vendor_id=2** 가 이 widget 의 passback 벤더. DW 데이터와 엑셀 원본은 1:1 매칭되므로 수동 D/G/AF 입력 컬럼은 전부 자동화 가능.

---

## 6. 데이터 조회 샘플 SQL

Production data-gateway MCP 로 호출하는 예시. `execute_db_query(database="ad_dev", sql=...)` 에 그대로 붙여넣기 가능.

```sql
-- widget × date 단위 FC 리포트 raw fetch
SELECT
  p.local_basic_time AS date,
  p.service_id,
  p.widget_id,
  w.widget_name,
  p.vendor_id,
  c.impressions       AS requests_D,
  p.impressions       AS passback_G,
  (c.impressions - p.impressions) AS dable_response_E,
  c.org_cost_spent    AS dable_revenue,
  p.org_cost_spent_krw AS pb_revenue_krw,
  c.org_cost_spent * 1000.0 / NULLIF(c.impressions, 0) AS rpm_dashboard_M
FROM ad_stats.DAILY_CTR_4MEDIA_BY_SERVICE_WIDGET c
LEFT JOIN ad_stats.DAILY_PASSBACK_STATS p
  ON c.local_basic_time = p.local_basic_time
  AND c.service_id = p.service_id
  AND c.widget_id = p.widget_id
LEFT JOIN dable.WIDGET w ON c.widget_id = w.widget_id
WHERE c.widget_id = ?
  AND c.local_basic_time BETWEEN ? AND ?
ORDER BY c.local_basic_time DESC
```

---

## 7. 미해결 이슈

- **I (데이블 패스백 노출수)** — 엑셀 원본에서도 "데이터 출처: 모름, 일단 비워두기". 현재는 0 또는 null 로 처리. 필요 시 운영자 확인 필요.
- **수동 입력 값** — N (전체 MFR) / O (데이블 MFR) / P (싱크 MFR) / B (FC금액). N·O 는 일별 변동, P 는 상수에 가까움. 신규 `external_fc_inputs` 테이블에 `(date, widget_id)` PK 로 저장 설계 필요.
- **vendor_id 마스터 매핑** — `vendor_id=2` 가 lineDSP 인지 타 벤더인지 확인 필요. `dable.PASSBACK_VENDOR` 같은 마스터 테이블 존재 여부 미확인.
- **광고주 매출(U~Z, AC~AG) 구현 정확성** — 공식은 [lib/logic/external-fc-logic.ts](../lib/logic/external-fc-logic.ts) 기준. 엑셀 샘플과 추가 교차검증 권장.

---

## 8. 관련 파일

이 프로젝트에 이미 준비된 자산:

| 역할 | 파일 |
|---|---|
| 타입 정의 (Config / Inputs / AutoInputs / Row / PagePayload) | [types/external.ts:124-211](../types/external.ts#L124) |
| 계산 로직 (`deriveFcRow` / `deriveFcRows`) | [lib/logic/external-fc-logic.ts](../lib/logic/external-fc-logic.ts) |
| 기본 상수 (rpm_obi_ratio 등) | [lib/logic/external-fc-defaults.ts](../lib/logic/external-fc-defaults.ts) |
| 원본 엑셀 샘플 | [_docs/260417-sample.xlsx](./260417-sample.xlsx) (시트: `FC관리`) |
