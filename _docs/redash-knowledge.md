# Redash 쿼리 — 스키마/테이블 카탈로그

> **목적**: 매번 Redash·웨어하우스 탐색 비용을 줄이기 위해, **사내에서 실제로 살아있는** 쿼리들이 사용 중인 스키마·테이블을 한 번에 정리.
> **데이터 소스**: `https://redash.dable.io/api/queries?order=-updated_at` 페이지네이션 → `updated_at >= 2026-04-11` (최근 7일)
> **수집일**: 2026-04-18
> **모집단**: 110개 쿼리 (전체 4,423건 중 최근 7일 갱신분)
> **파싱**: `sqlglot` Trino/MySQL dialect, CTE 자동 제외, Redash `{{}}` placeholder sanitize
> **검증 기준**: dable-query 스킬 `references/schema-*.md` + `references/schema/s-*.md` (Tier 1~4 분류, **단일 진실 원본 = `s-total.md`**)
> **갱신 방법**: `/tmp/redash-catalog/fetch_recent.py` + `parse_tables.py` 재실행

---

## TL;DR

- **유니크 스키마 11개**, **유니크 테이블 56개**
- 본인(Taeyeong Kim) 17건은 모두 dable-query 스킬 캐시 + r3 ad-hoc draft. 신규 정보 없음
- **dable-query 스킬에 정식 등재**: `fact_*`, `dimensional_*`, `org_log` 일부 → 모두 ✅
- **AI-Wheres 사업부 (분석 범위 밖, ❌ 제외)**: `wheres_dsp_meta_data_prod`, `wheres_etl`, `wheres_fact_hourly` (Tier 4)
- **Dable 본체 AI Craft (Tier 3, 일상 분석 무관)**: `ai_craft` 4개 테이블
- **본인 업무 관점에서 가치 있는 미등재 테이블**: 4개 (§4 우선순위)

---

## 1. 스키마 분포 (참조 횟수 = 쿼리 단위 unique)

| 스키마 | 쿼리 수 | 테이블 수 | 분류 / 비고 |
|---|---:|---:|---|
| `(no-schema)` | 55 | 20 | Redash QueryResults 체이닝 — 실제 테이블 아님 |
| `wheres_dsp_meta_data_prod` | 27 | 4 | ❌ **AI-Wheres 사업부** (Tier 4, 본 분석 범위 밖) |
| `dimensional_reco` | 25 | 3 | ✅ 매체/매체사 디멘전 (Tier 1, 스킬 R2) |
| `wheres_etl` | 23 | 7 | ❌ **AI-Wheres 사업부** (Tier 4) |
| `fact_daily` | 21 | 4 | ✅ 매체 일별 팩트 (Tier 1) |
| `fact_hourly` | 19 | 7 | ✅ 시간별 팩트 (Tier 1) |
| `wheres_fact_hourly` | 9 | 2 | ❌ **AI-Wheres 사업부** (Tier 4) |
| `ai_craft` | 7 | 4 | 🟠 Dable AI Craft 모델 (Tier 3, 일상 분석 무관) |
| `dimensional_ad` | 6 | 1 | ✅ 광고주 디멘전 (Tier 1, 스킬 R1) |
| `org_log` | 5 | 3 | 일부 ✅ (1.8 `ad_expose`/`ad_request`), 일부 ⚫ (운영 로그, Tier 제외) |
| `dable_content_category` | 3 | 1 | 🆕 **카탈로그 미등재** — MySQL reco_mysql, 카테고리 마스터 |

**범례**: ✅ 정식 등재 / 🆕 미등재 신규 / 🟠 등재됐으나 본인 업무와 거리 있음 / ❌ 사업부 외 제외 / ⚫ Tier 제외

---

## 2. 테이블 빈도 Top 30 (chained query 제외, AI-Wheres 제외)

| # | 스키마.테이블 | 사용 | 등재 상태 |
|---:|---|---:|---|
| 1 | `dimensional_reco.dable__service__latest` | 20 | ✅ R2 매체 디멘전 |
| 2 | `fact_daily.ad_stats__daily_ad_click_group_by_service` | 9 | 🆕 **미등재** (s-fact-daily.md 한 줄 언급) |
| 7 | `fact_daily.ad_stats__daily_actual_sharing_cost_by_service_widget` | 7 | ✅ 1.1 매체 정산비 |
| 9 | `fact_hourly.ad_performance_summary` | 6 | ✅ 1.2 광고 성과 (매출 표준) |
| 10 | `dimensional_ad.ad_admin__client__latest` | 6 | ✅ R1 광고주 디멘전 |
| 12 | `fact_hourly.ai_performance_summary` | 5 | ✅ 1.7 AI 모델 시간별 |
| 13 | `dimensional_reco.dable__client__latest` | 4 | ✅ 매체사 디멘전 |
| 14 | `ai_craft.pred_purchase_usr` | 4 | 🟠 Tier 3 (Dable AI 모델 결과) |
| 15 | `org_log.ad_expose` | 3 | ✅ 1.8 노출 raw |
| 17 | `dable_content_category.category_mapping` | 3 | 🆕 **미등재 신규** ⭐ |
| 18 | `fact_daily.ad_stats__daily_ctr_4media_by_service_widget` | 3 | ✅ 1.10 매체×위젯 일별 |
| 19 | `fact_hourly.ad_stats__hourly_ctr_4media_by_service_widget` | 3 | ✅ 1.11 partial-day |
| 20 | `fact_daily.ad_stats__daily_ctr_4media_by_service` | 2 | ✅ 1.10 service 변형 |
| 26 | `fact_hourly.ad_stats__hourly_service_ad_performance` | 2 | ✅ **1.5 정식 등재** (schema-ext-performance) |
| 27 | `ai_craft.vodka_v3_client_aucs` | 1 | 🟠 Tier 3 |
| 28 | `ai_craft.monitor_service_imp_drop` | 1 | 🟠 Tier 3 |
| 29 | `ai_craft.model_summary` | 1 | 🟠 Tier 3 |
| 30 | `fact_hourly.ad_stats__hourly_ad_exchange_cpm_bidding_result` | 1 | ✅ **1.21 정식 등재** (schema-ext-bidding) |
| - | `fact_hourly.ad_hub_bid_request_summary` | 1 | 🆕 **미등재** (s-fact-hourly.md 한 줄 언급) |
| - | `fact_hourly.item_summary` | 1 | 🆕 **미등재** (s-fact-hourly.md 한 줄 언급) |
| - | `org_log.ad_request` | 1 | ✅ 1.8 요청 raw |
| - | `org_log.ad_hub_bid_request` | 1 | ⚫ Tier 제외 (운영 로그, 분석 무관) |

**❌ AI-Wheres 사업부 테이블** (이 목록에서 제외, 11개): `wheres_dsp_meta_data_prod.{campaign, app, ad_account, omtm_advertiser_revenue_config}`, `wheres_etl.{combined_log_v2, airbridge_inapps_attributed, combined_log_summary, appsflyer_*, airbridge_inapps_v2, yanolja_inapps_attributed}`, `wheres_fact_hourly.{inferencer_wheres_log, inferencer_wheres_summary}`

---

## 3. 스키마별 전체 테이블 목록 (분류별)

### ✅ Tier 1 — 정식 등재 (스킬 즉시 사용 가능)

#### `dimensional_reco`
| 테이블 | 사용 | 비고 |
|---|---:|---|
| `dable__service__latest` | 20 | 매체 dim — R2 화이트리스트 join 표준 |
| `dable__client__latest` | 4 | 매체사 (publisher_client_id) dim |
| `dable__service` | 1 | latest 가 아닌 raw |

#### `dimensional_ad`
| 테이블 | 사용 | 비고 |
|---|---:|---|
| `ad_admin__client__latest` | 6 | 광고주 dim — R1 KR 필터 표준 |

#### `fact_daily`
| 테이블 | 사용 | 등재 위치 |
|---|---:|---|
| `ad_stats__daily_actual_sharing_cost_by_service_widget` | 7 | 1.1 (schema-core) |
| `ad_stats__daily_ctr_4media_by_service_widget` | 3 | 1.10 (schema-core) |
| `ad_stats__daily_ctr_4media_by_service` | 2 | 1.10 service 변형 |

#### `fact_hourly`
| 테이블 | 사용 | 등재 위치 |
|---|---:|---|
| `ad_performance_summary` | 6 | 1.2 (schema-core) — 매출 표준 |
| `ai_performance_summary` | 5 | 1.7 (schema-ext-ai) |
| `ad_stats__hourly_ctr_4media_by_service_widget` | 3 | 1.11 (schema-core) |
| `ad_stats__hourly_service_ad_performance` | 2 | **1.5** (schema-ext-performance) ⭐ 사용 빈도 낮지만 등재 |
| `ad_stats__hourly_ad_exchange_cpm_bidding_result` | 1 | **1.21** (schema-ext-bidding) |

#### `org_log`
| 테이블 | 사용 | 등재 위치 |
|---|---:|---|
| `ad_expose` | 3 | 1.8 (schema-ext-bidding) |
| `ad_request` | 1 | 1.8 (schema-ext-bidding) |

---

### 🆕 미등재 — 본인 업무 관점에서 검토할 가치 있음

#### `dable_content_category` ⭐ **1순위**
| 테이블 | 사용 | 사용 쿼리 |
|---|---:|---|
| `category_mapping` | 3 | q15009 (Seokyung Lee `service id별 org std category 매핑`), 14970, 14969 |

- **데이터 소스**: MySQL `reco_mysql` (ds 176)
- **추정 용도**: service_id ↔ 표준 카테고리 매핑 (운영팀이 매체 분류용으로 운영)
- **본인 가치**: media-board 대시보드에 "매체 카테고리 dimension" 추가 시 즉시 활용 가능. `dimensional_reco.dable__service_category__latest` 와 차이 비교 필요

#### `fact_hourly.ad_hub_bid_request_summary` (입찰 분석)
| 테이블 | 사용 | 비고 |
|---|---:|---|
| `ad_hub_bid_request_summary` | 1 | s-fact-hourly.md "ad_hub 입찰 요청 집계 (Xandr 경매 원천)" 한 줄 언급. 정식 1.x 번호 미부여 |

- **본인 가치**: 입찰 진단 필요 시. 1.8/1.9/1.21 와 별도 ad-hub 경로

#### `fact_daily.ad_stats__daily_ad_click_group_by_service` (Fraud)
| 테이블 | 사용 | 비고 |
|---|---:|---|
| `ad_stats__daily_ad_click_group_by_service` | 9 | s-fact-daily.md "매체별 광고 클릭 그룹" 한 줄 언급. fraud Q6 시리즈 (Minseo Kim) 사용 |

- **본인 가치**: 향후 fraud/abuse 자동 탐지 도입 시 reference

#### `fact_hourly.item_summary` (콘텐츠 단위)
| 테이블 | 사용 | 비고 |
|---|---:|---|
| `item_summary` | 1 | s-fact-hourly.md "아이템 시간별 요약" 한 줄 언급 |

- **본인 가치**: 콘텐츠 단위 성과 분석 필요 시. 매체 dashboard 에는 거리 있음

---

### 🟠 Tier 3 — Dable AI Craft 모델 결과 (일상 분석 무관, 참고만)

`ai_craft` (98 테이블 보유 schema, AI 팀 모델 산출물). AI-Wheres 와 **무관** — Dable 본체 AI Craft.

| 테이블 | 사용 | 추정 용도 |
|---|---:|---|
| `pred_purchase_usr` | 4 | 구매 예측 user-level 결과 |
| `vodka_v3_client_aucs` | 1 | vodka_v3 (Dable DSP 모델) AUC by client |
| `monitor_service_imp_drop` | 1 | 매체 노출 급락 모니터링 |
| `model_summary` | 1 | 모델 종합 요약 |

- **본인 가치**: 향후 알람/이상 감지 자동화 도입 시 `monitor_service_imp_drop` 만 reference

---

### ⚫ 제외 — Tier 분류상 본 분석 범위 밖

#### `org_log.ad_hub_bid_request`
- s-total.md 분류: "로그/감사 — 운영 로그, 분석 무관"
- 1.8 (`ad_expose`/`ad_request`)는 schema-ext-bidding 에 정식 등재됐지만 ad-hub raw 는 미등재

---

### ❌ AI-Wheres 사업부 — 본 분석 제외 (사용자 명시)

11개 테이블이 `wheres_*` 스키마에 분포. AI-Wheres 는 별도 B2B SaaS 사업부 (s-total.md Tier 4 분류). dable-query 스킬 범위 밖이며, 본인(media-board) 업무와 직접 관련 없음.

| 스키마 | 테이블 수 |
|---|---:|
| `wheres_dsp_meta_data_prod` | 4 (campaign / app / ad_account / omtm_advertiser_revenue_config) |
| `wheres_etl` | 7 (combined_log_v2 / airbridge_* / appsflyer_* / yanolja_*) |
| `wheres_fact_hourly` | 2 (inferencer_wheres_log / summary) |

(상세 raw 는 `/tmp/redash-catalog/tables_index.json` 참조. 본 문서에서는 의도적으로 카탈로그화 생략.)

---

## 4. 본인 업무 관점 — Deep-dive 우선순위

`media-board-cd` 가 매체 일별 매출/위젯 적재 중심이라는 컨텍스트에서:

### 🥇 1순위 — 즉시 활용 가능
1. **`dable_content_category.category_mapping`** (q15009) ⭐
   - 매체에 카테고리 dimension 추가. 대시보드 필터/그루핑·슬라이스 분석에 즉시 활용
   - **다음 액션**: q15009 SQL 본문 확인 + `dimensional_reco.dable__service_category__latest` (등재된 매체 카테고리 dim) 와의 차이 비교
   - MySQL ds 176 (reco_mysql) 직접 조회 가능

### 🥈 2순위 — 본인 인프라 보강 후보
2. **`fact_hourly.ad_stats__hourly_service_ad_performance` (1.5)**
   - 이미 정식 등재돼 있는데 본인의 hourly snapshot (q14999/15000) 에 미사용
   - schema-ext-performance.md §1.5 읽고 본인 snapshot 컬럼셋 보강 검토

### 🥉 3순위 — 향후 기능 확장 시 reference
3. **`fact_daily.ad_stats__daily_ad_click_group_by_service`** — fraud/abuse 자동 감지 모듈 신설 시
4. **`fact_hourly.ad_hub_bid_request_summary`** — ad-hub 입찰 진단 필요 시
5. **`ai_craft.monitor_service_imp_drop`** — 매체 노출 급락 알람 자동화 시

### 검토 종결 (가치 낮음)
- `fact_hourly.item_summary` — 콘텐츠 단위, 매체 dashboard 와 거리 있음
- `org_log.ad_hub_bid_request` — 운영 raw, Tier 제외
- `ai_craft.pred_purchase_usr / vodka_v3_client_aucs / model_summary` — 광고주/AI 팀 산출물, 본 dashboard 거리 멈

---

## 5. 다음 단계 가이드

1. **딥다이브 1순위 (`category_mapping`) 컬럼 확인**:
   - Redash 에서 `SHOW COLUMNS FROM dable_content_category.category_mapping` (MySQL ds=176)
   - 또는 `SELECT * FROM ... LIMIT 5`
2. **참조 쿼리 SQL 본문 확인**: `tables_index.json` → `queries[]` 의 query_id → Redash UI 또는 `GET /api/queries/<id>`
3. **확정된 신규 테이블은 dable-query 스킬에 등록 PR**: 본인이 자주 쓸 것이라면 `schema-ext-*.md` 또는 `schema-core.md` 에 추가

---

## 6. raw 데이터 위치

- 메타 (110건): `/tmp/redash-catalog/recent_meta.json`
- 메타 + SQL 본문: `/tmp/redash-catalog/recent_full.json`
- 테이블 인덱스 + 사용 쿼리 매핑: `/tmp/redash-catalog/tables_index.json`
- 수집/파싱 스크립트: `/tmp/redash-catalog/fetch_recent.py`, `categorize.py`, `parse_tables.py`

`/tmp` 는 재부팅 시 휘발됨 — 영구 보관 필요 시 별도 위치로 이전.

---

## 변경 이력

- **2026-04-18 v2**: dable-query 스킬 schema 검증 후 업데이트.
  - `ad_stats__hourly_service_ad_performance` (1.5), `ad_exchange_cpm_bidding_result` (1.21) 정식 등재 확인 → 🆕 → ✅ 정정
  - `ai_craft` 는 Dable 본체 (AI-Wheres 무관) 임을 확인. AI-Wheres 클러스터(`wheres_*`)와 분리 표기
  - 사용자 요청에 따라 AI-Wheres 클러스터(11개 테이블) 카탈로그화 생략 (단순 목록만 유지)
  - "딥다이브 가치 있는 미등재 테이블" 4개를 §3 별도 섹션으로 분리
- **2026-04-18 v1**: 최초 작성. 110개 쿼리 → 56개 테이블 / 11개 스키마 추출
