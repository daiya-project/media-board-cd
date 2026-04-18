-- =============================================================================
-- Migration: 일별 성과 뷰 생성 (v_dates, v_daily_total, v_daily_by_service, v_daily)
-- Date: 2026-03-02
-- Depends on: 2026022509-table-daily, 2026022504-table-client, 2026022505-table-service
-- =============================================================================
--
-- 목적:
--   일별 성과 데이터를 3단계 집계 수준(전사 → 서비스 → 위젯)으로
--   제공하는 뷰 계층 구조를 생성합니다.
--   각 뷰는 앱에서 필요한 5개 원본 지표 컬럼(cost_spent, ad_revenue, imp, vimp,
--   cnt_click)을 노출합니다.
--   비율 지표(MFR, CTR, vCTR, vRATE)는 의도적으로 제외 — 여러 날짜/엔티티를
--   합산할 때 정확성을 위해 앱에서 원본 합산값으로 재계산합니다.
--
-- 뷰 계층:
--   v_dates             — 고유 날짜 목록 (유틸리티, 지표 없음)
--   v_daily_total       — GROUP BY date (JOIN 없음, 가장 빠름)
--   v_daily_by_service  — GROUP BY date, client_id, service_id (+ 메타데이터)
--   v_daily             — 위젯 단위 상세 (+ 메타데이터, GROUP BY 없음)
--
-- 설계 결정:
--   1. 비율 컬럼 미포함 — 집계 시 사전 계산된 비율의 평균이 아닌,
--      합산된 원본값에서 비율을 재계산해야 정확합니다.
--   2. 일관된 컬럼명 — 모든 뷰에서 cost_spent, ad_revenue, imp, vimp,
--      cnt_click 사용 (total_ 접두사 없음). 앱 타입을 단순하게 유지합니다.
--   3. 최소 메타데이터 — 앱에서 실제 사용하는 컬럼만 포함
--      (client_name, service_name). tier, manager_id, service_type 제외.
--   4. pub_profit을 ad_revenue로 별칭 — 앱 레이어의 명확성을 위함.
--   5. v_daily_by_client 미생성 — client-level 집계는 v_daily_by_service를
--      client-side groupRawData()로 처리. 별도 뷰 불필요.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 0. 기존 뷰 삭제 (의존성 역순)
-- ---------------------------------------------------------------------------
-- v_daily가 다른 뷰에 의존하지는 않지만, 기존에 다른 정의로 생성되었을 수 있으므로
-- CREATE OR REPLACE 전에 안전하게 DROP합니다.
-- CASCADE: 이 뷰에 의존하는 다른 객체도 함께 삭제합니다.
-- ---------------------------------------------------------------------------

DROP VIEW IF EXISTS media.v_daily CASCADE;
DROP VIEW IF EXISTS media.v_daily_by_service CASCADE;
DROP VIEW IF EXISTS media.v_daily_by_client CASCADE;  -- legacy cleanup
DROP VIEW IF EXISTS media.v_daily_total CASCADE;
DROP VIEW IF EXISTS media.v_dates CASCADE;


-- ---------------------------------------------------------------------------
-- 1. v_dates — 고유 날짜 목록 (유틸리티 뷰)
-- ---------------------------------------------------------------------------
-- 날짜 수집 시 페이지네이션 루프를 제거합니다.
-- 사용법: SELECT date FROM media.v_dates LIMIT 90
-- ---------------------------------------------------------------------------

CREATE VIEW media.v_dates AS
SELECT DISTINCT date
FROM media.daily
ORDER BY date DESC;

COMMENT ON VIEW media.v_dates IS
  'media.daily의 고유 날짜 목록 (최신순 정렬). '
  '페이지네이션 기반 날짜 수집을 대체합니다 (10~15 쿼리 → 1 쿼리). '
  '사용법: SELECT date FROM media.v_dates LIMIT 90.';


-- ---------------------------------------------------------------------------
-- 2. v_daily_total — 전사 일별 집계 (JOIN 없음)
-- ---------------------------------------------------------------------------
-- Board 섹션: KPI 카드 + 전체 차트 (클라이언트 필터 미적용 시).
-- 날짜당 1행 — 90일 기준 약 90행.
-- ---------------------------------------------------------------------------

CREATE VIEW media.v_daily_total AS
SELECT
  date,
  SUM(cost_spent)   AS cost_spent,
  SUM(pub_profit)   AS ad_revenue,
  SUM(imp)          AS imp,
  SUM(vimp)         AS vimp,
  SUM(cnt_click)    AS cnt_click
FROM media.daily
GROUP BY date;

COMMENT ON VIEW media.v_daily_total IS
  '전사 일별 집계 (모든 클라이언트/서비스/위젯을 날짜별 합산). '
  'JOIN 없이 media.daily만 읽습니다. Board 섹션 KPI 카드 및 전체 차트용. '
  '날짜당 1행. 비율 지표는 의도적으로 제외 (앱에서 원본값으로 재계산).';


-- ---------------------------------------------------------------------------
-- 3. v_daily_by_service — 서비스별 일별 집계
-- ---------------------------------------------------------------------------
-- Board 섹션: 트렌드 리스트 + 서비스별 차트.
-- Board 섹션 (필터 적용): search/tier/owner 필터 활성 시 KPI 카드.
-- Data 섹션 S 모드 (향후 사용).
-- (date, client_id, service_id)당 1행.
-- ---------------------------------------------------------------------------

CREATE VIEW media.v_daily_by_service AS
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

COMMENT ON VIEW media.v_daily_by_service IS
  '서비스별 일별 집계 (위젯을 날짜별 서비스별 합산). '
  'media.client, media.service JOIN으로 이름 포함. '
  'Board 섹션: 트렌드 리스트, 서비스 차트, 필터 적용 KPI 카드. '
  '(date, client_id, service_id)당 1행. 비율 지표 제외.';


-- ---------------------------------------------------------------------------
-- 4. v_daily — 위젯 단위 상세 (슬림화)
-- ---------------------------------------------------------------------------
-- Data 섹션 W 모드: 위젯 단위 원본 데이터 + 메타데이터.
-- 집계 없음 (daily 레코드당 1행).
-- 미사용 컬럼 제거: mfr_rate, ctr_rate, vctr_rate, vrate, cnt_cv,
-- tier, manager_id, manager_id_second, service_type, created_at, updated_at.
-- ---------------------------------------------------------------------------

CREATE VIEW media.v_daily AS
SELECT
  d.date,
  d.client_id,
  c.client_name,
  d.service_id,
  s.service_name,
  d.widget_id,
  d.widget_name,
  d.cost_spent,
  d.pub_profit    AS ad_revenue,
  d.imp,
  d.vimp,
  d.cnt_click
FROM media.daily d
JOIN media.client  c ON d.client_id  = c.client_id
JOIN media.service s ON d.service_id = s.service_id;

COMMENT ON VIEW media.v_daily IS
  '위젯 단위 일별 성과 뷰 (슬림화). '
  'media.client, media.service JOIN으로 이름만 포함. '
  '비율 컬럼 없음 — 앱에서 원본 합산값으로 재계산. '
  'Data 섹션 W 모드 주요 데이터 소스. '
  '집계 데이터는 v_daily_total, v_daily_by_service를 사용하세요.';
