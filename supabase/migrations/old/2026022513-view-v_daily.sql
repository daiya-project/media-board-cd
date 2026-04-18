-- =============================================================================
-- Migration: Create media.v_daily view
-- Date: 2026-02-25
-- Depends on: 2026022509-table-daily, 2026022504-table-client, 2026022505-table-service
-- =============================================================================
--
-- Purpose:
--   일별 성과 원본 데이터(daily)에 클라이언트/서비스 메타데이터를 JOIN하고,
--   파생 지표(mfr_rate, ctr_rate, vctr_rate, vrate)를 즉시 계산하여 제공하는
--   메인 분석 뷰입니다.
--
-- Design rationale:
--   daily 는 원본 수치만 저장하며, 비율/지표 계산은 이 뷰에서 수행합니다.
--   애플리케이션 레이어에서 계산하지 않고 DB 레벨에서 처리하므로
--   일관된 계산 로직을 보장하고 쿼리가 단순해집니다.
--   분모가 0인 경우 0을 반환하여 Division by Zero 오류를 방지합니다.
--
-- Calculated metrics:
--   mfr_rate  = pub_profit / cost_spent × 100   → 광고 매출 충족률 (%)
--               분모(cost_spent) = 0 이면 0 반환
--               소수점 2자리 반올림
--
--   ctr_rate  = cnt_click / imp × 100            → 클릭률 (%)
--               분모(imp) = 0 이면 0 반환
--               소수점 4자리 반올림 (소수점이 많으므로 정밀도 유지)
--
--   vctr_rate = cnt_click / vimp × 100           → 조회 가능 클릭률 (%)
--               분모(vimp) = 0 이면 0 반환
--               소수점 4자리 반올림
--
--   vrate     = vimp / imp × 100                 → 조회 가능성 비율 (%)
--               분모(imp) = 0 이면 0 반환
--               소수점 2자리 반올림
--
-- Usage:
--   - DATA 섹션(data-board): 일별 성과 테이블의 주 데이터 소스
--   - MGMT 섹션: 클라이언트별 성과 요약 조회 시
--   - 필터링: WHERE client_id = $1 AND date BETWEEN $2 AND $3
--
-- Joins:
--   INNER JOIN media.client  → daily 에 client_id 가 반드시 있으므로 INNER JOIN 적합
--   INNER JOIN media.service → daily 에 service_id 가 반드시 있으므로 INNER JOIN 적합
--   (daily 의 FK 제약이 INNER JOIN 의 정합성을 보장합니다)
-- =============================================================================

CREATE OR REPLACE VIEW media.v_daily AS
SELECT
  d.date,
  d.client_id,
  d.service_id,
  d.widget_id,
  d.widget_name,
  d.cost_spent,
  d.pub_profit                                        AS ad_revenue,       -- Alias: pub_profit → ad_revenue for clarity
  d.imp,
  d.vimp,
  d.cnt_click,
  d.cnt_cv,
  -- Calculated metrics (분모 = 0 이면 0 반환하여 Division by Zero 방지)
  CASE WHEN d.cost_spent > 0
    THEN ROUND((d.pub_profit / d.cost_spent * 100)::NUMERIC, 2)
    ELSE 0
  END                                                 AS mfr_rate,        -- Media Fill Rate (%): pub_profit / cost_spent × 100
  CASE WHEN d.imp > 0
    THEN ROUND((d.cnt_click::NUMERIC / d.imp * 100), 4)
    ELSE 0
  END                                                 AS ctr_rate,        -- Click Through Rate (%): cnt_click / imp × 100
  CASE WHEN d.vimp > 0
    THEN ROUND((d.cnt_click::NUMERIC / d.vimp * 100), 4)
    ELSE 0
  END                                                 AS vctr_rate,       -- Viewable CTR (%): cnt_click / vimp × 100
  CASE WHEN d.imp > 0
    THEN ROUND((d.vimp::NUMERIC / d.imp * 100), 2)
    ELSE 0
  END                                                 AS vrate,           -- Viewability Rate (%): vimp / imp × 100
  -- Client metadata (from media.client)
  m.client_name,
  m.tier,
  m.manager_id,
  m.manager_id_second,
  -- Service metadata (from media.service)
  s.service_name,
  s.service_type,
  d.created_at,
  d.updated_at
FROM media.daily d
JOIN media.client  m ON d.client_id  = m.client_id
JOIN media.service s ON d.service_id = s.service_id;

COMMENT ON VIEW media.v_daily IS
  '일별 성과 분석 메인 뷰. '
  'media.daily 에 client/service 메타데이터를 JOIN하고 파생 지표를 계산합니다. '
  '계산 지표: mfr_rate(매출 충족률), ctr_rate(클릭률), vctr_rate(조회가능 클릭률), vrate(조회가능성 비율). '
  '분모가 0인 경우 모두 0을 반환합니다. DATA 섹션(data-board)의 주 데이터 소스입니다.';
