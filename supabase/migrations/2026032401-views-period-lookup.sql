-- Lightweight DISTINCT views for period discovery.
-- Avoids full-table scans of v_weekly (102k+ rows) and v_monthly (26k+ rows)
-- when the app only needs the list of available periods.

CREATE OR REPLACE VIEW media.v_weekly_periods AS
SELECT DISTINCT year, week_number, display_label
FROM media.v_weekly
ORDER BY year DESC, week_number DESC;

COMMENT ON VIEW media.v_weekly_periods
  IS 'Distinct (year, week_number, display_label) from v_weekly MV — avoids full-table scan for period discovery.';

CREATE OR REPLACE VIEW media.v_monthly_periods AS
SELECT DISTINCT year_month
FROM media.v_monthly
ORDER BY year_month DESC;

COMMENT ON VIEW media.v_monthly_periods
  IS 'Distinct year_month values from v_monthly MV — avoids full-table scan for period discovery.';
