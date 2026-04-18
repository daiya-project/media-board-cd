-- =============================================================================
-- Migration: Add ON UPDATE CASCADE to client_id FKs + rename RPC
-- Date: 2026-03-10
-- Depends on: all table migrations (client, service, widget, widget_contract, daily, action)
-- =============================================================================
--
-- Purpose:
--   client_id 를 변경(rename)할 수 있도록 모든 FK 에 ON UPDATE CASCADE 를 추가하고,
--   안전한 rename 을 수행하는 RPC 함수를 생성합니다.
--
-- Why ON UPDATE CASCADE:
--   client_id 는 TEXT PK 로, service / widget / widget_contract / daily / action 에서
--   FK 로 참조합니다. 기존 FK 는 ON UPDATE RESTRICT(기본값)이므로 PK 변경 시 에러가
--   발생했습니다. ON UPDATE CASCADE 를 추가하면 PK 변경 시 모든 자식 테이블의
--   client_id 가 자동으로 함께 변경됩니다.
--
-- RPC function rename_client_id(old_id, new_id):
--   1. new_id 중복 체크
--   2. media.client.client_id UPDATE → CASCADE 로 자식 테이블 자동 전파
--   3. Materialized View refresh (daily 데이터가 변경되므로)
--   SECURITY DEFINER 로 선언하여 앱 사용자가 실행 가능.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1. FK 제약 조건을 ON UPDATE CASCADE 로 변경
-- ---------------------------------------------------------------------------

-- media.service.client_id
ALTER TABLE media.service
  DROP CONSTRAINT IF EXISTS service_client_id_fkey;
ALTER TABLE media.service
  ADD CONSTRAINT service_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES media.client(client_id)
  ON DELETE CASCADE ON UPDATE CASCADE;

-- media.widget.client_id
ALTER TABLE media.widget
  DROP CONSTRAINT IF EXISTS widget_client_id_fkey;
ALTER TABLE media.widget
  ADD CONSTRAINT widget_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES media.client(client_id)
  ON DELETE CASCADE ON UPDATE CASCADE;

-- media.widget_contract.client_id
ALTER TABLE media.widget_contract
  DROP CONSTRAINT IF EXISTS widget_contract_client_id_fkey;
ALTER TABLE media.widget_contract
  ADD CONSTRAINT widget_contract_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES media.client(client_id)
  ON DELETE CASCADE ON UPDATE CASCADE;

-- media.daily.client_id
ALTER TABLE media.daily
  DROP CONSTRAINT IF EXISTS daily_client_id_fkey;
ALTER TABLE media.daily
  ADD CONSTRAINT daily_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES media.client(client_id)
  ON UPDATE CASCADE;

-- media.action.client_id
ALTER TABLE media.action
  DROP CONSTRAINT IF EXISTS action_client_id_fkey;
ALTER TABLE media.action
  ADD CONSTRAINT action_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES media.client(client_id)
  ON DELETE CASCADE ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- 2. RPC function: rename_client_id
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION media.rename_client_id(
  p_old_id TEXT,
  p_new_id TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = media, public
AS $$
BEGIN
  -- Validate inputs
  IF p_old_id IS NULL OR p_new_id IS NULL THEN
    RAISE EXCEPTION 'old_id and new_id must not be null';
  END IF;

  IF p_old_id = p_new_id THEN
    RAISE EXCEPTION 'old_id and new_id are the same';
  END IF;

  -- Check new_id doesn't already exist
  IF EXISTS (SELECT 1 FROM media.client WHERE client_id = p_new_id) THEN
    RAISE EXCEPTION 'Client ID "%" already exists', p_new_id;
  END IF;

  -- Check old_id exists
  IF NOT EXISTS (SELECT 1 FROM media.client WHERE client_id = p_old_id) THEN
    RAISE EXCEPTION 'Client ID "%" not found', p_old_id;
  END IF;

  -- Update PK — ON UPDATE CASCADE propagates to all child tables
  UPDATE media.client
  SET client_id = p_new_id
  WHERE client_id = p_old_id;

  -- Refresh materialized views (daily data client_id changed)
  REFRESH MATERIALIZED VIEW CONCURRENTLY media.v_daily_total;
  REFRESH MATERIALIZED VIEW CONCURRENTLY media.v_daily_by_service;

  -- Refresh weekly/monthly if they exist
  IF EXISTS (
    SELECT 1 FROM pg_matviews WHERE schemaname = 'media' AND matviewname = 'v_weekly'
  ) THEN
    REFRESH MATERIALIZED VIEW CONCURRENTLY media.v_weekly;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_matviews WHERE schemaname = 'media' AND matviewname = 'v_monthly'
  ) THEN
    REFRESH MATERIALIZED VIEW CONCURRENTLY media.v_monthly;
  END IF;
END;
$$;

COMMENT ON FUNCTION media.rename_client_id(TEXT, TEXT) IS
  'client_id 를 안전하게 변경합니다. '
  'ON UPDATE CASCADE 로 service / widget / widget_contract / daily / action 의 client_id 가 자동 전파됩니다. '
  'Materialized View 도 갱신합니다.';
