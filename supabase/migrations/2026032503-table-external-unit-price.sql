-- =============================================================================
-- Migration: External Value Table
-- Date: 2026-03-25
-- Purpose: Store per-widget CPM values (KRW integer) with auto end_date
-- =============================================================================

CREATE TABLE media.external_value (
  id SERIAL PRIMARY KEY,
  widget_id TEXT NOT NULL,                        -- Internal widget_id
  value JSONB NOT NULL DEFAULT '{}',              -- { "internal": 50, "syncmedia": 30, "klmedia": 40 } CPM in KRW
  start_date DATE NOT NULL,
  end_date DATE,                                  -- NULL = currently active; auto-set by trigger
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(widget_id, start_date)
);

CREATE INDEX idx_external_unit_price_widget ON media.external_value (widget_id);
CREATE INDEX idx_external_unit_price_dates ON media.external_value (widget_id, start_date, end_date);

COMMENT ON TABLE media.external_value IS 'Per-widget CPM values. Managed via direct DB inserts. end_date auto-set by trigger when new value is inserted for same widget.';
COMMENT ON COLUMN media.external_value.value IS 'JSONB with CPM values per source: { "internal": N, "syncmedia": N, "klmedia": N }. Unit: KRW integer.';
COMMENT ON COLUMN media.external_value.start_date IS 'Value effective start date (inclusive).';
COMMENT ON COLUMN media.external_value.end_date IS 'Value effective end date (inclusive). NULL means currently active.';

-- Trigger: auto-close previous value period when new one is inserted
CREATE OR REPLACE FUNCTION media.trg_close_previous_external_value()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE media.external_value
  SET end_date = NEW.start_date - INTERVAL '1 day'
  WHERE widget_id = NEW.widget_id
    AND end_date IS NULL
    AND start_date < NEW.start_date
    AND id != NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_external_value_close
  AFTER INSERT ON media.external_value
  FOR EACH ROW
  EXECUTE FUNCTION media.trg_close_previous_external_value();
