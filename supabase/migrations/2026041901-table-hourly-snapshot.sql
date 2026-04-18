-- =============================================================================
-- Migration: Create media.hourly_snapshot table
-- Date: 2026-04-19
-- Depends on: 2026022501-schema-media (media schema + media.set_updated_at)
-- =============================================================================
--
-- Purpose:
--   매체사(KR_native) 전체 합산의 시간대별 실시간 성과 스냅샷 팩트 테이블.
--   대시보드 하단 "오늘 트렌드 vs 과거 베이스라인 비교" 보드의 데이터 소스.
--   Redash Trino 에서 매시간 :20 / :50 KST cron 적재 (14일 rolling retention).
--
-- Business context:
--   매체보드의 "오늘 시간대 추세" 화면은 자체 매체비/매출 절대값 정확도보다
--   "오늘 어느 시간대까지 누적이 어제·지난 N영업일 평균 대비 어떤 추세인지"
--   를 빠르게 보는 것이 목적. 따라서 매체별 분리 적재 대신
--   전사(KR_native) 합산 1 row 만 보관하여 단순화 (광고주 사이드의
--   ads.hourly_ad_stats 와 동일 패턴).
--
-- Composite Primary Key (date_kst, hour_kst):
--   KST 기준 (date, hour) 의 단일 합산 행. UPSERT 재적재로 cutoff 누적 갱신.
--
-- =============================================================================
-- 🔴 핵심 — Dable 의 4개 매출/매체비 스트림 (이 테이블 컬럼의 의미 해석에 필수)
-- =============================================================================
--
-- Dable 광고는 두 종류의 DSP 흐름으로 송출되고, 각각이 매출(Dable 수신)과
-- 매체비(Dable → 매체 지급) 양쪽에 잡혀 총 4 스트림이 존재한다.
--
-- ┌──────┬───────────────────────┬───────────────────────────┬──────────────────────────┐
-- │ 코드 │ 이름                  │ 매출 (Dable 수신)         │ 매체비 (Dable → 매체)    │
-- ├──────┼───────────────────────┼───────────────────────────┼──────────────────────────┤
-- │ DSP1 │ DNA DSP (Dable 자체)  │ 광고주 → Dable            │ Dable → 매체             │
-- │      │ = 자체 ML 모델로 송출 │ (광고주 광고비)           │ (계약 RS%/CPM 기반)      │
-- │      │ 내부 모델: vodka_v3_  │                           │                          │
-- │      │   {korea|xandr|kakao  │                           │                          │
-- │      │   |taiwan}_mtl*_m3_*  │                           │                          │
-- │      │ ⚠️ "xandr/kakao" 는   │                           │                          │
-- │      │   DSP1 내부 모델 분류 │                           │                          │
-- │      │   이지 DSP3 가 아님.  │                           │                          │
-- │      │   (kr.msn.com/xandr   │                           │                          │
-- │      │   같은 ADX 매체와도   │                           │                          │
-- │      │   별개)               │                           │                          │
-- ├──────┼───────────────────────┼───────────────────────────┼──────────────────────────┤
-- │ DSP2 │ External NA DSP       │ 광고주 → Dable            │ Dable → 매체             │
-- │      │ (소량, 사실상 DSP1 과 │ (DSP1 의 ~0.4% 수준)      │                          │
-- │      │ 묶여서 "self DSP" 로  │                           │                          │
-- │      │ 처리)                 │                           │                          │
-- ├──────┼───────────────────────┼───────────────────────────┼──────────────────────────┤
-- │ DSP3 │ ★ Passback (외부 벤더)│ ★ 외부 벤더 → Dable       │ Dable → 매체             │
-- │      │ = Dable 위젯에 외부   │ (벤더 통화 CPM 정산)      │ (widget × vendor 별      │
-- │      │ 벤더가 자기네 광고를  │                           │ 별도 계약 CPM)           │
-- │      │ 송출하는 흐름.        │ ┌─────────────────────┐   │                          │
-- │      │                       │ │ 매출 = passback_imp │   │ 매체비 = passback_imp ×  │
-- │      │ 벤더 목록             │ │   × vendor_to_dable │   │   dable_to_media_cpm /   │
-- │      │  - 싱크미디어         │ │   _cpm / 1000       │   │   1000                   │
-- │      │    (구 3DPOP)         │ │                     │   │                          │
-- │      │  - KL미디어           │ │ "외부 벤더가 데이블 │   │ "데이블이 매체사에게     │
-- │      │  - 친구플러스         │ │  에게 주는 CPM ×    │   │  지급하는 CPM (계약)"    │
-- │      │  - 루애드             │ │  위젯 imp"          │   │                          │
-- │      │  - AnyMind 등         │ └─────────────────────┘   │                          │
-- │      │                       │                           │                          │
-- │      │ Dable 의 passback 마진│ = (수신 CPM - 지급 CPM) × imp / 1000                 │
-- ├──────┼───────────────────────┼───────────────────────────┼──────────────────────────┤
-- │ ADX  │ MSN/Xandr 등 거래소   │ 거래소 → Dable            │ Dable → 매체             │
-- │      │ (KR_native 매체에는   │ (KR_native 에는 영향 미미,│ (1.1 의 widget_id='adx'  │
-- │      │ 영향 미미. ADX4 4개   │ 별도 ADX 매체에서 발생)   │ 가상 행)                 │
-- │      │ 서비스 (15580/15691/  │                           │                          │
-- │      │ 15692/16250) 는       │                           │ ⚠️ 이 테이블은 KR_native │
-- │      │ US 등록이라 이 테이블 │                           │ 만 합산하므로 ADX 매체비 │
-- │      │ 에서 자동 제외됨.     │                           │ 는 사실상 0.              │
-- └──────┴───────────────────────┴───────────────────────────┴──────────────────────────┘
--
-- =============================================================================
-- 🔴 매체비 합산의 함정 (CPM 더블카운트 — 절대 금지)
-- =============================================================================
--
-- Trino 1.1 (fact_daily.ad_stats__daily_actual_sharing_cost_by_service_widget) 의
-- media_fee_dsp1 / media_fee_dsp2 / media_fee_dsp3 컬럼은 **단순 합산하면 안 된다**.
-- CPM 계약 매체에서 dsp1 == dsp2 더블카운트가 발생함.
--
-- 실측 (KR_native, 2026-04-15~17):
--   actual_sharing_cost = 17,799,450 (권위)
--   dsp1 + dsp2 + dsp3 + adx = 28,005,396 (1.57× — 더블카운트 발생!)
--
-- 권위 컬럼은 1.1.actual_sharing_cost 단일 컬럼.
-- 분해는 다음 공식으로:
--
--   self_dsp_fee (DSP1+DSP2 deduplicated)
--     = actual_sharing_cost - SUM(widget_id='adx' 행) - SUM(media_fee_dsp3)
--     ≈ 1.13.media_fee_krw (hourly 권위)
--
--   adx_fee  = 1.1 의 widget_id='adx' 행
--   dsp3_fee = 1.1.media_fee_dsp3 (= passback 매체 지급)
--
-- =============================================================================
-- 🔴 hourly 팩트의 dsp3 누락 (이 테이블이 재구성으로 보완)
-- =============================================================================
--
-- 1.15/1.11 (hourly_ctr_4media) 의 org_cost_spent 는 DSP1+DSP2 만 포함,
-- DSP3 (passback 정산매출) 미포함.
--
-- 1.13 (hourly_media_fee_by_widget) 의 media_fee_krw 는 DSP1+DSP2 (= self DSP) 만,
-- DSP3 매체비 / ADX 매체비 미포함.
--
-- 따라서 cron 적재 시 다음 두 가지 재구성 필수:
--   1. revenue_passback_krw  = passback_imp × vendor_to_dable_cpm  (1.12 cpm_value)
--   2. media_fee_passback_krw = passback_imp × dable_to_media_cpm  (1.12-b setting.value)
--
-- 두 CPM 을 혼동하면 매출/매체비가 어긋나 mfr 이 이상해짐.
--   - vendor_to_dable_cpm (1.12.cpm_value)        = 벤더 → Dable 수신 → revenue 재구성
--   - dable_to_media_cpm  (1.12-b setting.value)  = Dable → 매체 지급 → media_fee 재구성
--
-- 재구성 정확도 실측 (KR 7일): imp Δ -0.3%, revenue Δ -0.5%. daily 원본 대비 무시 가능.
--
-- 자세한 검증 데이터·공식·안티패턴은 → _docs/01-infra-08-data-3rd_party.md 참조.
-- =============================================================================

CREATE TABLE media.hourly_snapshot (
  date_kst                 DATE          NOT NULL,
  hour_kst                 SMALLINT      NOT NULL CHECK (hour_kst BETWEEN 0 AND 23),

  -- ---- 매출 (Revenue) — Dable 입금 ------------------------------------------
  -- self_dsp = DSP1 (DNA DSP, Dable 자체 ML 모델 송출) + DSP2 (External NA, 소량).
  --            광고주가 광고비로 Dable 에게 지급한 금액.
  -- passback = DSP3. 외부 벤더 (싱크미디어/KL미디어/친구플러스/루애드/AnyMind 등)
  --            가 자기네 광고를 Dable 위젯에 송출하고 CPM 기준으로 정산해주는 매출.
  --            hourly 재구성 = passback_imp × (벤더→Dable 수신 CPM) / 1000.
  -- revenue  = self_dsp + passback (= 1.10 daily org_cost_spent 와 정합).
  revenue_self_dsp_krw     BIGINT        NOT NULL DEFAULT 0,
  revenue_passback_krw     BIGINT        NOT NULL DEFAULT 0,
  revenue_krw              BIGINT        NOT NULL DEFAULT 0,

  -- ---- 매체비 (Media Fee) — Dable 출금 (매체사에게 지급) --------------------
  -- self_dsp = 1.13 media_fee_krw 합산 (DSP1+DSP2 dedup, ADX/dsp3 미포함).
  -- passback = DSP3 매체비. Dable 이 passback 트래픽 매체에게 별도 계약 CPM
  --            (widget × vendor) 으로 지급. hourly 재구성 = passback_imp ×
  --            (Dable→매체 지급 CPM, 1.12-b setting.value) / 1000.
  -- 합산 = self_dsp + passback (KR_native 만 집계하므로 ADX 매체비는 사실상 0).
  media_fee_self_dsp_krw   BIGINT        NOT NULL DEFAULT 0,
  media_fee_passback_krw   BIGINT        NOT NULL DEFAULT 0,
  media_fee_krw            BIGINT        NOT NULL DEFAULT 0,
  mfr_pct                  NUMERIC(7,2),

  -- ---- 마진 (참고) ---------------------------------------------------------
  -- DSP 별 분해는 (revenue_passback - media_fee_passback) = passback margin,
  -- (revenue_self_dsp - media_fee_self_dsp) = self DSP margin 으로 추가 분석 가능.
  dable_margin_krw         BIGINT,

  -- ---- 트래픽 -------------------------------------------------------------
  impressions              BIGINT        NOT NULL DEFAULT 0,
  vimp                     BIGINT        NOT NULL DEFAULT 0,
  clicks                   BIGINT        NOT NULL DEFAULT 0,
  passback_imp             BIGINT        NOT NULL DEFAULT 0,
  vctr_pct                 NUMERIC(7,4),
  cpc                      NUMERIC(12,2),
  erpm                     NUMERIC(12,2),

  -- ---- Fill rate (1.18, KR_native 합산) -----------------------------------
  ad_request_items         BIGINT,
  ad_response_items        BIGINT,
  fill_rate_pct            NUMERIC(7,2),

  -- ---- 메타: partial_today cutoff 표시용 ----------------------------------
  -- 오늘 row 가 부분일 때 "KST HH 시까지 누적 기준" 을 UI 에 명시.
  -- 과거 완료된 일자는 23 으로 채움.
  cutoff_kst_hour          SMALLINT,

  created_at               TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ   NOT NULL DEFAULT now(),

  PRIMARY KEY (date_kst, hour_kst)
);

-- Table-level comment
COMMENT ON TABLE media.hourly_snapshot IS
  'KR_native 매체 전사 합산 시간별 성과 스냅샷. (date_kst, hour_kst) 단일 PK. '
  'Redash Trino 에서 매시 :20/:50 KST cron 으로 적재, 14일 rolling retention. '
  'DSP1+DSP2 (self DSP) 와 DSP3 (passback 외부 벤더) 의 매출·매체비를 모두 정확히 분해 적재. '
  'hourly 24h 합산 ≈ daily 정합 (-0.5% 이내). '
  '자세한 DSP 정의 / 안티패턴 / 검증은 _docs/01-infra-08-data-3rd_party.md 참조.';

-- Column-level comments
COMMENT ON COLUMN media.hourly_snapshot.date_kst IS
  '성과 발생 일자 (KST). 복합 PK 첫 번째 구성 요소.';
COMMENT ON COLUMN media.hourly_snapshot.hour_kst IS
  '성과 발생 시각 (KST 0~23). 복합 PK 두 번째 구성 요소.';

COMMENT ON COLUMN media.hourly_snapshot.revenue_self_dsp_krw IS
  'Self DSP 매출 (DSP1 DNA DSP + DSP2 External NA). 1.15 org_cost_spent 합산. '
  '광고주가 Dable 에게 지급한 광고비. KRW.';
COMMENT ON COLUMN media.hourly_snapshot.revenue_passback_krw IS
  'Passback (DSP3) 매출. 외부 벤더 (싱크미디어/KL미디어/친구플러스/루애드/AnyMind 등) 의 '
  '광고 송출분에 대해 벤더가 Dable 에게 정산하는 매출. '
  'hourly 재구성: 1.12-a.ad_widget_impressions × 1.12.cpm_value (벤더→Dable 수신 CPM) / 1000. KRW.';
COMMENT ON COLUMN media.hourly_snapshot.revenue_krw IS
  '총 매출 = self_dsp + passback. daily 1.10.org_cost_spent 와 정합 (-0.5% 이내). KRW.';

COMMENT ON COLUMN media.hourly_snapshot.media_fee_self_dsp_krw IS
  'Self DSP (DSP1+DSP2) 매체사 지급액. 1.13 media_fee_krw 합산 (deduplicated). '
  'ADX 매체비, DSP3 매체비 미포함. KRW.';
COMMENT ON COLUMN media.hourly_snapshot.media_fee_passback_krw IS
  'DSP3 (Passback) 매체사 지급액. Dable 이 외부 벤더 트래픽 매체사에게 widget × vendor '
  '계약 CPM 으로 지급. '
  'hourly 재구성: 1.12-a.ad_widget_impressions × 1.12-b.setting.value (Dable→매체 지급 CPM) / 1000. '
  '⚠️ 1.12.cpm_value 는 수신 CPM 이라 매체비 계산에 쓰면 안 됨. KRW.';
COMMENT ON COLUMN media.hourly_snapshot.media_fee_krw IS
  '총 매체비 = self_dsp + passback. daily 1.1.actual_sharing_cost 와 정합 '
  '(-0.5% 이내, KR_native 한정 — ADX 매체비 미포함). KRW.';
COMMENT ON COLUMN media.hourly_snapshot.mfr_pct IS
  'Media Fee Rate = media_fee_krw / revenue_krw × 100 (%). '
  '정상 밴드 30~75%. 100% 초과 시 역마진.';
COMMENT ON COLUMN media.hourly_snapshot.dable_margin_krw IS
  'Dable 마진 = revenue_krw - media_fee_krw. 보조 지표. '
  '(revenue_passback - media_fee_passback) = Dable 의 passback 마진.';

COMMENT ON COLUMN media.hourly_snapshot.impressions IS
  '총 위젯 노출 수 (Dable 응답 + passback 합산).';
COMMENT ON COLUMN media.hourly_snapshot.vimp IS
  '유효노출 (Viewable Impression). IAB 기준 50% 이상이 1초 이상 노출.';
COMMENT ON COLUMN media.hourly_snapshot.clicks IS
  '클릭 수.';
COMMENT ON COLUMN media.hourly_snapshot.passback_imp IS
  'DSP3 (passback) 노출 수. 1.12-a.ad_widget_impressions 합산. '
  'impressions 의 부분집합 — 이 중에 외부 벤더 광고가 송출된 imp.';
COMMENT ON COLUMN media.hourly_snapshot.vctr_pct IS
  'Viewable CTR (%) = clicks / vimp × 100.';
COMMENT ON COLUMN media.hourly_snapshot.cpc IS
  'Cost Per Click = revenue_krw / clicks (KRW).';
COMMENT ON COLUMN media.hourly_snapshot.erpm IS
  'Effective RPM = revenue_krw / vimp × 1000. 유효노출 1000 회당 매출. '
  '동의어: vRPM (cost / vimp × 1000 동일 공식).';

COMMENT ON COLUMN media.hourly_snapshot.ad_request_items IS
  '광고 요청 슬롯 수 (1.18 ad_request_items 합산). fill rate 분모.';
COMMENT ON COLUMN media.hourly_snapshot.ad_response_items IS
  '광고 응답 슬롯 수 (1.18 ad_response_items 합산). fill rate 분자.';
COMMENT ON COLUMN media.hourly_snapshot.fill_rate_pct IS
  'Fill Rate (%) = ad_response_items / ad_request_items × 100. OBI 기본 정의 (fill_rate_by_slot).';

COMMENT ON COLUMN media.hourly_snapshot.cutoff_kst_hour IS
  'KST cutoff 시각 (0~23). 부분일 (오늘) row 의 누적 기준 시각. '
  '과거 완료된 일자는 23 으로 채움. UI 에서 "KST HH시 cutoff 누적" 고지에 사용.';

COMMENT ON COLUMN media.hourly_snapshot.created_at IS '레코드 최초 생성 시각 (UTC).';
COMMENT ON COLUMN media.hourly_snapshot.updated_at IS
  '레코드 최종 수정 시각 (UTC). UPSERT 재적재 시 갱신. trg_hourly_snapshot_updated_at 트리거가 자동 갱신.';

-- Index for date-range scan (대시보드는 최근 N일 hourly 조회가 주 패턴)
CREATE INDEX idx_hourly_snapshot_date
  ON media.hourly_snapshot (date_kst DESC, hour_kst DESC);

-- Auto-update updated_at on every row modification
CREATE TRIGGER trg_hourly_snapshot_updated_at
  BEFORE UPDATE ON media.hourly_snapshot
  FOR EACH ROW EXECUTE FUNCTION media.set_updated_at();
