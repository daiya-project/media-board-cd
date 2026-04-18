-- =============================================================================
-- Migration: Rename source '3dpop' → 'syncmedia' in external tables
-- Date: 2026-03-25
-- Depends on: 2026032501-table-external
-- Reason: rebranding from 3DPOP to SyncMedia
-- =============================================================================

-- 1. Update source values in data tables
UPDATE media.external_daily
SET source = 'syncmedia'
WHERE source = '3dpop';

UPDATE media.external_mapping
SET source = 'syncmedia'
WHERE source = '3dpop';

-- 2. Update table-level comments
COMMENT ON TABLE media.external_daily IS 'Cached external ad network settlement data. Sources: klmedia, syncmedia. Synced via /api/external/sync.';

-- 3. Update column-level comments that referenced '3dpop'
COMMENT ON COLUMN media.external_daily.source IS 'Data source identifier: klmedia or syncmedia';
COMMENT ON COLUMN media.external_daily.external_widget_name IS 'External placement/widget name. KL Media only (page_name); empty string for syncmedia';
COMMENT ON COLUMN media.external_mapping.external_key IS 'Lookup key: page_name for klmedia, company_uid for syncmedia';
