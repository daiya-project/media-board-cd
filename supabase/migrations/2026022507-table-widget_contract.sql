-- =============================================================================
-- Migration: Create media.widget_contract table
-- Date: 2026-02-25
-- Depends on: 2026022506-table-widget
-- =============================================================================
--
-- Purpose:
--   위젯별 광고 계약 단가 이력을 관리합니다. 하나의 위젯은 시간이 지남에 따라
--   계약 조건이 변경될 수 있으므로, 이력 레코드를 누적 저장합니다.
--
-- Business context:
--   광고 계약은 CPM(Cost Per Mille, 1000노출당 단가) 또는 CPC(Cost Per Click)
--   방식으로 이루어지며, 계약 기간(date_start ~ date_end)마다 단가가 다를 수 있습니다.
--   이 테이블을 통해 특정 날짜의 유효 계약 단가를 추적하고, 매출 정산에 활용합니다.
--
-- Why SERIAL PK (not widget_id PK):
--   위젯당 단 하나의 계약만 존재한다면 widget_id 를 PK로 쓸 수 있지만,
--   계약 갱신/단가 변경 이력을 모두 보관해야 하므로 SERIAL id 를 PK로 사용합니다.
--   현재 유효한 계약은 date_end IS NULL 또는 date_end >= CURRENT_DATE 로 필터링합니다.
--
-- Querying the active contract for a widget:
--   SELECT * FROM media.widget_contract
--   WHERE widget_id = $1
--     AND date_start <= CURRENT_DATE
--     AND (date_end IS NULL OR date_end >= CURRENT_DATE)
--   ORDER BY date_start DESC LIMIT 1;
--
-- Entity relationships:
--   media.client   (1) ──< media.widget_contract (N)  — 클라이언트별 계약 조회
--   media.service  (1) ──< media.widget_contract (N)  — 서비스별 계약 조회
--   media.widget   (1) ──< media.widget_contract (N)  — 위젯당 복수 계약 이력
-- =============================================================================
CREATE TABLE media.widget_contract (
  id              SERIAL        PRIMARY KEY,
  client_id       TEXT          NOT NULL REFERENCES media.client(client_id)   ON DELETE CASCADE,
  service_id      TEXT          NOT NULL REFERENCES media.service(service_id) ON DELETE CASCADE,
  widget_id       TEXT          NOT NULL REFERENCES media.widget(widget_id)   ON DELETE CASCADE,
  contract_type   TEXT,
  contract_value  INT4,
  date_start      DATE,
  date_end        DATE,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- Table-level comment
COMMENT ON TABLE media.widget_contract IS
  '위젯별 광고 계약 이력 테이블. '
  '하나의 위젯에 복수의 계약 기간이 존재할 수 있으며, 계약 변경 시 신규 레코드를 추가합니다. '
  'date_end IS NULL 인 레코드가 현재 유효한(진행 중인) 계약입니다.';

-- Column-level comments
COMMENT ON COLUMN media.widget_contract.id             IS 'SERIAL PK. 위젯당 복수 계약 이력을 지원하기 위해 widget_id 대신 독립 시퀀스를 사용합니다.';
COMMENT ON COLUMN media.widget_contract.client_id      IS '계약 소속 클라이언트 ID. media.client.client_id 참조.';
COMMENT ON COLUMN media.widget_contract.service_id     IS '계약이 속한 서비스 ID. media.service.service_id 참조.';
COMMENT ON COLUMN media.widget_contract.widget_id      IS '계약 대상 위젯 ID. media.widget.widget_id 참조.';
COMMENT ON COLUMN media.widget_contract.contract_type  IS '계약 과금 방식. 예: CPM(1000노출당 단가), CPC(클릭당 단가), R/S(Revenue Share).';
COMMENT ON COLUMN media.widget_contract.contract_value IS '계약 단가 (정수). contract_type 에 따라 의미가 다릅니다.';
COMMENT ON COLUMN media.widget_contract.date_start     IS '계약 시작일. 이 날짜부터 contract_value 가 적용됩니다.';
COMMENT ON COLUMN media.widget_contract.date_end       IS '계약 종료일. NULL 이면 현재 진행 중인 계약을 의미합니다.';
COMMENT ON COLUMN media.widget_contract.created_at     IS '레코드 최초 생성 시각 (UTC).';
COMMENT ON COLUMN media.widget_contract.updated_at     IS '레코드 최종 수정 시각 (UTC). trg_widget_contract_updated_at 트리거가 자동 갱신합니다.';

CREATE INDEX idx_widget_contract_widget_id ON media.widget_contract (widget_id);

-- Auto-update updated_at on every row modification
CREATE TRIGGER trg_widget_contract_updated_at
  BEFORE UPDATE ON media.widget_contract
  FOR EACH ROW EXECUTE FUNCTION media.set_updated_at();
