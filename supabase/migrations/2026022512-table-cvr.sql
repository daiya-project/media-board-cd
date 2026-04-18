-- =============================================================================
-- Migration: Create media.cvr table
-- Date: 2026-02-25 (redesigned: 2026-03-01)
-- Depends on: 2026022501-schema-media
-- =============================================================================
--
-- Purpose:
--   CVR 관련 일별 광고 성과 지표를 저장합니다.
--   외부 분석 시스템에서 생성된 집계 CSV를 임포트합니다.
--
-- Business context:
--   CVR 데이터는 외부 분석 시스템에서 생성된 CSV를 임포트합니다.
--   CSV의 date 컬럼(YYYY-MM-DD)을 그대로 date 컬럼에 저장합니다.
--   media.daily 와 독립적으로 관리됩니다.
--   client_id, service_id 는 media.client, media.service 의 PK와 동일한 값을 사용하지만
--   CSV 호환성을 위해 FK 제약 없이 TEXT로 저장합니다.
--
-- Primary Key (date, service_id):
--   일자(YYYY-MM-DD) + 서비스ID 복합 PK.
--   동일 일자에 동일 서비스가 중복 삽입되지 않습니다.
--   재임포트 시 UPSERT로 기존 데이터를 갱신합니다.
--
-- level column:
--   CSV에 포함되지 않으며, 임포트 시 contribution_margin_rate_pct(CMR) 와
--   normalized_cvr_pct(CVR) 값을 기반으로 calcLevel() 함수로 계산하여 저장합니다.
--   계산 로직: lib/utils/calculate-utils.ts#calcLevel
--
-- _pct suffix columns:
--   이미 백분율로 계산된 값을 그대로 저장합니다. 예: vctr_pct = 1.23 → 1.23% 를 의미.
--   UI 표시 시 % 기호만 부착합니다 (* 100 변환 불필요).
--
-- Excluded columns (보조지표, DB 미저장):
--   normalized_ctr_pct, normalized_vctr_pct, server_fee_rate_pct,
--   media_fee, media_fee_rate_pct, rms, contribution_margin
--
-- CSV source columns mapped to this table (as of 2026-03-01):
--   date (YYYY-MM-DD, そのまま),
--   client_id, service_id, service_name, service_type,
--   revenue, vimp, rpm, vctr_pct, cpc, click, campaign_count,
--   normalized_cvr_pct, invalid_revenue_ratio_pct,
--   contribution_margin_rate_pct
-- =============================================================================

-- Drop existing objects before recreation
DROP TRIGGER IF EXISTS trg_cvr_updated_at ON media.cvr;
DROP TABLE IF EXISTS media.cvr;

CREATE TABLE media.cvr (
  -- -------------------------------------------------------------------------
  -- Identity / key columns
  -- -------------------------------------------------------------------------
  date                          DATE          NOT NULL,            -- Record date (YYYY-MM-DD); CSV date column stored as-is
  client_id                     TEXT          NOT NULL,            -- Client ID (TEXT; no FK — CSV compatibility)
  service_id                    TEXT          NOT NULL,            -- Service ID (TEXT; no FK — CSV compatibility)

  -- -------------------------------------------------------------------------
  -- Descriptive columns
  -- -------------------------------------------------------------------------
  client_name                   TEXT,                             -- Client name snapshot (nullable; not in CSV, always NULL)
  service_name                  TEXT,                             -- Service name
  service_type                  TEXT,                             -- Service ad format type
  level                         TEXT,                             -- Audience level (A~F); computed via calcLevel() at import time

  -- -------------------------------------------------------------------------
  -- Volume / performance metrics
  -- -------------------------------------------------------------------------
  revenue                       BIGINT,                           -- Ad revenue (KRW, integer)
  vimp                          BIGINT,                           -- Viewable impressions
  rpm                           INTEGER,                          -- Revenue per mille (integer, no decimals)
  vctr_pct                      NUMERIC(20, 6),                   -- Viewable CTR (raw decimal from CSV, e.g. 0.95)
  cpc                           INTEGER,                          -- Cost per click (integer, no decimals)
  click                         BIGINT,                           -- Total clicks
  campaign_count                INTEGER,                          -- Number of campaigns

  -- -------------------------------------------------------------------------
  -- Rate columns
  -- -------------------------------------------------------------------------
  normalized_cvr_pct            NUMERIC(20, 6),                   -- Normalized Conversion Rate (raw decimal from CSV)
  invalid_revenue_ratio_pct     NUMERIC(20, 6),                   -- Invalid revenue ratio (raw decimal from CSV)

  -- -------------------------------------------------------------------------
  -- Cost / margin columns
  -- -------------------------------------------------------------------------
  contribution_margin_rate_pct  NUMERIC(20, 6),                   -- Contribution margin rate / CMR (raw decimal from CSV)

  -- -------------------------------------------------------------------------
  -- Audit columns
  -- -------------------------------------------------------------------------
  created_at                    TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at                    TIMESTAMPTZ   NOT NULL DEFAULT now(),

  PRIMARY KEY (date, service_id)
);

-- ---------------------------------------------------------------------------
-- Table-level comment
-- ---------------------------------------------------------------------------
COMMENT ON TABLE media.cvr IS
  'CVR 일별 광고 성과 분석 데이터 테이블. '
  '외부 분석 시스템에서 생성된 CSV를 임포트합니다. '
  'CSV date 컬럼(YYYY-MM-DD)을 그대로 저장합니다. '
  '_pct suffix 컬럼은 CSV 원본 소수값 그대로 저장하며, UI에서 % 기호를 부착합니다. '
  'level 컬럼은 임포트 시 contribution_margin_rate_pct(CMR) + normalized_cvr_pct(CVR)로 calcLevel() 계산.';

-- ---------------------------------------------------------------------------
-- Column-level comments
-- ---------------------------------------------------------------------------

-- Identity
COMMENT ON COLUMN media.cvr.date        IS '기준 일자 (YYYY-MM-DD). 복합 PK의 첫 번째 구성 요소. CSV date 컬럼 그대로 저장.';
COMMENT ON COLUMN media.cvr.client_id   IS '클라이언트 ID (TEXT). media.client.client_id 와 동일한 값이어야 하지만 FK 제약 없이 저장.';
COMMENT ON COLUMN media.cvr.service_id  IS '서비스 ID (TEXT). 복합 PK의 두 번째 구성 요소. media.service.service_id 와 동일한 값이어야 하지만 FK 제약 없이 저장.';

-- Descriptive
COMMENT ON COLUMN media.cvr.client_name  IS '클라이언트명 스냅샷. CSV에 없는 컬럼, 항상 NULL로 저장.';
COMMENT ON COLUMN media.cvr.service_name IS '서비스명.';
COMMENT ON COLUMN media.cvr.service_type IS '서비스 광고 유형. 예: 종합일간지, 포털, 방송/통신사.';
COMMENT ON COLUMN media.cvr.level        IS '오디언스 레벨 (A~F). CSV에 없는 컬럼. 임포트 시 calcLevel(contribution_margin_rate_pct, normalized_cvr_pct)로 계산하여 저장. lib/utils/calculate-utils.ts 참조.';

-- Volume / performance
COMMENT ON COLUMN media.cvr.revenue        IS '광고 수익 (KRW 정수).';
COMMENT ON COLUMN media.cvr.vimp           IS '조회 가능 노출수 (Viewable Impression).';
COMMENT ON COLUMN media.cvr.rpm            IS 'Revenue per Mille. 1,000 조회 가능 노출당 수익 (정수, 소수점 없음).';
COMMENT ON COLUMN media.cvr.vctr_pct       IS 'Viewable CTR. CSV 원본 소수값 그대로 저장 (예: 0.95). UI에서 % 기호 부착.';
COMMENT ON COLUMN media.cvr.cpc            IS 'Cost Per Click. 클릭 1회당 광고 비용 (정수, 소수점 없음).';
COMMENT ON COLUMN media.cvr.click          IS '총 클릭수.';
COMMENT ON COLUMN media.cvr.campaign_count IS '캠페인 수.';

-- Rate columns
COMMENT ON COLUMN media.cvr.normalized_cvr_pct        IS '정규화 Conversion Rate (CVR). CSV 원본 소수값 그대로 저장. calcLevel()의 cvr 파라미터로 사용.';
COMMENT ON COLUMN media.cvr.invalid_revenue_ratio_pct IS '무효 수익 비율. CSV 원본 소수값 그대로 저장 (예: 0.03 = 3%).';

-- Cost / margin
COMMENT ON COLUMN media.cvr.contribution_margin_rate_pct IS '공헌 이익률 (CMR). CSV 원본 소수값 그대로 저장. calcLevel()의 cmr 파라미터로 사용.';

-- Audit
COMMENT ON COLUMN media.cvr.created_at IS '레코드 최초 생성 시각 (UTC). CSV 임포트 시점.';
COMMENT ON COLUMN media.cvr.updated_at IS '레코드 최종 수정 시각 (UTC). trg_cvr_updated_at 트리거가 자동 갱신.';

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX idx_cvr_date       ON media.cvr (date DESC);
CREATE INDEX idx_cvr_client_id  ON media.cvr (client_id);

-- ---------------------------------------------------------------------------
-- Trigger: auto-update updated_at
-- ---------------------------------------------------------------------------
CREATE TRIGGER trg_cvr_updated_at
  BEFORE UPDATE ON media.cvr
  FOR EACH ROW EXECUTE FUNCTION media.set_updated_at();
