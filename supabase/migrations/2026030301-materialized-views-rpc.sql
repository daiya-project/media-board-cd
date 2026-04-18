-- =============================================================================
-- Migration: Materialized View 전환 + RPC 함수
-- Date: 2026-03-03 (updated 2026-03-07)
-- Depends on: 2026030201-views-daily (v_daily_total, v_daily_by_service 일반 뷰)
--             2026030702-materialized-views-weekly-monthly (v_weekly, v_monthly)
-- =============================================================================
--
-- 목적:
--   GROUP BY 집계를 매 쿼리마다 재실행하는 일반 뷰(VIEW)를
--   사전 계산된 Materialized View로 전환합니다.
--
--   Materialized View 이점:
--     - 쿼리마다 GROUP BY + JOIN 재계산 없이 사전 집계 결과 직접 조회
--     - 인덱스 지원으로 날짜 조건 조회가 단순 인덱스 스캔으로 처리됨
--     - 90개 병렬 .eq("date", date) 쿼리 각각의 응답 시간 대폭 단축
--
--   RPC 함수:
--     - refresh_daily_views(): CSV 임포트 완료 후 모든 Materialized View 갱신
--       v_daily_total, v_daily_by_service, v_weekly, v_monthly 포함
--       SECURITY DEFINER로 선언하여 앱 사용자가 REFRESH를 실행할 수 있도록 함
--
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1. v_daily_total — Materialized View로 전환
-- ---------------------------------------------------------------------------

-- 기존 일반 뷰 삭제 (CASCADE: 의존 객체 포함)
DROP VIEW IF EXISTS media.v_daily_total CASCADE;
DROP MATERIALIZED VIEW IF EXISTS media.v_daily_total CASCADE;

CREATE MATERIALIZED VIEW media.v_daily_total AS
SELECT
  date,
  SUM(cost_spent)   AS cost_spent,
  SUM(pub_profit)   AS ad_revenue,
  SUM(imp)          AS imp,
  SUM(vimp)         AS vimp,
  SUM(cnt_click)    AS cnt_click
FROM media.daily
GROUP BY date;

-- date 기준 고유 인덱스: REFRESH CONCURRENTLY 및 단일 날짜 조회 최적화
CREATE UNIQUE INDEX ON media.v_daily_total (date);

COMMENT ON MATERIALIZED VIEW media.v_daily_total IS
  '전사 일별 집계 Materialized View. '
  '날짜당 1행 — 약 90행. GROUP BY 사전 계산으로 매 쿼리 재집계 불필요. '
  'CSV 임포트 완료 후 refresh_daily_views() RPC로 갱신. '
  'Board 섹션 KPI 카드 및 전체 차트(클라이언트 필터 미적용 시) 데이터 소스.';


-- ---------------------------------------------------------------------------
-- 2. v_daily_by_service — Materialized View로 전환
-- ---------------------------------------------------------------------------

DROP VIEW IF EXISTS media.v_daily_by_service CASCADE;
DROP MATERIALIZED VIEW IF EXISTS media.v_daily_by_service CASCADE;

CREATE MATERIALIZED VIEW media.v_daily_by_service AS
SELECT
  d.date,
  d.client_id,
  c.client_name,
  d.service_id,
  s.service_name,
  SUM(d.cost_spent)   AS cost_spent,
  SUM(d.pub_profit)   AS ad_revenue,
  SUM(d.imp)          AS imp,
  SUM(d.vimp)         AS vimp,
  SUM(d.cnt_click)    AS cnt_click
FROM media.daily d
JOIN media.client  c ON d.client_id  = c.client_id
JOIN media.service s ON d.service_id = s.service_id
GROUP BY d.date, d.client_id, c.client_name, d.service_id, s.service_name;

-- CONCURRENTLY refresh를 위한 고유 인덱스 (필수)
CREATE UNIQUE INDEX ON media.v_daily_by_service (date, client_id, service_id);

-- 날짜 단독 조회 최적화 (90개 병렬 .eq("date", date) 쿼리용)
CREATE INDEX ON media.v_daily_by_service (date);

COMMENT ON MATERIALIZED VIEW media.v_daily_by_service IS
  '서비스별 일별 집계 Materialized View. '
  '(date, client_id, service_id)당 1행. GROUP BY 사전 계산. '
  'date 인덱스로 날짜별 병렬 조회 최적화. '
  'CSV 임포트 완료 후 refresh_daily_views() RPC로 갱신. '
  'Board 섹션 트렌드 리스트, 서비스 차트, 필터 KPI 데이터 소스.';


-- ---------------------------------------------------------------------------
-- 3. refresh_daily_views() — Materialized View 갱신 RPC 함수
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER: 함수 소유자 권한으로 실행되어 앱 사용자도 REFRESH 가능
-- CONCURRENTLY: 갱신 중에도 뷰를 읽기 가능 (다운타임 없음, 고유 인덱스 필요)
-- 호출 시점: CSV 임포트 완료 직후 (lib/logic/importOrchestration.ts)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION media.refresh_daily_views()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout = '120s'
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY media.v_daily_total;
  REFRESH MATERIALIZED VIEW CONCURRENTLY media.v_daily_by_service;
  REFRESH MATERIALIZED VIEW CONCURRENTLY media.v_weekly;
  REFRESH MATERIALIZED VIEW CONCURRENTLY media.v_monthly;
END;
$$;

-- 앱 사용자(authenticated, anon)가 호출 가능하도록 실행 권한 부여
GRANT EXECUTE ON FUNCTION media.refresh_daily_views() TO authenticated;
GRANT EXECUTE ON FUNCTION media.refresh_daily_views() TO anon;

COMMENT ON FUNCTION media.refresh_daily_views() IS
  '임포트 완료 후 모든 Materialized View를 갱신합니다. '
  'v_daily_total, v_daily_by_service, v_weekly, v_monthly를 '
  'CONCURRENTLY 방식으로 순차 갱신합니다 (읽기 잠금 없음). '
  'SECURITY DEFINER로 선언되어 앱 사용자 권한으로도 실행 가능합니다.';
