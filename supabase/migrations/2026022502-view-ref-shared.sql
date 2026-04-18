-- =============================================================================
-- Migration: Create media schema reference views for shared schema objects
-- Date: 2026-02-25
-- Depends on: 2026022501-schema-media, shared.holiday, shared.manager, shared.week
-- =============================================================================
--
-- Purpose:
--   shared 스키마에 존재하는 마스터 데이터(공휴일, 매니저, 주차)를 media 스키마 내에서
--   직접 참조할 수 있도록 래퍼 뷰(ref_*)를 생성합니다.
--
-- Design rationale:
--   - shared 스키마는 여러 서비스 도메인이 공용으로 사용하는 참조 데이터를 보관합니다.
--   - media 스키마 내의 쿼리가 shared 스키마를 직접 참조할 수도 있지만,
--     ref_ 뷰를 통해 스키마 경계를 명확히 하고 나중에 shared 스키마 구조가
--     변경되더라도 이 뷰만 수정하면 media 쪽 코드를 보호할 수 있습니다.
--   - 모든 ref_ 뷰는 SELECT 전용이며 INSERT/UPDATE/DELETE 대상이 아닙니다.
--
-- Relationships:
--   media.client.manager_id        → media.ref_manager.id (shared.manager.id)
--   media.client.manager_id_second → media.ref_manager.id (shared.manager.id)
--   (holiday/week 는 쿼리 레벨에서 JOIN 해서 사용)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. ref_holiday — 공휴일 참조 뷰
--
-- 역할: 공휴일 정보를 제공합니다. 성과 분석 시 공휴일 여부를 확인하거나
--       KPI 차트에서 특이일(공휴일)을 시각적으로 표시할 때 사용됩니다.
-- 원본: shared.holiday
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW media.ref_holiday AS
SELECT
  id,
  holiday_name,
  created_at
FROM shared.holiday;

COMMENT ON VIEW media.ref_holiday IS
  '공휴일 참조 뷰. 원본: shared.holiday. '
  '성과 데이터 분석 시 특정 날짜가 공휴일인지 확인하거나 차트에서 마커로 표시할 때 사용합니다.';

-- -----------------------------------------------------------------------------
-- 2. ref_manager — 담당자 참조 뷰
--
-- 역할: 영업/계정 매니저 목록을 제공합니다.
--       media.client.manager_id / manager_id_second 가 이 뷰의 id 를 참조합니다.
--       UI의 담당자 드롭다운 목록, 필터, MGMT 화면의 담당자 열에 사용됩니다.
-- 원본: shared.manager
-- Columns:
--   id            - FK 참조용 식별자 (media.client 에서 참조)
--   name          - 담당자 이름 (UI 표시용)
--   team          - 소속 팀
--   display_order - UI 정렬 순서 (드롭다운, 테이블 등)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW media.ref_manager AS
SELECT
  id,
  name,
  team,
  display_order,
  created_at,
  updated_at
FROM shared.manager;

COMMENT ON VIEW media.ref_manager IS
  '담당자(매니저) 참조 뷰. 원본: shared.manager. '
  'media.client.manager_id / manager_id_second 의 FK 대상이며, '
  'UI 드롭다운 및 MGMT 화면 담당자 컬럼에서 사용합니다.';

-- -----------------------------------------------------------------------------
-- 3. ref_week — 주차 참조 뷰
--
-- 역할: 날짜(date) → 주차(week_number, year) 매핑 테이블을 제공합니다.
--       일별 성과 데이터를 주 단위로 집계할 때 JOIN 하여 사용합니다.
--       예: v_daily JOIN ref_week ON v_daily.date BETWEEN ref_week.date_start AND ref_week.date_end
-- 원본: shared.week
-- Columns:
--   date_start    - 해당 주의 시작일 (월요일)
--   date_end      - 해당 주의 종료일 (일요일)
--   week_number   - ISO 주차 번호
--   year          - 연도
--   display_label - UI 표시용 레이블 (예: "2026-W08")
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW media.ref_week AS
SELECT
  id,
  date_start,
  date_end,
  week_number,
  year,
  display_label,
  created_at,
  updated_at
FROM shared.week;

COMMENT ON VIEW media.ref_week IS
  '주차 참조 뷰. 원본: shared.week. '
  '일별 성과 데이터를 주 단위로 집계하거나, 날짜 → 주차 번호 변환이 필요할 때 JOIN 합니다.';
