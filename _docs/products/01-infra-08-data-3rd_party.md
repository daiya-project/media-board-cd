# 3rd-Party (Passback / DSP3) 정산 데이터 구조

> 작성일: 2026-04-18 · 검증 데이터: KR_native 매체, 2026-04-15~17 3일 실측
> 적용 범위: Dable 데이터 웨어하우스 (Trino) 의 매출/매체비 분해 + media-board-cd 의 hourly 적재 설계

이 문서는 **Dable 의 매출과 매체비가 어떤 스트림으로 구성되는지** 와, **그 중 3rd-party (passback, dsp3) 정산 데이터가 hourly/daily 팩트 테이블에서 어떻게 분리되어 있는지** 를 정리한 권위 문서다. `media.hourly_snapshot` 테이블 설계와 `media.external_*` 테이블의 의미 해석에 사용.

---

## 1. Dable 의 4개 수익/매체비 스트림

Dable 의 광고는 **자체 DSP** 와 **외부 DSP (passback)** 의 두 흐름으로 송출된다. 각각이 매출(수신)·매체비(지급) 양쪽으로 잡히므로 총 4개 스트림이 존재.

| # | 스트림 | 매출 (Dable 수신) | 매체비 (Dable → 매체 지급) | 원천 (daily) |
|---|---|---|---|---|
| 1 | **DSP1** (DNA DSP, Dable 자체 NA) | 광고주 → Dable | Dable → 매체 | 매출: `1.10.org_cost_spent_dsp1` · 매체비: `1.1.media_fee_dsp1` |
| 2 | **DSP2** (External NA DSP, 소량) | 광고주 → Dable | Dable → 매체 | 매출: `1.10.org_cost_spent_dsp2` · 매체비: `1.1.media_fee_dsp2` |
| 3 | **DSP3 / Passback** (외부 벤더) | **외부 벤더 → Dable (CPM 정산)** | Dable → 매체 (별도 계약 CPM) | 매출: `1.10.org_cost_spent_dsp3` ≈ `1.12.org_cost_spent_krw` · 매체비: `1.1.media_fee_dsp3` |
| 4 | **ADX** (MSN/Xandr 등) | ADX 거래소 → Dable | Dable → 매체 | 매출: 1.10 합산에 포함 · 매체비: `1.1` 의 `widget_id='adx'` 가상 행 |

### 핵심 — DSP3 (Passback) 의 정확한 정의

**DSP3 = Passback = 외부 광고 벤더가 Dable 위젯에 자기네 광고를 송출하고 매출을 Dable 에 정산해주는 흐름.**

각 벤더는 widget × vendor 별로 **수신 CPM** (벤더 → Dable) 과 **지급 CPM** (Dable → 매체) 두 단가가 다르게 계약된다 — 그 차이가 Dable 의 passback 마진.

> **혼동 주의 — "xandr/kakao 는 DSP3 가 아니다"**
> `dsp_model = vodka_v3_xandr/kakao_*` 같은 패턴은 **DSP1 (Dable 자체 DNA DSP) 의 내부 ML 모델 분류** 일 뿐, DSP3 와 무관. Xandr 가 SSP 측에도 등장(`kr.msn.com/xandr` ADX 매체) 해서 헷갈리기 쉬움.

### 벤더 상세 — KR Passback 활성 벤더 분포 (실측)

`dimensional_reco.dable_media_income__passback_vendor__latest` 에 등재된 벤더 중 **KR 매체에 실제 활성 (최근 7일 정산 발생) 인 벤더는 3개** 로 압축됨 (2026-04-11~17 실측, KR 매체만).

| 벤더 | vendor_id | 통화 | 활성 매체 수 | 활성 위젯 수 | 7일 매출 (KRW) | **점유율** | 평균 수신 CPM (벤더→Dable) |
|---|---:|---|---:|---:|---:|---:|---:|
| **싱크미디어** (구 3DPOP) | 2 | KRW | 11 | 11 | 4,266,639 | **72.18%** | 1,064원 |
| **친구플러스** | 5 | KRW | 4 | 4 | 1,551,921 | **26.25%** | 1,250원 |
| **KL미디어** | 4 | KRW | 2 | 2 | 92,516 | **1.57%** | 550원 |

**해석**:
- **싱크미디어가 압도적 (72%)**. 11개 매체 / 11개 위젯에 송출 중. KRW 통화로 정산.
  - 구 명칭이 **3DPOP**. 이 프로젝트의 마이그레이션 `2026032502-rename-3dpop-to-syncmedia.sql` 에서 명칭 정리됨.
  - `media.external_daily.source = '3dpop'` (legacy) 또는 `'syncmedia'` 로 외부 API 직접 정산도 동시 운영.
- **친구플러스가 2위 (26%)**. 위젯 4개 한정이지만 평균 CPM 이 가장 높음 (1,250원). 매체사 입장에서는 단가가 좋은 벤더.
- **KL미디어는 매우 미미 (1.57%)**. 2개 위젯, 평균 CPM 550원. `media.external_daily.source = 'klmedia'` 외부 API 정산 함께 운영.
- **루애드 / AnyMind 등 다른 벤더** (`dable_media_income__passback_vendor__latest` dim 에 등재된 다른 벤더) 는 **KR 매체에 최근 7일 정산 데이터 없음** — 비활성 또는 다른 국가 (TWD 통화 벤더 등) 에서만 운영 중일 가능성.

### 벤더별 외부 정산 API 운영 여부

벤더에 따라 **외부 API 정산 데이터 추가 수집 여부** 가 다르다 (이 프로젝트의 `media.external_daily` 테이블 참조):

| 벤더 | Dable DW (1.12) | 외부 벤더 API (`media.external_daily`) | 비고 |
|---|---|---|---|
| **싱크미디어** (3DPOP) | ✓ 있음 | ✓ **있음** (`source = '3dpop'`) | 두 출처 비교 가능 (벤더 보고 vs Dable 측정) |
| **KL미디어** | ✓ 있음 | ✓ **있음** (`source = 'klmedia'`) | 두 출처 비교 가능. KL 은 page_name 단위 widget 매핑 (`external_widget_name` 컬럼) |
| **친구플러스** | ✓ 있음 | ✗ 없음 | DW 단일 출처. 외부 API 미연동 |
| **루애드 / AnyMind** | dim 등재만, 정산 없음 | ✗ 없음 | KR 비활성 |

→ 벤더 보고 ↔ Dable DW 측정 **이중 검증 가능 벤더는 싱크미디어 + KL미디어 2개**. 친구플러스는 1.12 (Dable DW) 단일 출처에 의존.

### 벤더 ↔ 매체사 매칭

- **passback 벤더는 매체사가 직접 선택하지 않음** — Dable 이 widget × vendor × 계약기간 단위로 `dable_media_income__passback_setting` 에 지급 CPM 을 설정해두고, FC (Floor CPM) 미달 시 자동으로 해당 widget 의 passback 벤더로 트래픽이 전송됨.
- **하나의 widget 이 여러 벤더에 passback 될 수 있음** — `(local_basic_time, widget_id, vendor_id)` 가 1.12 PK. 동일 widget 의 row 가 여러 벤더로 나뉘어 적재.
- **FC (Floor CPM)** = `media.external_fc_daily.fc_amount` 또는 widget `default_settings.passback.ad_low_rpm_passback` 에 저장. RPM 이 이 값 미만일 때 passback 발동.

---

## 2. Daily 팩트 테이블의 매출·매체비 분해 (실측 검증)

### 2.1 매출 (`org_cost_spent`) — DSP1+2+3 합산

`fact_daily.ad_stats__daily_ctr_4media_by_service_widget` (1.10) 의 `org_cost_spent` 는 **dsp1 + dsp2 + dsp3 모든 스트림 합산**. 분해 컬럼이 별도 존재:

```
1.10.org_cost_spent ≡ org_cost_spent_dsp1 + org_cost_spent_dsp2 + org_cost_spent_dsp3
```

**실측** (KR_native, 2026-04-15~17, 단위 KRW):

| date | total | dsp1 | dsp2 | dsp3 | sum_check |
|---|---:|---:|---:|---:|---:|
| 04-15 | 30,285,490 | 29,074,123 | 127,604 | 1,083,763 | 30,285,490 ✓ |
| 04-16 | 33,009,205 | 31,889,026 | 116,215 | 1,003,964 | 33,009,205 ✓ |
| 04-17 | 35,899,355 | 34,880,541 | 104,712 | 914,102 | 35,899,355 ✓ |

→ `dsp_sum_check` 가 `total_daily` 와 **소수점까지 일치**. 1.10 매출 = 광고주 매출 + passback 정산 매출 모두 포함.

### 2.2 매체비 (`actual_sharing_cost`) — 단일 컬럼 권위

`fact_daily.ad_stats__daily_actual_sharing_cost_by_service_widget` (1.1) 의 `actual_sharing_cost` 가 **유일한 권위 컬럼**. **`media_fee_dsp1/2/3` 단순 합산 금지** (CPM 계약에서 dsp1==dsp2 더블카운트 발생).

**실측** (KR_native, 2026-04-15~17):

| date | actual (권위) | adx_fee | dsp1_fee | dsp2_fee | dsp3_fee | dsp_sum (1+2+3+adx) |
|---|---:|---:|---:|---:|---:|---:|
| 04-15 | 17,799,450 | 537,443 | 14,743,717 | 11,645,776 | 1,078,460 | **28,005,396 (1.57×)** ❌ |
| 04-17 | 18,697,221 | 866,445 | 15,539,065 | 11,615,550 | 903,877 | **28,924,937 (1.55×)** ❌ |

→ `dsp1 + dsp2` 더블카운트로 합산이 actual 의 1.55~1.57배. **항상 `actual_sharing_cost` 단일 컬럼 사용**.

**올바른 분해 공식** (검증됨):

```
actual_sharing_cost (= 권위)
   = self_dsp (dsp1+dsp2 합쳐 1번 카운트)
   + ADX (widget_id='adx' 가상 행)
   + dsp3 (= media_fee_dsp3, passback 매체 지급)

self_dsp = actual_sharing_cost - SUM(widget_id='adx' 행) - SUM(media_fee_dsp3)
```

---

## 3. Hourly 팩트 테이블의 매출·매체비 — DSP3 빠짐

### 3.1 hourly 매출은 dsp1+dsp2 만

`fact_hourly.ad_stats__hourly_ctr_4media_by_service` (1.15) · `fact_hourly.ad_stats__hourly_ctr_4media_by_service_widget` (1.11) 의 `org_cost_spent` 는 **dsp1 + dsp2 만 포함, dsp3 (passback 정산매출) 미포함**.

**실측 — hourly 24h 합산 vs daily 차이가 정확히 dsp3** (KR_native):

| date | daily total | hourly 24h | gap | **dsp3** | gap 일치도 |
|---|---:|---:|---:|---:|---|
| 04-15 | 30,285,490 | 29,198,879 | 1,086,611 | 1,083,763 | **+0.26%** (≈일치) |
| 04-16 | 33,009,205 | 32,002,401 | 1,006,804 | 1,003,964 | **+0.28%** (≈일치) |
| 04-17 | 35,899,355 | 34,982,421 | 916,934 | 914,102 | **+0.31%** (≈일치) |

→ gap 의 99.7% 가 dsp3 으로 설명됨. **hourly 팩트는 광고주 매출만 적재, 벤더 정산매출은 daily 팩트에만 있음**.

### 3.2 hourly 매체비도 self DSP 만 (1.13)

`fact_hourly.ad_stats__hourly_media_fee_by_widget` (1.13) 의 `media_fee_krw` 는 **DSP1+DSP2 (deduplicated, 즉 self DSP)** 만 포함. ADX 와 dsp3 (passback) 매체비는 빠짐.

검증 공식:
```
1.13.media_fee_krw  ≈  1.1.actual_sharing_cost
                       − 1.1 의 ADX 행 (widget_id='adx')
                       − 1.1 의 media_fee_dsp3 (Passback)
```

실측 — daily `(actual - adx - dsp3)` vs `hourly 1.13` 차이 **-0.15% 이내** ✓.

ADX4 서비스 (15580/15691/15692/16250, US 등록) 은 1.13 에 **전혀 적재 안 됨 (100% 누락)** — KR_native 만 사용해야 정합.

### 3.3 hourly passback 재구성

dsp3 매출/매체비를 hourly 단위로 얻으려면 두 테이블을 곱셈으로 재구성:

| 재구성 대상 | 공식 | 사용 CPM 출처 |
|---|---|---|
| **passback 매출** (벤더 → Dable 수신) | `1.12-a.ad_widget_impressions × 1.12.cpm_value / 1000` | `fact_daily.ad_stats__daily_passback_stats.cpm_value` (벤더 통화 단가, KRW 환산은 `org_cost_spent_krw / impressions × 1000`) |
| **passback 매체비** (Dable → 매체 지급) | `1.12-a.ad_widget_impressions × setting.value / 1000` | `dimensional_reco.dable_media_income__passback_setting__latest.value` (widget × vendor × 계약기간 별 지급 CPM) |

**주의 — 두 CPM 을 혼동하지 말 것**:
- `1.12.cpm_value` = 벤더 → Dable **수신** CPM → **매출** 재구성용
- `1.12-b.setting.value` = Dable → 매체 **지급** CPM → **매체비** 재구성용

`hourly_service_snapshot.sql` 초기 버전이 `widget_daily_cpm` (= 수신 CPM) 으로 매체비를 계산하는 **명명 버그** 가 있었음 — `media_fee_passback_krw` 컬럼에 사실상 `revenue_passback` 값이 들어갔음. 매체비 재구성에는 반드시 `dable_media_income__passback_setting__latest` JOIN 필요.

**재구성 정확도** (실측, KR 7일): imp Δ -0.3%, revenue Δ -0.5% 이내. daily 원본 대비 무시할 수준.

---

## 4. 정확한 hourly 4분해 (media-board-cd `media.hourly_snapshot` 표준)

| 컬럼 | 정의 | 원천 / 재구성 |
|---|---|---|
| `revenue_self_dsp_krw` | 광고주 → Dable 매출 (DSP1+DSP2) | `1.15.org_cost_spent` 합산 |
| `revenue_passback_krw` | **외부 벤더 (싱크미디어 / KL미디어 / 친구플러스 / 루애드 / AnyMind 등) → Dable 정산매출 (DSP3)** | `1.12-a.ad_widget_impressions × 1.12.vendor_to_dable_cpm` 재구성 |
| `media_fee_self_dsp_krw` | Dable → 매체 지급 (self DSP) | `1.13.media_fee_krw` 합산 |
| `media_fee_passback_krw` | Dable → 매체 지급 (Passback / DSP3) | `1.12-a.ad_widget_impressions × 1.12-b.dable_to_media_setting_cpm` 재구성 |

**파생**:
```
revenue_krw       = revenue_self_dsp + revenue_passback     (= daily org_cost_spent 와 정합)
media_fee_krw     = media_fee_self_dsp + media_fee_passback  (= daily actual_sharing − adx 와 정합, KR_native)
mfr_pct           = media_fee_krw / revenue_krw × 100
dable_margin_krw  = revenue_krw − media_fee_krw              (보조 — DSP 마진 분석용)
```

이 정의로 적재하면 **hourly 24h 합산 ≈ daily 정합** 회복 (-0.5% 이내).

---

## 5. `media.external_*` 와의 관계

이 프로젝트의 `media.external_daily` / `media.external_value` / `media.external_fc_*` 테이블은 **Dable 데이터 웨어하우스 외부의 벤더 API** (KL Media, 싱크미디어=3DPOP) 에서 직접 정산 데이터를 받아 적재하는 별도 파이프라인.

| 테이블 | 데이터 출처 | 의미 |
|---|---|---|
| `media.external_daily` | KL Media / 3DPOP API 직접 | 벤더가 Dable 에 보고하는 정산 매출 (위젯 단위) |
| `media.external_value` | 수동 입력 | widget × vendor 의 실제 계약 CPM (`internal` / `syncmedia` / `klmedia`) |
| `media.external_fc_daily` | 수동 입력 (FC 관리 엑셀) | FC 금액 + total/dable/vendor MFR |
| `media.external_widget_funnel_daily` | Redash (1.10 의 dsp1+2 / dsp3 분해) | widget 단위 응답수·passback 노출수 캐시 |

**관계**:
- `media.external_daily.revenue` = **벤더가 Dable 에 통보한** dsp3 매출. 1.12 `org_cost_spent_krw` 와 같은 수치 (벤더 측 보고치) 이지만 출처가 다름 (벤더 API vs Dable DW).
- `media.hourly_snapshot.revenue_passback_krw` = **Dable DW (1.12) 기반으로 재구성한** dsp3 매출. 두 값을 비교해 벤더 보고와 Dable 측정의 차이 검증 가능.
- `media.external_value` 의 widget × vendor CPM 은 1.12-b `setting.value` 와 의미상 동일 — 이중 관리.

---

## 6. 안티패턴

- ❌ `media_fee_dsp1 + media_fee_dsp2 + media_fee_dsp3` 합산 (CPM 더블카운트). `actual_sharing_cost` 단일 컬럼 사용.
- ❌ hourly `1.15 org_cost_spent` 를 "총매출" 로 표시 (실제는 self DSP 만). passback 매출 재구성 추가 필요.
- ❌ `1.12.cpm_value` 로 매체비 계산 (이건 수신 CPM). 매체비는 `1.12-b setting.value` (지급 CPM) 사용.
- ❌ ADX4 서비스 (US 등록) 를 hourly 매체비 집계에 포함 (1.13 에 미적재). KR_native 만 집계.
- ❌ Xandr / Kakao 를 dsp3 로 분류 (사실은 dsp1 의 내부 ML 모델). dsp3 = 외부 passback 벤더.
- ❌ `widget_id='adx'` 행을 필터링 (ADX 매체비 전체 누락 — KR ADX 매체에서 매체비 0% 로 나오는 함정).

---

## 7. 변경 이력

- **2026-04-18**: 초안 작성. KR_native 3일 실측으로 (a) 매출 dsp1+2+3 합산 정합, (b) 매체비 dsp 합산 더블카운트, (c) hourly 매출 dsp3 빠짐 — 3 가지 핵심 검증.
