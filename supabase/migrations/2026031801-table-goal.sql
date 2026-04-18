-- ---------------------------------------------------------------------------
-- media.goal — Monthly vIMP goal tracking per team / manager.
--
-- manager_id IS NULL  → team-level goal
-- manager_id IS NOT NULL → individual manager goal
-- ---------------------------------------------------------------------------

CREATE TABLE media.goal (
  id              SERIAL PRIMARY KEY,
  manager_id      INTEGER,                              -- NULL = team goal
  goal_type       VARCHAR(20) NOT NULL DEFAULT 'monthly',
  date_start      DATE NOT NULL,                        -- first day of month (YYYY-MM-01)
  date_end        DATE NOT NULL,                        -- last day of month
  vimp_target     BIGINT NOT NULL DEFAULT 0,            -- target vIMP for the period
  memo            TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- Lookup by manager
CREATE INDEX idx_goal_manager ON media.goal (manager_id);

-- Date range queries
CREATE INDEX idx_goal_dates ON media.goal (date_start, date_end);

-- Filter by goal type
CREATE INDEX idx_goal_type ON media.goal (goal_type);

-- Auto-update updated_at on row modification
CREATE TRIGGER trg_goal_updated_at
  BEFORE UPDATE ON media.goal
  FOR EACH ROW EXECUTE FUNCTION media.set_updated_at();

COMMENT ON TABLE media.goal IS
  'Monthly vIMP goals for the media team and individual managers.';
COMMENT ON COLUMN media.goal.manager_id IS
  'NULL = team-level goal; NOT NULL = individual manager goal (FK to ref_manager.id).';
COMMENT ON COLUMN media.goal.vimp_target IS
  'Target viewable impressions for the month; unit: count.';
COMMENT ON COLUMN media.goal.date_start IS
  'First day of the goal month (always YYYY-MM-01).';
COMMENT ON COLUMN media.goal.date_end IS
  'Last day of the goal month (e.g. YYYY-MM-28/29/30/31).';
