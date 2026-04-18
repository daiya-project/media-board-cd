-- =============================================================================
-- Migration: Create media.daily table
-- Date: 2026-02-25
-- Depends on: 2026022504-table-client, 2026022505-table-service, 2026022506-table-widget
-- =============================================================================
--
-- Purpose:
--   일별 광고 성과 원본 데이터를 저장하는 핵심 팩트 테이블입니다.
--   모든 KPI 대시보드, 데이터 분석, 집계 뷰의 데이터 소스가 됩니다.
--
-- Business context:
--   광고 시스템에서 생성된 CSV 파일을 임포트하면 이 테이블에 적재됩니다.
--   하나의 행은 특정 날짜(date)에 특정 클라이언트(client_id)의
--   특정 서비스(service_id) 하의 특정 위젯(widget_id)에서 발생한 성과를 나타냅니다.
--
-- Composite Primary Key (date, client_id, service_id, widget_id):
--   4개 컬럼의 조합이 PK입니다. 이를 통해:
--   1. 동일 날짜/클라이언트/서비스/위젯 조합의 중복 삽입을 방지합니다.
--   2. 재임포트(UPSERT) 시 기존 데이터를 덮어쓸 수 있습니다.
--   3. widget_id 는 nullable 이므로 위젯 없이 서비스 단위 집계 데이터가
--      올 수 있습니다(NULL 도 PK 구성 요소로 허용됩니다).
--
-- Key metrics explained:
--   cost_spent  : 광고주가 해당 날 지출한 광고비 (광고주 관점의 비용)
--   pub_profit  : 매체(퍼블리셔)가 해당 날 얻은 수익 = ad_revenue
--   imp         : 총 노출수 — 광고가 화면에 표시된 횟수
--   vimp        : 조회 가능 노출수 — IAB 기준 50% 이상이 1초 이상 노출된 횟수
--   cnt_click   : 클릭수
--   cnt_cv      : 서비스 전환수 (광고 → 서비스 목표 달성, 예: 회원가입)
--
-- Derived metrics (뷰에서 계산, 이 테이블에는 저장 안 함):
--   mfr_rate  = pub_profit / cost_spent * 100        (Media Fill Rate %)
--   ctr_rate  = cnt_click / imp * 100                (Click Through Rate %)
--   vctr_rate = cnt_click / vimp * 100               (Viewable CTR %)
--   vrate     = vimp / imp * 100                     (Viewability Rate %)
--   → 이 계산들은 media.v_daily 뷰에서 처리합니다.
--
-- widget_name (snapshot):
--   위젯명은 임포트 시점의 스냅샷으로 저장합니다. media.widget.widget_name 이
--   이후 변경되더라도 과거 데이터의 위젯명은 변하지 않습니다.
--
-- Entity relationships:
--   media.client    ──> media.daily.client_id  (FK)
--   media.service   ──> media.daily.service_id (FK)
--   media.widget    ──> media.daily.widget_id  (FK, nullable)
--   media.daily      ──> media.v_daily              (뷰의 기반 테이블)
--   media.daily      ──> media.v_daily_agg*         (집계 뷰의 기반 테이블)
--   media.daily      ──> media.v_active_widget      (활성 위젯 뷰의 기반 테이블)
-- =============================================================================

CREATE TABLE media.daily (
  date          DATE          NOT NULL,
  client_id     TEXT          NOT NULL REFERENCES media.client(client_id),      -- Advertiser reference
  service_id    TEXT          NOT NULL REFERENCES media.service(service_id),    -- Service channel reference
  widget_id     TEXT          REFERENCES media.widget(widget_id),               -- Ad slot reference (nullable)
  widget_name   TEXT,                            -- Widget name snapshot at import time
  cost_spent    NUMERIC(15, 4) NOT NULL DEFAULT 0,  -- Advertiser's ad spend for the day
  pub_profit    NUMERIC(15, 4) NOT NULL DEFAULT 0,  -- Publisher's revenue for the day (= ad_revenue)
  imp           BIGINT        NOT NULL DEFAULT 0,   -- Total impressions
  vimp          BIGINT        NOT NULL DEFAULT 0,   -- Viewable impressions (IAB standard)
  cnt_click     BIGINT        NOT NULL DEFAULT 0,   -- Total clicks
  cnt_cv        BIGINT        NOT NULL DEFAULT 0,   -- Service conversions (goal completions)
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),

  PRIMARY KEY (date, client_id, service_id, widget_id)
  -- Note: widget_id IS NULL represents service-level aggregated data (no specific widget).
);

-- Table-level comment
COMMENT ON TABLE media.daily IS
  '일별 광고 성과 원본 팩트 테이블. '
  '(date, client_id, service_id, widget_id) 복합 PK로 중복을 방지하며 UPSERT 재임포트를 지원합니다. '
  '원본 수치만 저장하며, 파생 지표(mfr_rate, ctr_rate 등)는 media.v_daily 뷰에서 계산합니다. '
  '모든 KPI 대시보드(v_daily_agg), 클라이언트별 분석(v_daily_agg_by_client), 서비스별 분석(v_daily_agg_by_service)의 데이터 소스입니다.';

-- Column-level comments
COMMENT ON COLUMN media.daily.date       IS '성과 발생 날짜. 복합 PK의 첫 번째 구성 요소.';
COMMENT ON COLUMN media.daily.client_id  IS '광고주 ID. media.client.client_id 참조. 복합 PK의 두 번째 구성 요소.';
COMMENT ON COLUMN media.daily.service_id IS '서비스(채널) ID. media.service.service_id 참조. 복합 PK의 세 번째 구성 요소.';
COMMENT ON COLUMN media.daily.widget_id  IS '위젯(광고 슬롯) ID. media.widget.widget_id 참조. NULL 허용 — 위젯 없이 서비스 단위 집계 데이터인 경우 NULL. 복합 PK의 네 번째 구성 요소.';
COMMENT ON COLUMN media.daily.widget_name IS 'CSV 임포트 시점의 위젯명 스냅샷. media.widget.widget_name 이 변경되어도 이 값은 유지됩니다.';
COMMENT ON COLUMN media.daily.cost_spent IS '광고주 지출 비용 (광고주 관점). 소수점 4자리까지 저장합니다. mfr_rate = pub_profit / cost_spent * 100 의 분모입니다.';
COMMENT ON COLUMN media.daily.pub_profit IS '매체사(퍼블리셔) 수익 = ad_revenue. v_daily 뷰에서 ad_revenue 별칭으로 노출됩니다.';
COMMENT ON COLUMN media.daily.imp        IS '총 노출수. 광고가 화면에 렌더링된 전체 횟수입니다. ctr_rate = cnt_click / imp 의 분모입니다.';
COMMENT ON COLUMN media.daily.vimp       IS '조회 가능 노출수(Viewable Impression). IAB 기준: 광고의 50% 이상이 1초 이상 화면에 표시된 노출. vctr_rate = cnt_click / vimp 의 분모입니다.';
COMMENT ON COLUMN media.daily.cnt_click  IS '클릭수. 광고를 사용자가 클릭한 총 횟수입니다.';
COMMENT ON COLUMN media.daily.cnt_cv     IS '서비스 전환수(Conversion). 광고를 통해 서비스 목표(회원가입, 구매 등)를 달성한 횟수입니다.';
COMMENT ON COLUMN media.daily.created_at IS '레코드 최초 생성 시각 (UTC). CSV 임포트 시점입니다.';
COMMENT ON COLUMN media.daily.updated_at IS '레코드 최종 수정 시각 (UTC). UPSERT 재임포트 시 갱신됩니다. trg_daily_updated_at 트리거가 자동 갱신합니다.';

CREATE INDEX idx_daily_date       ON media.daily (date DESC);
CREATE INDEX idx_daily_client_id  ON media.daily (client_id);
CREATE INDEX idx_daily_service_id ON media.daily (service_id);

-- Auto-update updated_at on every row modification
CREATE TRIGGER trg_daily_updated_at
  BEFORE UPDATE ON media.daily
  FOR EACH ROW EXECUTE FUNCTION media.set_updated_at();
