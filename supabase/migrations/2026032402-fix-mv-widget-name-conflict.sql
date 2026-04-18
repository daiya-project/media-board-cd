-- =============================================================================
-- Migration: Fix v_weekly / v_monthly MV duplicate key on widget_name change
-- Date: 2026-03-24
-- Depends on: 2026030702-materialized-views-weekly-monthly
-- =============================================================================
--
-- Problem:
--   widget_name is included in GROUP BY but NOT in the unique index.
--   When the same widget_id has different widget_name values across dates
--   within the same period (week/month), GROUP BY produces multiple rows
--   that share the same unique-index key → REFRESH CONCURRENTLY fails with
--   "duplicate key value violates unique constraint".
--
-- Fix:
--   Remove widget_name from GROUP BY and use MAX(widget_name) instead.
--   This keeps the latest name while ensuring one row per unique-index key.
--   Same treatment for client_name and service_name for consistency.
--
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1. v_weekly — Remove name columns from GROUP BY, use MAX() instead
-- ---------------------------------------------------------------------------

-- Must drop dependent views first
DROP VIEW IF EXISTS media.v_weekly_periods CASCADE;
DROP MATERIALIZED VIEW IF EXISTS media.v_weekly CASCADE;

CREATE MATERIALIZED VIEW media.v_weekly AS
SELECT
  w.year,
  w.week_number,
  w.date_start,
  w.date_end,
  w.display_label,
  d.client_id,
  MAX(c.client_name)  AS client_name,
  d.service_id,
  MAX(s.service_name) AS service_name,
  d.widget_id,
  MAX(d.widget_name)  AS widget_name,   -- MAX instead of GROUP BY to avoid PK conflict
  SUM(d.cost_spent)   AS cost_spent,
  SUM(d.pub_profit)   AS ad_revenue,
  SUM(d.imp)          AS imp,
  SUM(d.vimp)         AS vimp,
  SUM(d.cnt_click)    AS cnt_click
FROM media.daily d
JOIN media.client  c ON d.client_id  = c.client_id
JOIN media.service s ON d.service_id = s.service_id
JOIN media.ref_week w ON d.date BETWEEN w.date_start AND w.date_end
GROUP BY
  w.year, w.week_number, w.date_start, w.date_end, w.display_label,
  d.client_id,
  d.service_id,
  d.widget_id;

CREATE UNIQUE INDEX idx_v_weekly_pk
  ON media.v_weekly (year, week_number, client_id, service_id, widget_id);

CREATE INDEX idx_v_weekly_period
  ON media.v_weekly (year DESC, week_number DESC);

COMMENT ON MATERIALIZED VIEW media.v_weekly IS
  '주간 widget-level 집계 Materialized View. '
  'ref_week JOIN으로 날짜→주차 매핑 후 (year, week_number, client_id, service_id, widget_id) 기준 합산. '
  'name 컬럼은 MAX()로 추출하여 PK 충돌 방지. '
  'CSV 임포트 완료 후 refresh_daily_views() RPC로 갱신.';


-- ---------------------------------------------------------------------------
-- 2. v_monthly — Remove name columns from GROUP BY, use MAX() instead
-- ---------------------------------------------------------------------------

DROP VIEW IF EXISTS media.v_monthly_periods CASCADE;
DROP MATERIALIZED VIEW IF EXISTS media.v_monthly CASCADE;

CREATE MATERIALIZED VIEW media.v_monthly AS
SELECT
  TO_CHAR(d.date, 'YYYY-MM') AS year_month,
  d.client_id,
  MAX(c.client_name)  AS client_name,
  d.service_id,
  MAX(s.service_name) AS service_name,
  d.widget_id,
  MAX(d.widget_name)  AS widget_name,   -- MAX instead of GROUP BY to avoid PK conflict
  SUM(d.cost_spent)   AS cost_spent,
  SUM(d.pub_profit)   AS ad_revenue,
  SUM(d.imp)          AS imp,
  SUM(d.vimp)         AS vimp,
  SUM(d.cnt_click)    AS cnt_click
FROM media.daily d
JOIN media.client  c ON d.client_id  = c.client_id
JOIN media.service s ON d.service_id = s.service_id
GROUP BY
  TO_CHAR(d.date, 'YYYY-MM'),
  d.client_id,
  d.service_id,
  d.widget_id;

CREATE UNIQUE INDEX idx_v_monthly_pk
  ON media.v_monthly (year_month, client_id, service_id, widget_id);

CREATE INDEX idx_v_monthly_period
  ON media.v_monthly (year_month DESC);

COMMENT ON MATERIALIZED VIEW media.v_monthly IS
  '월간 widget-level 집계 Materialized View. '
  'TO_CHAR(date, ''YYYY-MM'') 기준 (year_month, client_id, service_id, widget_id) 합산. '
  'name 컬럼은 MAX()로 추출하여 PK 충돌 방지. '
  'CSV 임포트 완료 후 refresh_daily_views() RPC로 갱신.';


-- ---------------------------------------------------------------------------
-- 3. Recreate dependent period-lookup views (dropped by CASCADE)
-- ---------------------------------------------------------------------------

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
