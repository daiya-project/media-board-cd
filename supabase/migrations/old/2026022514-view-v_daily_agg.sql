-- =============================================================================
-- Migration: Create media.v_daily_agg view
-- Date: 2026-02-25
-- Depends on: 2026022509-table-daily
-- =============================================================================
--
-- Purpose:
--   모든 클라이언트/서비스/위젯을 합산한 전사 수준의 일별 KPI 집계 뷰입니다.
--   날짜별 전체 광고 성과 트렌드를 파악하는 데 사용됩니다.
--
-- Business context:
--   Board(Dashboard) 섹션의 KPI 카드(전체 ad_revenue, vimp 등)와
--   시계열 차트(일별 추이)의 주 데이터 소스입니다.
--   클라이언트나 서비스로 필터링하지 않은 전사 현황을 표시할 때 사용합니다.
--
-- Aggregation level:
--   GROUP BY date — 날짜 단위로 집계. 특정 날짜의 모든 client × service × widget 합산.
--
-- Aggregated columns:
--   total_cost_spent : 전체 광고주 지출 합계
--   total_ad_revenue : 전체 매체사 수익 합계 (pub_profit 의 합)
--   total_vimp       : 전체 조회 가능 노출수 합계
--   total_cnt_click  : 전체 클릭수 합계
--
-- Usage:
--   - Board 섹션: KPI 카드(전체 수치), 전사 트렌드 차트
--   - 클라이언트/서비스 필터 없는 전체 현황 보고
--
-- Related views (더 세분화된 집계):
--   v_daily_agg_by_client  — 클라이언트별 집계
--   v_daily_agg_by_service — 서비스별 집계
--   v_daily                — 원본 행 단위 + 파생 지표
-- =============================================================================

CREATE OR REPLACE VIEW media.v_daily_agg AS
SELECT
  date,
  SUM(cost_spent)   AS total_cost_spent,    -- Sum of all advertiser spend for the day
  SUM(pub_profit)   AS total_ad_revenue,    -- Sum of all publisher revenue for the day
  SUM(vimp)         AS total_vimp,          -- Sum of all viewable impressions for the day
  SUM(cnt_click)    AS total_cnt_click      -- Sum of all clicks for the day
FROM media.daily
GROUP BY date;

COMMENT ON VIEW media.v_daily_agg IS
  '전사 일별 KPI 집계 뷰 (클라이언트/서비스 구분 없음). '
  '날짜별로 전체 cost_spent, ad_revenue(pub_profit), vimp, cnt_click 을 합산합니다. '
  'Board(Dashboard) 섹션의 KPI 카드와 전사 트렌드 차트의 주 데이터 소스입니다. '
  '클라이언트별 분석은 v_daily_agg_by_client, 서비스별 분석은 v_daily_agg_by_service 를 사용합니다.';
