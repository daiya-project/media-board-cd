-- =============================================================================
-- Migration: Create media schema and shared trigger function
-- Date: 2026-02-25
-- =============================================================================
--
-- Purpose:
--   이 마이그레이션은 모든 광고 성과 관리 테이블을 담을 'media' 스키마를 생성하고,
--   각 테이블의 updated_at 컬럼을 자동으로 갱신하는 공용 트리거 함수를 정의합니다.
--
-- Design rationale:
--   - public 스키마와 분리하여 광고 도메인 객체를 네임스페이스로 격리합니다.
--   - set_updated_at() 함수는 이 스키마의 모든 테이블(client, service, widget,
--     daily, action, cvr 등)에서 공통으로 사용하는 BEFORE UPDATE 트리거입니다.
--   - 이 파일은 반드시 다른 모든 migration보다 먼저 실행되어야 합니다.
--
-- Dependency graph (이 파일이 제공하는 것):
--   schema: media           ← 모든 테이블/뷰/함수의 네임스페이스
--   function: media.set_updated_at()  ← 모든 trg_*_updated_at 트리거가 참조
-- =============================================================================

-- Create schema
CREATE SCHEMA IF NOT EXISTS media;
COMMENT ON SCHEMA media IS '미디어 광고 성과 관리 스키마 — client/service/widget/daily 등 도메인 객체 전체 포함';

-- -----------------------------------------------------------------------------
-- set_updated_at()
--
-- 역할: BEFORE UPDATE 트리거에서 호출되어 NEW.updated_at 을 현재 시각으로 덮어씁니다.
-- 사용처:
--   trg_client_updated_at      (media.client)
--   trg_service_updated_at     (media.service)
--   trg_widget_updated_at      (media.widget)
--   trg_widget_contract_updated_at (media.widget_contract)
--   trg_daily_updated_at       (media.daily)
--   trg_action_updated_at      (media.action)
--   trg_cvr_updated_at         (media.cvr)
--
-- 주의: 애플리케이션에서 updated_at 을 직접 SET 하더라도 트리거가 덮어씁니다.
--       updated_at 값을 수동으로 조작하려면 트리거를 일시 비활성화해야 합니다.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION media.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION media.set_updated_at IS
  'Generic BEFORE UPDATE trigger function. Sets updated_at = now() automatically. '
  'Attached to every table in the media schema that has an updated_at column.';
