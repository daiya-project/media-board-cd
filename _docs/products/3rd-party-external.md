# 3rd-Party External Media — 개념/데이터/계산 가이드

## Document info
- **Created:** 2026-04-14
- **Last updated:** 2026-04-14

## Revision history
| Date | Description |
|------|-------------|
| 2026-04-14 | 초기 작성. FC관리 엑셀 리포트 기획 과정에서 도출된 3rd party 매체 개념/데이터 소스/수식 정리. |

---

## 1. 3rd Party External Media란

데이블이 **자체 DSP로 채우지 못한 광고 요청(Passback)** 을 외부 광고 네트워크(업체)에 넘겨 노출시키는 구조. 외부 업체가 광고를 채워 노출시키면 데이블은 업체로부터 CPM 계약 단가로 매출(광고비)을 정산받고, 다시 해당 매체(퍼블리셔)에게 계약한 CPM을 매체비로 지급한다.

### 주요 3rd Party 업체

| 업체명 (External Source) | DB 소스값 | API 연동 | 비고 |
|---|---|---|---|
| **싱크(SyncMedia)** | `syncMedia` | ✅ 구현됨 (`/api/external/sync`) | |
| **KL Media** | `klMedia` | ✅ 구현됨 | |
| **친구플러스** | (미정) | ⏳ 추가 예정 | |

> 확장 시 `lib/api/externalService.ts` 의 `fetchXxxData()` + `xxxToInsert()` 패턴을 따른다. `@/app/external` 섹션의 `07-external-01-report.md` 참고.

---

## 2. 돈의 흐름 (Money Flow)

```
[광고주 (외부 3rd party 네트워크의 광고주)]
           ↓ 광고비 지급
[3rd party 업체 (싱크, KL, 친구플러스 …)]
           ↓ (A) 업체 단가 × 노출 = 데이블이 받는 광고비  ← "cost_spent" 성격
[데이블]
           ↓ (B) 데이블 단가 × 노출 = 매체에 지급하는 매체비  ← "actual_sharing_cost" 성격
[매체 (퍼블리셔, 예: 머니투데이)]
           ↓ 위젯 노출
[사용자]
```

### 핵심 용어

| 용어 | 정의 | 단위 |
|---|---|---|
| **업체 단가** | 3rd party 업체 → 데이블 지급 CPM (데이블이 "받는" 돈의 단가) | KRW / 1000 imp |
| **데이블 단가** | 데이블 → 매체 지급 CPM (매체에 "주는" 돈의 단가) | KRW / 1000 imp |
| **매체 매출** | 데이블 관점의 총 매출 (데이블 단가 × 노출 / 1000) | KRW |
| **광고 매출** | 매체 매출에서 유보분/환급 등을 제외한 실질 광고비 (= 매체 매출 × 0.95) | KRW |
| **매체비(actual_sharing_cost)** | 데이블이 매체에 실제 지급하는 비용 | KRW |
| **FN 매출(재무 인식 매출)** | 매체 매출 75% + 광고 매출 25% 가중 평균 | KRW |

### 공식 테이블 대비

| 엑셀/비즈니스 용어 | `media` DB 테이블 | OBI/DW 테이블 |
|---|---|---|
| 3rd party로부터 받는 광고비 | `external_daily.revenue` (업체 단가 × 노출) | `ad_stats.DAILY_PASSBACK_STATS.org_cost_spent_krw` |
| 매체에 지급하는 매체비 | (별도 저장 없음, 계산) | `fact_daily.ad_stats__daily_actual_sharing_cost_by_service_widget.actual_sharing_cost` |

---

## 3. MFR (Monetized Fill Rate) 개념

**MFR = 매출이 실제로 발생한 노출의 비율.** "광고 요청 중 돈이 발생한 비율" 이라고 해석하면 이해하기 쉽다.

### 계산 방법 (2가지)

#### 방법 1: 매체 지급 비용 역산 (DB 기반 자동 계산 가능)

```
매체지급비용 = 노출수 × 데이블_CPM(매체 계약 CPM)
MFR = 매체지급비용 / cost_spent
```

- 데이블이 실제로 매체에 지급한 금액(노출 × CPM 계약가)과 광고주에게서 받은 전체 매출(cost_spent)의 비율.
- `media.widget` 또는 `media.widget_contract` 의 CPM 계약 단가와 `media.daily` 또는 `v_daily` 의 `cost_spent`, `imp` 를 조합해 위젯 단위로 계산 가능.

#### 방법 2: OBI MPC 에서 직접 조회

- OBI 대시보드의 MPC(Monetized PV Count) 지표에서 MFR이 제공되는 경우, 해당 값을 그대로 사용.
- 대안: `ad_stats.DAILY_FILL_RATE.fill_rate` 자체는 "응답률"이지 MFR이 아니므로 혼동 주의.
  - `fill_rate = ad_response_items / ad_request_items` → 응답이 된 비율.
  - MFR은 거기서 **매출 발생** 조건이 추가됨.

### 분리 MFR: 데이블 vs 싱크(Passback)

엑셀에서는 MFR을 3개로 나눠 입력한다:

| MFR | 의미 | 수식(개념) |
|---|---|---|
| 전체 MFR (N) | 전체 요청 중 매출 발생 비율 | (데이블 매출 발생 + 싱크 매출 발생) / 요청수 |
| 데이블 MFR (O) | 데이블 응답 중 데이블 매출 발생 비율 | 데이블 매출 발생 노출 / 데이블 응답수 |
| 싱크 MFR (P) | 패스백 호출 중 싱크 매출 발생 비율 (또는 노출/호출) | 싱크 노출수 / 패스백 호출수 |

> 현 시점(2026-04)에서는 수동 입력이고, widget_id 별로 자동 계산 로직이 확정되면 MCP(`data-gateway`)/OBI 또는 Redash 쿼리로 보강 예정.

---

## 4. 데이터 소스 매핑 (FC관리 리포트 기준 — widget_id 기준)

> **중요**: FC관리 리포트는 **위젯(widget_id) 단위**로 조회된다. `ad_stats.DAILY_FILL_RATE` 는 service_id 단위라 사용하지 않고, `ad_stats.DAILY_CTR_4MEDIA_BY_SERVICE_WIDGET` 을 기본 팩트로 사용한다. 이 테이블에 widget 단위 `requests`, `impressions_dsp1_2`(데이블 DSP 노출), `impressions_dsp3`(패스백 노출) 컬럼이 존재한다.

| 엑셀 컬럼 | 성격 | 출처 (DB/API) | 컬럼/식 |
|---|---|---|---|
| B FC 금액 | 입력 | 수동 (위젯 계약 메타) | `media.external_widget_setting.fc_amount` |
| C 날짜 | 자동 | 시스템 | |
| D 요청수 | 자동 (widget) | `ad_stats.DAILY_CTR_4MEDIA_BY_SERVICE_WIDGET` | `requests` |
| E 데이블 응답수 | 자동 (widget) — 근사 | 〃 | `impressions_dsp1_2` (DSP1+DSP2 노출, 응답≈노출로 근사) |
| F 응답률 | 계산 | 〃 | `impressions_dsp1_2 / requests` |
| G 패스백 호출수 | 계산 (widget) | 〃 | `requests - impressions_dsp1_2` (응답 없음 요청) |
| H 패스백 호출률 | 계산 | 〃 | `G / requests` |
| I 데이블 패스백 노출수 | 자동 (widget) | 〃 | `impressions_dsp3` (External DA DSP = Passback) |
| I' (vendor 분해 필요 시) | 자동 (widget × vendor) | `ad_stats.DAILY_PASSBACK_STATS` | `impressions` + `vendor_id` |
| J 싱크 노출수 (3rd party) | 자동 | `media.external_daily.imp` | source = syncMedia/klMedia/... |
| K 유실분 | 계산 | — | G − J − I |
| L RPM(OBI) | 계산 | — | M / 0.34 |
| M RPM(대시보드) | 자동 (widget) | `media.v_daily` | `ad_revenue / imp * 1000` |
| N 전체 MFR | 입력→자동(예정) | 수동 입력 → 추후 계산 | |
| O 데이블 MFR | 입력→자동(예정) | 수동 입력 → 추후 계산 | |
| P 싱크 MFR | 입력→자동(예정) | 수동 입력 → 추후 계산 | |
| Q~AG | 계산 | 수식 (FC관리 리포트 참조) | |

### 4.1. "응답수(E)" 의 근사

엑셀의 "데이블 응답수"는 엄밀히는 DSP가 광고를 채워 반환한 **응답(response)** 건수인데, DW에는 widget 단위의 직접 응답 컬럼이 없고 `impressions_dsp1_2` (DSP1+DSP2 노출)만 존재한다. 응답 → 노출 사이 drop이 존재할 수 있으므로 구현 시 엑셀 원본 값과 샘플 비교로 오차를 확인할 것.

대안:
1. 현재 방식: `impressions_dsp1_2` 를 응답으로 간주 (가장 현실적).
2. OBI/Redash에서 widget 단위 응답 원천(있다면) 사용.
3. `ad_stats.DAILY_FILL_RATE.ad_response_items` 의 service 단위 값을 widget의 `requests` 비율로 안분 (정확도 낮음, 비권장).

---

## 5. 핵심 수식 (FC관리 엑셀 기준)

상수:
- `S = 데이블 단가` (KRW / 1000 imp, 매체 계약 단가)
- `T = 업체 단가` (KRW / 1000 imp, 3rd party 업체 지급 단가)
- `RPM_CONST = 0.34` (RPM OBI vs 대시보드 환산 계수)

데이블 블록:
```
AA 데이블 CPM        = S / O                      # 매출 발생 노출 기준 역산 CPM
AB 데이블 MFR        = O                          # 데이블 MFR 참조
Y  데이블 매체 매출  = E / 1000 × AA
Z  데이블 광고 매출  = Y × 0.95
X  데이블 서버비      = Y × 0.047
W  데이블 APC        = Z × 0.017
V  데이블 매체비      = E / 1000 × S
U  데이블 FN 매출    = Y × 0.75 + Z × 0.25
R  데이블 공헌이익    = U − (V + W + X)
```

패스백(PB) 블록:
```
AF PB 매체 매출 = G / 1000 × T
AG PB 광고 매출 = AF
AE PB 서버비    = AF × 0.047 × 0.1
AD PB 매체비     = G / 1000 × S
AC PB FN 매출   = AF × 0.75 + AG × 0.25
S  싱크 공헌이익 = AC − (AD + AE)
```

집계:
```
Q 공헌이익              = R + S
T 전체 RPM(공헌이익)    = Q / D × 1000
K 유실분                = G − J − I
L RPM(OBI)              = M / RPM_CONST
```

### 수식의 의미 해설

- **매체 매출 계산 (Y = E/1000 × AA)**
  응답 노출 전체에 "매출 발생 노출 기준 CPM"을 곱해 총 매체 매출을 계산.
  `AA = S / MFR` 이므로 MFR이 낮을수록 AA가 커진다(낮은 매출 발생 비율을 유효 노출 1건 CPM으로 끌어올려 해석).

- **매체비 (V = E/1000 × S)**
  응답 노출 × 데이블 단가 = 매체에 지급할 매체비.

- **FN 매출 (U = Y×0.75 + Z×0.25)**
  회계 인식 매출: 매체 매출 75% + 광고 매출 25% 가중. Z = Y × 0.95 이므로 U = Y × (0.75 + 0.25 × 0.95) = Y × 0.9875.

- **서버비 (X = Y × 0.047)**
  매체 매출의 4.7% 를 서버 인프라 비용으로 차감.

- **APC (W = Z × 0.017)**
  광고 매출의 1.7%.

- **공헌이익 (R = U − V − W − X)**
  FN 매출에서 매체비, APC, 서버비를 뺀 값.

- **패스백 서버비 (AE = AF × 0.047 × 0.1)**
  패스백은 서버비 기본값의 10% 만 적용 (트래픽 소모가 적어 실제 인프라 부담 낮음).

---

## 6. 계약/단가 관리

### 현재 저장 위치
- `media.external_value` — 외부 매체 CPM 기간별 단가 (자동 감지: `/api/external/detect-prices`).
  - `ref = 'detected'` 또는 수동 설정.
  - `value` = 업체 단가 (KRW).
  - 데이블 단가는 현재 별도 저장 없음. 위젯 계약(`media.widget_contract`) 확장 또는 신규 테이블 고려.

### 향후 개선
- FC 금액(B), 데이블 단가(S), 업체 단가(T), 상수 0.34 등을 **위젯/매체별 설정 테이블**로 관리.
- 상수(RPM_CONST, 서버비율 0.047, APC율 0.017, FN 가중 0.75/0.25)는 **글로벌 설정**으로 관리.

---

## 7. 관련 문서/코드

| 경로 | 설명 |
|---|---|
| `_docs/products/07-external-01-report.md` | 현재 External 섹션 구현 문서 |
| `_docs/products/api-external.md` | External API 라우트 |
| `lib/api/externalService.ts` | 3rd party fetcher + 변환 + upsert |
| `lib/logic/external-logic.ts` | CPM 감지, 결합 파이프라인 |
| `app/external/` | External 섹션 UI |

## 8. 자주 혼동되는 포인트

- **"업체 단가" ≠ 업체의 광고주 단가**. 업체 단가는 "업체 → 데이블 지급 CPM" 이다.
- **"데이블 단가" ≠ 데이블 CPM(AA)**. 데이블 단가(S)는 계약 CPM이고, AA는 "S / MFR" 로 역산한 유효 CPM.
- **`DAILY_FILL_RATE.fill_rate` ≠ MFR**. 응답률이지 매출 발생률이 아니다.
- **`ad_request_items` ≠ `ad_request`**. 엑셀 D(요청수)는 세션 단위 `ad_request`, E(응답수)는 슬롯 단위 `ad_response_items`로 매핑한다(엑셀이 세션 vs 슬롯을 혼합해 계산하는 특성 그대로 유지).
- **`cost_spent` vs `org_cost_spent`** (DW). 매출 집계 시 `org_cost_spent` 사용이 원칙. `cost_spent`는 변환값이며 MFR 역산 시 기준이 혼동되지 않도록 주의.
