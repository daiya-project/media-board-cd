-- =============================================================================
-- Migration: v_daily Materialized View 전환
-- Date: 2026-04-18
-- Depends on:
--   - 2026030201-views-daily              (v_daily 일반 뷰 최초 정의)
--   - 2026030301-materialized-views-rpc   (refresh_daily_views() 함수 정의)
--   - 2026030702-materialized-views-weekly-monthly (v_weekly / v_monthly MV)
-- =============================================================================
--
-- 배경 / 문제 상황:
-- -----------------------------------------------------------------------------
--   /data-board/daily 페이지는 2-phase loading 구조입니다:
--
--     Phase 2 (server, awaited):
--       getDataBoardQuickPayload() → v_daily_by_service (MV, 빠름)
--     Phase 3 (client, lazy):
--       POST /api/charts/widget-data → v_daily (일반 뷰, 느림)
--
--   widget-level 상세(v_daily)는 widget 개수가 하루 약 3~4천 행 규모로 쌓이고,
--   대시보드는 최근 90일 범위를 조회합니다. 현재 widget-data 라우트는
--   "날짜별 병렬 + offset 페이지네이션" 형태로 수백 round-trip 을 수행하며,
--   각 round-trip 마다 v_daily 가 정의한 3-way JOIN
--       daily ⨝ client ⨝ service
--   을 처음부터 재계산합니다. 이 때문에 Phase 3 가 체감상 눈에 띄게 느립니다.
--
--   대비되는 다른 뷰들(v_daily_total, v_daily_by_service, v_weekly, v_monthly)
--   은 이미 2026030301 / 2026030702 에서 Materialized View 로 전환되어 있으며,
--   widget 레벨 v_daily 만 일반 뷰로 남아 있던 상태입니다.
--
-- 해결 방법:
-- -----------------------------------------------------------------------------
--   v_daily 를 Materialized View 로 전환합니다. 결과:
--     1. JOIN 이 사전 계산되어 물리 저장 → 매 쿼리마다 JOIN 재계산 제거
--     2. 인덱스를 MV 에 직접 부여 가능 → date / client_id 필터가 index scan
--        으로 처리되어 sequential scan fallback 문제 해소
--     3. 앱 측 .from("v_daily") 호출부 코드 변경 불필요 (비파괴적)
--
--   임포트 완료 후에는 기존 refresh_daily_views() RPC 가 함께 REFRESH 하도록
--   함수 정의에 v_daily 를 추가합니다.
--
-- 영향 범위 (변경 없음, 참고용):
-- -----------------------------------------------------------------------------
--   v_daily 를 읽는 앱 코드 (MV 전환 후에도 한 줄도 바꾸지 않음):
--     - app/api/charts/widget-data/route.ts:50      (widget-level lazy load)
--     - lib/api/goalMonthlyService.ts:77, 337       (goal 페이지)
--     - lib/api/externalService.ts:378              (external 페이지)
--
--   v_daily 를 참조하는 DB 객체: 없음 (CASCADE DROP 안전)
--
-- 설계 결정:
-- -----------------------------------------------------------------------------
--   1. 컬럼·JOIN 은 기존 일반 뷰와 100% 동일.
--      MV 전환을 투명하게 만들기 위해 컬럼 이름 / 타입 / 별칭을 건드리지
--      않습니다. 앱의 DailyRawRow 타입과 mapBaseMetrics / mapClientService /
--      mapWidget 이 그대로 동작합니다.
--
--   2. Unique index = (date, widget_id).
--      이유:
--        (a) CONCURRENTLY 기반 REFRESH 는 unique index 가 필수.
--        (b) media.daily 의 grain 이 (date, widget_id) 로 1:1 인 것을
--            2026-04-18 사전 점검(duplicate 0 건) 으로 확인.
--        (c) 이 키는 widget-data 라우트의 .eq("date", date) 조회 패턴과도
--            일치하므로 추가로 조회 인덱스 역할까지 수행.
--
--   3. 보조 인덱스 2종.
--      (a) v_daily_date_idx (date DESC)
--           widget-data 라우트가 90개 날짜를 병렬로 질의하는 현 구조에서
--           각 쿼리가 index scan 으로 처리되도록 보장.
--           v_daily_pk 의 첫 컬럼이 date 이므로 이론상 중복이지만,
--           단일 컬럼 인덱스가 범위 스캔에서 planner 선택이 더 명확함.
--      (b) v_daily_client_date_idx (client_id, date DESC)
--           Board 섹션의 클라이언트 필터 경로(단일 client_id + 기간)
--           에서 composite index 로 처리되도록 보장.
--
--   4. refresh_daily_views() 에 v_daily 를 맨 앞에 추가.
--      다른 MV 들은 v_daily 를 참조하지 않으므로 순서 자체는 무관하지만,
--      "base (widget-level) → aggregate" 방향의 멘탈 모델을 유지하기 위해
--      v_daily 를 가장 먼저 갱신합니다. 향후 v_daily 기반 MV 를 추가할
--      가능성을 남겨둡니다.
--
--   5. REFRESH 는 CONCURRENTLY 로만 수행.
--      단 최초 populate 는 CONCURRENTLY 불가 → Section 3 에서 일반 REFRESH
--      1회. 이후의 refresh_daily_views() 는 모두 CONCURRENTLY 로 동작하여
--      대시보드 읽기에 락을 걸지 않습니다.
--
-- 재실행 안전성:
-- -----------------------------------------------------------------------------
--   Section 1 의 DROP 은 VIEW / MATERIALIZED VIEW 양쪽을 IF EXISTS 로 수행
--   하므로, 이 마이그레이션을 중간에 실패 후 재실행해도 안전합니다.
--
-- 롤백 방법 (필요 시):
-- -----------------------------------------------------------------------------
--   1) DROP MATERIALIZED VIEW media.v_daily CASCADE;
--   2) 2026030201-views-daily.sql 의 v_daily CREATE VIEW 블록을 재실행
--   3) refresh_daily_views() 에서 v_daily 줄 제거 후 CREATE OR REPLACE
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1. 기존 v_daily 객체 삭제
-- ---------------------------------------------------------------------------
-- 기존에는 일반 VIEW 로 존재하지만, 이 마이그레이션의 재실행 안전성을 위해
-- MATERIALIZED VIEW 도 함께 DROP IF EXISTS 합니다.
-- CASCADE: v_daily 를 참조하는 객체가 있다면 함께 삭제 (현재는 없음).
-- ---------------------------------------------------------------------------

DROP VIEW IF EXISTS media.v_daily CASCADE;
DROP MATERIALIZED VIEW IF EXISTS media.v_daily CASCADE;


-- ---------------------------------------------------------------------------
-- 2. v_daily — Materialized View 재생성
-- ---------------------------------------------------------------------------
-- 컬럼 / JOIN / 별칭은 2026030201 의 일반 뷰 정의와 100% 동일.
-- 앱 측 .from("v_daily") 호출부가 변경 없이 동작해야 합니다.
--
-- 주의:
--   - widget_name 은 media.daily 에 denormalized 되어 있으므로 widget 테이블
--     JOIN 불필요.
--   - pub_profit 은 앱 레이어 용어인 ad_revenue 로 별칭 (일관성 유지).
--   - 비율 지표(MFR, CTR, vCTR, vRATE)는 의도적으로 제외 — 여러 행을
--     합산할 때 정확성을 위해 앱에서 원본값으로 재계산합니다.
-- ---------------------------------------------------------------------------

CREATE MATERIALIZED VIEW media.v_daily AS
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


-- ---------------------------------------------------------------------------
-- 2-A. 인덱스
-- ---------------------------------------------------------------------------
-- (1) v_daily_pk — CONCURRENTLY refresh 의 전제조건인 고유 인덱스.
--      (date, widget_id) 는 media.daily 의 grain 과 일치합니다.
--      widget-data 라우트의 .eq("date", date) 쿼리가 이 인덱스의
--      leftmost prefix 로 처리되므로 별도 date 인덱스 없이도 작동하지만,
--      아래 v_daily_date_idx 를 추가로 두어 planner 가 확실하게 선택하도록
--      보강합니다.
--
-- (2) v_daily_date_idx — 단일 컬럼 (date DESC).
--      날짜 기준 범위 스캔, 최신순 정렬 조회에 명시적으로 사용됩니다.
--      widget-data 라우트가 90개 병렬 쿼리를 쏠 때 각 쿼리를 안정적으로
--      index-only scan 에 가깝게 수행하도록 돕습니다.
--
-- (3) v_daily_client_date_idx — 복합 인덱스 (client_id, date DESC).
--      Board 섹션의 단일 client_id + 기간 필터 조회 패턴 최적화.
-- ---------------------------------------------------------------------------

CREATE UNIQUE INDEX v_daily_pk
  ON media.v_daily (date, widget_id);

CREATE INDEX v_daily_date_idx
  ON media.v_daily (date DESC);

CREATE INDEX v_daily_client_date_idx
  ON media.v_daily (client_id, date DESC);


-- ---------------------------------------------------------------------------
-- 2-B. 문서 주석 (pg_description)
-- ---------------------------------------------------------------------------
-- psql \d+ / Supabase Studio 등에서 바로 보이도록 MV 본체와 주요 인덱스에
-- COMMENT 를 부여합니다.
-- ---------------------------------------------------------------------------

COMMENT ON MATERIALIZED VIEW media.v_daily IS
  '위젯 단위 일별 성과 Materialized View. '
  'media.daily ⨝ media.client ⨝ media.service 를 사전 계산. '
  '(date, widget_id) 당 1행. 비율 컬럼 없음 — 앱에서 원본 합산값으로 재계산. '
  '임포트 완료 후 refresh_daily_views() RPC 로 CONCURRENTLY 갱신. '
  '주 소비자: /data-board/daily 페이지 widget-level lazy load '
  '(app/api/charts/widget-data).';

COMMENT ON INDEX media.v_daily_pk IS
  'REFRESH CONCURRENTLY 를 위한 고유 인덱스. '
  '(date, widget_id) 는 media.daily 의 grain 과 일치합니다.';

COMMENT ON INDEX media.v_daily_date_idx IS
  '날짜 단일 필터 조회 최적화. '
  'widget-data 라우트의 90개 병렬 .eq("date", date) 쿼리용.';

COMMENT ON INDEX media.v_daily_client_date_idx IS
  '클라이언트 필터 + 기간 조회 최적화 (복합 인덱스).';


-- ---------------------------------------------------------------------------
-- 3. 초기 populate
-- ---------------------------------------------------------------------------
-- MATERIALIZED VIEW 는 CREATE 직후 비어 있습니다. 최초 1회는 CONCURRENTLY
-- 가 불가능하므로 일반 REFRESH 를 수행합니다.
-- 이후 refresh_daily_views() 가 CONCURRENTLY 로 반복 갱신합니다.
--
-- 주의: REFRESH 중에는 AccessExclusiveLock 이 걸려 읽기도 블로킹되지만,
-- 이 마이그레이션은 배포 전 수동 실행되므로 대시보드 사용자 영향은
-- 없습니다. 수 초 이내 완료됩니다 (행 수 ~수십만 규모).
-- ---------------------------------------------------------------------------

REFRESH MATERIALIZED VIEW media.v_daily;


-- ---------------------------------------------------------------------------
-- 4. refresh_daily_views() — v_daily REFRESH 포함하도록 재정의
-- ---------------------------------------------------------------------------
-- 기존 시그니처(LANGUAGE plpgsql, SECURITY DEFINER, statement_timeout 120s)
-- 를 유지하고 본문에 v_daily REFRESH 를 한 줄 추가합니다.
--
-- SECURITY DEFINER:
--   함수 소유자(postgres) 권한으로 실행되어 anon / authenticated 앱 사용자도
--   MV 를 REFRESH 할 수 있습니다.
--
-- CONCURRENTLY:
--   REFRESH 중에도 읽기 가능 (AccessShareLock 만 획득). unique index 필수.
--
-- statement_timeout = 120s:
--   전체 REFRESH 소요가 이 값을 넘으면 PostgreSQL 이 강제 중단합니다.
--   현재 데이터 규모에서는 수 초 이내에 완료되며, 데이터가 수 년간 누적되면
--   이 값을 상향 검토해야 합니다.
--
-- 호출 시점:
--   - cron (lib/features/daily-redash-import/cron.ts) 매일 06:00 KST
--   - 수동 모달 (app/api/import/redash/route.ts)
--   - 두 경로 모두 lib/logic/importOrchestration.ts 내부에서
--     refreshDailyViews() 를 통해 이 RPC 를 호출합니다 (30s timeout + 비치명).
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION media.refresh_daily_views()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout = '120s'
AS $$
BEGIN
  -- v_daily 를 먼저 갱신 (base widget-level → aggregate 순서 유지).
  REFRESH MATERIALIZED VIEW CONCURRENTLY media.v_daily;
  REFRESH MATERIALIZED VIEW CONCURRENTLY media.v_daily_total;
  REFRESH MATERIALIZED VIEW CONCURRENTLY media.v_daily_by_service;
  REFRESH MATERIALIZED VIEW CONCURRENTLY media.v_weekly;
  REFRESH MATERIALIZED VIEW CONCURRENTLY media.v_monthly;
END;
$$;


-- 앱 사용자(authenticated, anon) 실행 권한.
-- 2026030301 에서 이미 부여되어 있지만, CREATE OR REPLACE 로 함수를
-- 재정의한 뒤에도 권한이 유지됨을 명시적으로 보장합니다.
GRANT EXECUTE ON FUNCTION media.refresh_daily_views() TO authenticated;
GRANT EXECUTE ON FUNCTION media.refresh_daily_views() TO anon;


COMMENT ON FUNCTION media.refresh_daily_views() IS
  '임포트 완료 후 모든 Materialized View 를 갱신합니다. '
  'v_daily (widget-level base), v_daily_total, v_daily_by_service, '
  'v_weekly, v_monthly 를 CONCURRENTLY 로 순차 갱신 (읽기 잠금 없음). '
  'SECURITY DEFINER 로 선언되어 anon / authenticated 앱 사용자가 '
  '직접 호출할 수 있습니다. 호출 경로: '
  'lib/logic/importOrchestration.ts → refreshDailyViews() → 이 RPC.';
