-- =============================================================================
-- Migration: v_weekly / v_monthly Materialized View 생성
-- Date: 2026-03-07
-- Depends on: 2026030301-materialized-views-rpc (v_daily_total, v_daily_by_service MV + refresh 함수)
--             2026022502-view-ref-shared (ref_week 뷰)
-- Note: refresh_daily_views() 확장은 2026030301에서 관리 (이 파일에 포함하지 않음)
-- =============================================================================
--
-- 배경:
--   DATA 섹션이 일/주/월 페이지로 분리됩니다.
--   현재 주간/월간 집계는 widget-level daily 원본(~18k행)을 클라이언트로 전송한 뒤
--   JavaScript에서 재집계하고 있어 과도한 전송량과 연산 부하가 발생합니다.
--
--   v_weekly, v_monthly MV를 추가하여 DB 레벨에서 사전 집계합니다.
--
-- 기존 MV와의 차이:
--
--   ┌─────────────────────┬────────────┬──────────────┬──────────────────────┬──────────────┐
--   │ MV                  │ 집계 단위  │ 최소 그루핑  │ 용도                 │ 예상 행 수   │
--   ├─────────────────────┼────────────┼──────────────┼──────────────────────┼──────────────┤
--   │ v_daily_total       │ 일별       │ (date)       │ Board KPI 카드       │ ~248행       │
--   │                     │            │ 전사 합산    │ 전사 합계 차트       │ (날짜 수)    │
--   ├─────────────────────┼────────────┼──────────────┼──────────────────────┼──────────────┤
--   │ v_daily_by_service  │ 일별       │ (date,       │ Board 트렌드/차트    │ ~148k행      │
--   │                     │            │  client_id,  │ DATA Daily Phase 2   │ (248일×598)  │
--   │                     │            │  service_id) │ (S/C 모드 즉시 렌더) │              │
--   ├─────────────────────┼────────────┼──────────────┼──────────────────────┼──────────────┤
--   │ v_weekly (NEW)      │ 주간       │ (year,       │ DATA Weekly 페이지   │ ~52.5k행     │
--   │                     │            │  week_number,│ C/S/W 모드 전체      │ (35주×1500)  │
--   │                     │            │  client_id,  │ 주간 집계 사전 계산  │              │
--   │                     │            │  service_id, │ ref_week JOIN 포함   │              │
--   │                     │            │  widget_id)  │                      │              │
--   ├─────────────────────┼────────────┼──────────────┼──────────────────────┼──────────────┤
--   │ v_monthly (NEW)     │ 월간       │ (year_month, │ DATA Monthly 페이지  │ ~13.5k행     │
--   │                     │            │  client_id,  │ C/S/W 모드 전체      │ (9월×1500)   │
--   │                     │            │  service_id, │ 월간 집계 사전 계산  │              │
--   │                     │            │  widget_id)  │                      │              │
--   └─────────────────────┴────────────┴──────────────┴──────────────────────┴──────────────┘
--
--   핵심 차이점:
--
--   1. 집계 수준:
--      - v_daily_total: date 기준 전사 합산 (widget 정보 없음)
--      - v_daily_by_service: date + service 기준 (widget 정보 없음)
--      - v_weekly / v_monthly: widget 기준 (가장 세분화) → 클라이언트에서 C/S/W 모드 전환 가능
--
--   2. 시간 축:
--      - v_daily_*: 날짜(date) 기준 — daily 원본 그대로
--      - v_weekly: ref_week JOIN으로 주간 범위(date_start~date_end) 기준 합산
--      - v_monthly: TO_CHAR(date, 'YYYY-MM') 기준 합산
--
--   3. 데이터 절감 효과 (대비: daily widget 원본):
--      - v_weekly 35주: ~52.5k행 vs daily 원본 ~370k행 (86% 절감)
--      - v_monthly 9개월: ~13.5k행 vs daily 원본 ~370k행 (96% 절감)
--
--   4. client-side 연산 제거:
--      - 기존: groupRawDataByPeriods()가 daily 원본을 주/월 라벨로 재집계
--      - 변경: DB에서 이미 집계 완료 → groupRawData()만으로 C/S/W 전환
--
-- 데이터 범위:
--   daily 테이블: 2025-07-01 ~ 현재 (248 distinct dates)
--   ref_week: 2025-01-06 ~ 2027-01-03
--   v_weekly: ~35주 (2025-07-01이 속한 주부터)
--   v_monthly: ~9개월 (2025-07 ~ 현재)
--
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1. v_weekly — 주간 widget-level 집계 Materialized View
-- ---------------------------------------------------------------------------
-- ref_week JOIN으로 날짜 → 주차 매핑.
-- (year, week_number, client_id, service_id, widget_id) 기준 합산.
-- display_label, date_start, date_end 포함하여 클라이언트에서 추가 JOIN 불필요.
-- ---------------------------------------------------------------------------

DROP MATERIALIZED VIEW IF EXISTS media.v_weekly CASCADE;

CREATE MATERIALIZED VIEW media.v_weekly AS
SELECT
  w.year,
  w.week_number,
  w.date_start,
  w.date_end,
  w.display_label,
  d.client_id,
  c.client_name,
  d.service_id,
  s.service_name,
  d.widget_id,
  d.widget_name,
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
  d.client_id, c.client_name,
  d.service_id, s.service_name,
  d.widget_id, d.widget_name;

-- REFRESH CONCURRENTLY 필수 고유 인덱스
CREATE UNIQUE INDEX idx_v_weekly_pk
  ON media.v_weekly (year, week_number, client_id, service_id, widget_id);

-- 주차 범위 조회 최적화 (최근 N주 조회)
CREATE INDEX idx_v_weekly_period
  ON media.v_weekly (year DESC, week_number DESC);

COMMENT ON MATERIALIZED VIEW media.v_weekly IS
  '주간 widget-level 집계 Materialized View. '
  'ref_week JOIN으로 날짜 → 주차 매핑 후 (year, week_number, client_id, service_id, widget_id) 기준 합산. '
  'display_label, date_start, date_end 포함하여 클라이언트 추가 JOIN 불필요. '
  'DATA Weekly 페이지에서 C/S/W 모드 전체 지원. '
  'CSV 임포트 완료 후 refresh_daily_views() RPC로 갱신.';


-- ---------------------------------------------------------------------------
-- 2. v_monthly — 월간 widget-level 집계 Materialized View
-- ---------------------------------------------------------------------------
-- TO_CHAR(date, 'YYYY-MM') 기준 합산.
-- (year_month, client_id, service_id, widget_id) 기준 합산.
-- ---------------------------------------------------------------------------

DROP MATERIALIZED VIEW IF EXISTS media.v_monthly CASCADE;

CREATE MATERIALIZED VIEW media.v_monthly AS
SELECT
  TO_CHAR(d.date, 'YYYY-MM') AS year_month,
  d.client_id,
  c.client_name,
  d.service_id,
  s.service_name,
  d.widget_id,
  d.widget_name,
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
  d.client_id, c.client_name,
  d.service_id, s.service_name,
  d.widget_id, d.widget_name;

-- REFRESH CONCURRENTLY 필수 고유 인덱스
CREATE UNIQUE INDEX idx_v_monthly_pk
  ON media.v_monthly (year_month, client_id, service_id, widget_id);

-- 월 범위 조회 최적화 (최근 N개월 조회)
CREATE INDEX idx_v_monthly_period
  ON media.v_monthly (year_month DESC);

COMMENT ON MATERIALIZED VIEW media.v_monthly IS
  '월간 widget-level 집계 Materialized View. '
  'TO_CHAR(date, ''YYYY-MM'') 기준 (year_month, client_id, service_id, widget_id) 합산. '
  'DATA Monthly 페이지에서 C/S/W 모드 전체 지원. '
  'CSV 임포트 완료 후 refresh_daily_views() RPC로 갱신.';


