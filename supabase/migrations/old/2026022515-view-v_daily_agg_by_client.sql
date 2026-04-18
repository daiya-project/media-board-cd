-- =============================================================================
-- Migration: Create media.v_daily_agg_by_client view
-- Date: 2026-02-25
-- Depends on: 2026022509-table-daily
-- =============================================================================
--
-- Purpose:
--   클라이언트(광고주) 단위로 집계된 일별 KPI 뷰입니다.
--   특정 클라이언트의 날짜별 성과 추이를 분석하거나,
--   여러 클라이언트를 비교할 때 사용합니다.
--
-- Business context:
--   영업 담당자가 특정 광고주의 성과 트렌드를 모니터링할 때 사용합니다.
--   Board 섹션에서 클라이언트 필터를 선택하면 이 뷰를 쿼리합니다.
--   v_daily_agg(전사 집계)의 클라이언트 분해 버전입니다.
--
-- Aggregation level:
--   GROUP BY (date, client_id) — 날짜 × 클라이언트 단위 집계.
--   특정 클라이언트의 모든 service × widget 성과를 합산합니다.
--
-- Aggregated columns:
--   total_cost_spent : 해당 클라이언트의 해당 날 광고 지출 합계
--   total_ad_revenue : 해당 클라이언트로부터 발생한 매체사 수익 합계
--   total_vimp       : 해당 클라이언트 광고의 조회 가능 노출수 합계
--   total_cnt_click  : 해당 클라이언트 광고의 클릭수 합계
--
-- Usage:
--   - Board 섹션: 클라이언트 필터 적용 시 KPI 카드 및 트렌드 차트
--   - 클라이언트별 성과 비교 분석
--   SELECT * FROM media.v_daily_agg_by_client
--   WHERE client_id = $1 AND date BETWEEN $2 AND $3
--   ORDER BY date;
--
-- Related views:
--   v_daily_agg            — 전사 집계 (클라이언트 구분 없음)
--   v_daily_agg_by_service — 서비스별 집계
--   v_daily                — 원본 행 단위 + 파생 지표
-- =============================================================================

CREATE OR REPLACE VIEW media.v_daily_agg_by_client AS
SELECT
  date,
  client_id,
  SUM(cost_spent)   AS total_cost_spent,    -- Sum of advertiser spend for this client on the day
  SUM(pub_profit)   AS total_ad_revenue,    -- Sum of publisher revenue from this client on the day
  SUM(vimp)         AS total_vimp,          -- Sum of viewable impressions for this client on the day
  SUM(cnt_click)    AS total_cnt_click      -- Sum of clicks for this client on the day
FROM media.daily
GROUP BY date, client_id;

COMMENT ON VIEW media.v_daily_agg_by_client IS
  '클라이언트(광고주)별 일별 KPI 집계 뷰. '
  '(date, client_id) 단위로 해당 클라이언트의 전체 서비스/위젯 성과를 합산합니다. '
  'Board 섹션에서 클라이언트 필터 적용 시의 KPI 카드 및 트렌드 차트 데이터 소스입니다. '
  '전사 집계는 v_daily_agg, 서비스별 집계는 v_daily_agg_by_service 를 사용합니다.';
