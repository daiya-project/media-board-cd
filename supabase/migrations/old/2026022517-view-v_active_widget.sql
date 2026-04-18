-- =============================================================================
-- Migration: Create media.v_active_widget view
-- Date: 2026-02-25
-- Depends on: 2026022509-table-daily
-- =============================================================================
--
-- Purpose:
--   최근 30일 이내에 성과 데이터(daily_data)가 1건 이상 존재하는 위젯 목록을
--   클라이언트/서비스 정보와 함께 제공합니다.
--
-- Business context:
--   광고 시스템에서는 캠페인이 종료되거나 일시 정지되면 해당 위젯에 대한
--   성과 데이터가 더 이상 유입되지 않습니다. 이 뷰는 "현재 활성 상태"인
--   위젯만 추려내어 UI 드롭다운 필터, 위젯 선택기 등에서 사용합니다.
--   media.widget 테이블의 전체 목록 대신 이 뷰를 사용하면 불필요한 항목을
--   제외하고 실제로 운영 중인 위젯만 표시할 수 있습니다.
--
-- "Active" definition:
--   최근 30일(CURRENT_DATE - 30일) 이내에 daily 레코드가 존재하는 위젯.
--   widget_id IS NOT NULL 조건으로 서비스 단위 집계 행(widget_id = NULL)을 제외합니다.
--   DISTINCT 로 동일 (widget_id, client_id, service_id) 조합의 중복을 제거합니다.
--
-- Performance note:
--   CURRENT_DATE 를 사용하므로 매 쿼리 실행 시 다시 계산됩니다(캐싱되지 않음).
--   idx_daily_date 인덱스를 활용하여 최근 30일 행만 빠르게 스캔합니다.
--
-- Usage:
--   - MGMT 섹션: 위젯 필터 드롭다운
--   - RecordAction 모달: 위젯 선택기 (활성 위젯만 표시)
--   - DATA 섹션: 위젯 필터 (활성 위젯 우선 표시)
--   SELECT * FROM media.v_active_widget WHERE client_id = $1;
--
-- Related tables/views:
--   media.widget       — 위젯 마스터 (전체 목록, 비활성 포함)
--   media.daily        — 이 뷰의 데이터 소스
-- =============================================================================

CREATE OR REPLACE VIEW media.v_active_widget AS
SELECT DISTINCT
  widget_id,                    -- Widget identifier
  client_id,                    -- Owning client (from daily; consistent with media.widget)
  service_id                    -- Owning service (from daily; consistent with media.widget)
FROM media.daily
WHERE date >= CURRENT_DATE - INTERVAL '30 days'  -- Only widgets active in the last 30 days
  AND widget_id IS NOT NULL;                      -- Exclude service-level aggregated rows (no specific widget)

COMMENT ON VIEW media.v_active_widget IS
  '최근 30일 내 성과 데이터가 존재하는 활성 위젯 목록. '
  'media.daily 에서 DISTINCT (widget_id, client_id, service_id) 를 추출합니다. '
  'widget_id IS NULL 인 서비스 단위 집계 행을 제외합니다. '
  'UI 위젯 필터 드롭다운 및 위젯 선택기의 데이터 소스로 사용됩니다. '
  '전체 위젯 목록이 필요하면 media.widget 테이블을 직접 사용하세요.';
