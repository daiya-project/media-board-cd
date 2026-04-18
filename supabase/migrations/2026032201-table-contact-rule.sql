-- =============================================================================
-- Migration: Create media.contact_rule table
-- Date: 2026-03-22
-- Depends on: 2026022501-schema-media
-- =============================================================================
--
-- Purpose:
--   티어별 컨택 주기 정책을 관리합니다. 매니저가 클라이언트에 정해진 주기 내에
--   컨택했는지를 MGMT 화면에서 추적하는 데 사용됩니다.
--
-- Business context:
--   각 클라이언트는 tier(상/중/하/기타)를 가지며, 티어마다 허용되는 최대 미컨택 일수와
--   컨택으로 인정되는 action stage가 다릅니다.
--   예: 상 티어 클라이언트는 90일 이내에 meeting stage 이상의 활동이 있어야 합니다.
--
-- Design:
--   - tier는 UNIQUE — 티어당 규칙 1개
--   - rule_day = 0 이면 컨택 주기 추적 비대상 (기타 티어)
--   - is_active = false 이면 해당 티어의 컨택 추적을 건너뜀
--   - required_stages는 TEXT[] — action.stage와 비교하여 충족 여부 판단
-- =============================================================================

CREATE TABLE media.contact_rule (
  id                SERIAL        PRIMARY KEY,
  tier              TEXT          NOT NULL UNIQUE
                                  CHECK (tier IN ('상', '중', '하', '기타')),
  rule_day          INTEGER       NOT NULL,                                    -- Max allowed days without qualifying contact
  required_stages   TEXT[]        NOT NULL DEFAULT '{}',                        -- Action stages that satisfy the contact requirement
  is_active         BOOLEAN       NOT NULL DEFAULT true,                       -- If false, tier excluded from tracking
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- Auto-update updated_at on every row modification
CREATE TRIGGER trg_contact_rule_updated_at
  BEFORE UPDATE ON media.contact_rule
  FOR EACH ROW EXECUTE FUNCTION media.set_updated_at();

-- Table-level comment
COMMENT ON TABLE media.contact_rule IS
  'Per-tier contact frequency rules for client management.';

-- Column-level comments
COMMENT ON COLUMN media.contact_rule.tier             IS 'Client tier: 상(high), 중(mid), 하(low), 기타(other). UNIQUE — one rule per tier.';
COMMENT ON COLUMN media.contact_rule.rule_day          IS 'Max allowed days without a qualifying contact; unit: days.';
COMMENT ON COLUMN media.contact_rule.required_stages   IS 'Action stages that satisfy the contact requirement (e.g., {meeting}, {contact,meeting}).';
COMMENT ON COLUMN media.contact_rule.is_active         IS 'If false, this tier is excluded from contact cycle tracking.';
