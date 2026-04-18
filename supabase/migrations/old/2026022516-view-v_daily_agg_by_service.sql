-- =============================================================================
-- Migration: Create media.v_daily_agg_by_service view
-- Date: 2026-02-25
-- Depends on: 2026022509-table-daily
-- =============================================================================
--
-- Purpose:
--   서비스(광고 채널) 단위로 집계된 일별 KPI 뷰입니다.
--   특정 서비스의 날짜별 성과 추이를 분석하거나,
--   클라이언트 내 여러 서비스를 비교할 때 사용합니다.
--
-- Business context:
--   하나의 클라이언트가 복수의 서비스(채널)를 운영하는 경우,
--   채널별 성과를 비교하여 예산 배분이나 최적화 방향을 결정하는 데 사용합니다.
--   예: "네이버 디스플레이" vs "네이버 네이티브"의 성과 비교.
--
-- Aggregation level:
--   GROUP BY (date, service_id) — 날짜 × 서비스 단위 집계.
--   특정 서비스의 모든 widget 성과를 합산합니다.
--   (주의: service_id 만으로 집계하므로 여러 클라이언트의 동일 service_id 가
--    있을 경우 합산됩니다. 클라이언트별 필터링이 필요하면 v_daily 를 사용하세요.)
--
-- Aggregated columns:
--   total_cost_spent : 해당 서비스의 해당 날 광고 지출 합계
--   total_ad_revenue : 해당 서비스로부터 발생한 매체사 수익 합계
--   total_vimp       : 해당 서비스 광고의 조회 가능 노출수 합계
--   total_cnt_click  : 해당 서비스 광고의 클릭수 합계
--
-- Usage:
--   - Board 섹션: 서비스별 성과 비교
--   - DATA 섹션: 서비스 단위 드릴다운
--   SELECT * FROM media.v_daily_agg_by_service
--   WHERE service_id = $1 AND date BETWEEN $2 AND $3
--   ORDER BY date;
--
-- Related views:
--   v_daily_agg            — 전사 집계 (클라이언트/서비스 구분 없음)
--   v_daily_agg_by_client  — 클라이언트별 집계
--   v_daily                — 원본 행 단위 + 파생 지표 (클라이언트+서비스 분리 가능)
-- =============================================================================

CREATE OR REPLACE VIEW media.v_daily_agg_by_service AS
SELECT
  date,
  service_id,
  SUM(cost_spent)   AS total_cost_spent,    -- Sum of advertiser spend for this service on the day
  SUM(pub_profit)   AS total_ad_revenue,    -- Sum of publisher revenue from this service on the day
  SUM(vimp)         AS total_vimp,          -- Sum of viewable impressions for this service on the day
  SUM(cnt_click)    AS total_cnt_click      -- Sum of clicks for this service on the day
FROM media.daily
GROUP BY date, service_id;

COMMENT ON VIEW media.v_daily_agg_by_service IS
  '서비스(광고 채널)별 일별 KPI 집계 뷰. '
  '(date, service_id) 단위로 해당 서비스의 전체 위젯 성과를 합산합니다. '
  '서비스 단위 성과 비교 및 채널별 예산 최적화 분석에 사용됩니다. '
  '클라이언트+서비스 복합 필터가 필요하면 v_daily 를 사용하세요.';
