-- =============================================================================
-- Migration: External Daily & Mapping Tables
-- Date: 2026-03-25
-- Purpose: Store external ad network settlement data (KL Media, 3DPOP)
-- =============================================================================

-- ------- External daily performance data (multi-source) -------

CREATE TABLE media.external_daily (
  id SERIAL PRIMARY KEY,
  source TEXT NOT NULL,                        -- 'klmedia' | '3dpop'
  date DATE NOT NULL,
  external_service_name TEXT NOT NULL,          -- Media company (e.g., 일간스포츠, 뉴스1)
  external_widget_name TEXT NOT NULL DEFAULT '',  -- Placement detail (KL Media only; empty string for 3DPOP)
  share_type TEXT,                              -- Billing model: CPM etc. (KL Media only)
  imp INTEGER DEFAULT 0,                       -- Impressions
  click INTEGER DEFAULT 0,                     -- Clicks
  revenue INTEGER DEFAULT 0,                   -- Revenue in KRW
  fetched_at TIMESTAMPTZ DEFAULT now()
);

-- Unique constraint: external_widget_name uses '' (not NULL) for 3DPOP rows
ALTER TABLE media.external_daily
  ADD CONSTRAINT uq_external_daily UNIQUE (source, date, external_service_name, external_widget_name);

CREATE INDEX idx_external_daily_date ON media.external_daily (date);
CREATE INDEX idx_external_daily_source ON media.external_daily (source);

COMMENT ON TABLE media.external_daily IS 'Cached external ad network settlement data. Sources: klmedia, 3dpop. Synced via /api/external/sync.';
COMMENT ON COLUMN media.external_daily.source IS 'Data source identifier: klmedia or 3dpop';
COMMENT ON COLUMN media.external_daily.external_service_name IS 'External media company name (maps to media_name from APIs)';
COMMENT ON COLUMN media.external_daily.external_widget_name IS 'External placement/widget name. KL Media only (page_name); null for 3DPOP';
COMMENT ON COLUMN media.external_daily.revenue IS 'Revenue amount in KRW (cost from KL Media, amount_sales from 3DPOP)';

-- ------- External-to-internal widget mapping -------

CREATE TABLE media.external_mapping (
  id SERIAL PRIMARY KEY,
  source TEXT NOT NULL,                        -- 'klmedia' | '3dpop'
  external_key TEXT NOT NULL,                  -- KL: external_widget_name, 3DPOP: company_uid
  widget_id TEXT,                              -- Internal widget_id (nullable until mapped)
  label TEXT,                                  -- Display name override
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(source, external_key)
);

COMMENT ON TABLE media.external_mapping IS 'Manual mapping between external page/uid and internal widget_id. Managed via direct DB inserts (no UI yet).';
COMMENT ON COLUMN media.external_mapping.external_key IS 'Lookup key: page_name for klmedia, company_uid for 3dpop';
