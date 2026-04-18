-- =============================================================================
-- Migration: External FC Report Tables
-- Date: 2026-04-14
-- Purpose: Widget-level FC management report (FC관리 엑셀 리포트 이식)
-- =============================================================================

-- ------- Daily manual inputs (FC amount + MFR trio) -------

CREATE TABLE media.external_fc_daily (
  widget_id   TEXT NOT NULL,
  date        DATE NOT NULL,
  fc_amount   NUMERIC,              -- B FC 금액
  total_mfr   NUMERIC,              -- N 전체 MFR (0~1)
  dable_mfr   NUMERIC,              -- O 데이블 MFR
  vendor_mfr  NUMERIC,              -- P 싱크/업체 MFR
  m_time      TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (widget_id, date)
);

COMMENT ON TABLE media.external_fc_daily IS 'Manual daily inputs for FC report (FC amount, MFR per widget/date).';
COMMENT ON COLUMN media.external_fc_daily.total_mfr IS 'Overall monetized fill rate (0~1).';
COMMENT ON COLUMN media.external_fc_daily.dable_mfr IS 'Dable DSP monetized fill rate (0~1).';
COMMENT ON COLUMN media.external_fc_daily.vendor_mfr IS '3rd party (syncmedia/klmedia) monetized fill rate (0~1).';

-- ------- Widget-level report constants -------

CREATE TABLE media.external_fc_config (
  widget_id            TEXT PRIMARY KEY,
  rpm_obi_ratio        NUMERIC DEFAULT 0.34,    -- L2 (RPM OBI = RPM_dashboard / this)
  server_cost_rate     NUMERIC DEFAULT 0.047,   -- X = Y * this
  apc_rate             NUMERIC DEFAULT 0.017,   -- W = Z * this
  fn_media_weight      NUMERIC DEFAULT 0.75,    -- U = Y*this + Z*(1-this)
  fn_ad_weight         NUMERIC DEFAULT 0.25,    -- (redundant but stored for clarity)
  ad_revenue_rate      NUMERIC DEFAULT 0.95,    -- Z = Y * this
  pb_server_discount   NUMERIC DEFAULT 0.1,     -- AE = AF * server_cost_rate * this
  note                 TEXT,
  m_time               TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE media.external_fc_config IS 'Per-widget constants used by the FC report formulas. Absent row → use global defaults.';

-- ------- Widget-level funnel cache from Dable DW (Redash) -------

CREATE TABLE media.external_widget_funnel_daily (
  widget_id          TEXT NOT NULL,
  date               DATE NOT NULL,
  requests           INTEGER,           -- D 요청수 (DAILY_CTR_4MEDIA_BY_SERVICE_WIDGET.requests)
  imp_dsp1_2         INTEGER,           -- E 응답수 근사 (impressions_dsp1_2)
  imp_dsp3_passback  INTEGER,           -- I 데이블 패스백 노출수 (impressions_dsp3)
  m_time             TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (widget_id, date)
);

CREATE INDEX idx_ext_widget_funnel_date ON media.external_widget_funnel_daily (date);

COMMENT ON TABLE media.external_widget_funnel_daily IS 'Daily DW funnel snapshot per widget (from ad_stats.DAILY_CTR_4MEDIA_BY_SERVICE_WIDGET via Redash).';
COMMENT ON COLUMN media.external_widget_funnel_daily.imp_dsp1_2 IS 'DSP1+DSP2 impressions, used as approximation of Dable response count (엑셀 E 컬럼).';
COMMENT ON COLUMN media.external_widget_funnel_daily.imp_dsp3_passback IS 'DSP3 passback impressions (엑셀 I 컬럼).';

-- ------- Rate/ratio bounds (defensive) -------

ALTER TABLE media.external_fc_daily
  ADD CONSTRAINT chk_fc_total_mfr  CHECK (total_mfr  IS NULL OR (total_mfr  >= 0 AND total_mfr  <= 1)),
  ADD CONSTRAINT chk_fc_dable_mfr  CHECK (dable_mfr  IS NULL OR (dable_mfr  >= 0 AND dable_mfr  <= 1)),
  ADD CONSTRAINT chk_fc_vendor_mfr CHECK (vendor_mfr IS NULL OR (vendor_mfr >= 0 AND vendor_mfr <= 1));

ALTER TABLE media.external_fc_config
  ADD CONSTRAINT chk_fc_rpm_obi        CHECK (rpm_obi_ratio > 0 AND rpm_obi_ratio <= 1),
  ADD CONSTRAINT chk_fc_server_rate    CHECK (server_cost_rate >= 0 AND server_cost_rate <= 1),
  ADD CONSTRAINT chk_fc_apc_rate       CHECK (apc_rate >= 0 AND apc_rate <= 1),
  ADD CONSTRAINT chk_fc_fn_media       CHECK (fn_media_weight >= 0 AND fn_media_weight <= 1),
  ADD CONSTRAINT chk_fc_fn_ad          CHECK (fn_ad_weight >= 0 AND fn_ad_weight <= 1),
  ADD CONSTRAINT chk_fc_fn_sum         CHECK (fn_media_weight + fn_ad_weight = 1),
  ADD CONSTRAINT chk_fc_ad_rev_rate    CHECK (ad_revenue_rate >= 0 AND ad_revenue_rate <= 1),
  ADD CONSTRAINT chk_fc_pb_discount    CHECK (pb_server_discount >= 0 AND pb_server_discount <= 1);
