-- =============================================================================
-- Migration: Create media.widget table
-- Date: 2026-02-25
-- Depends on: 2026022504-table-client, 2026022505-table-service
-- =============================================================================
--
-- Purpose:
--   클라이언트/서비스 하에 속하는 개별 광고 위젯(광고 슬롯 단위)을 관리합니다.
--   위젯은 외부 광고 시스템에서 할당된 고유 식별자(widget_id)를 기준으로
--   클라이언트·서비스와 매핑됩니다.
--
-- Business context:
--   "위젯"은 광고가 실제로 게재되는 최소 단위(슬롯, 플레이스먼트)입니다.
--   하나의 서비스(채널) 안에 여러 위젯이 배치될 수 있으며,
--   일별 성과 데이터(daily)는 위젯 단위까지 세분화됩니다.
--   계약 단가(CPM/CPC)도 위젯 단위로 관리됩니다(widget_contract).
--
-- widget_id 설계:
--   외부 광고 시스템에서 부여하는 ID를 그대로 TEXT로 저장합니다.
--   INTEGER 로 변환하면 선행 0("00123" → 123)이 손실될 수 있으므로 TEXT 를 사용합니다.
--   CSV 임포트 시 widget_id 기준으로 이 테이블을 UPSERT 합니다.
--
-- Auto-registration:
--   CSV 임포트 시 daily 에 등록하기 전에 widget 테이블에 존재하지 않으면
--   임포트 로직이 자동으로 UPSERT 합니다. 따라서 widget 테이블에 없는
--   widget_id 가 daily 에 먼저 들어오는 상황은 발생하지 않습니다.
--
-- Entity relationships:
--   media.client  (1) ──< media.widget (N)          — 클라이언트당 복수 위젯
--   media.service (1) ──< media.widget (N)           — 서비스당 복수 위젯
--   media.widget  (1) ──< media.daily (N)             — 위젯별 일별 성과 데이터
--   media.widget  (1) ──< media.widget_contract (N)  — 위젯별 계약 이력
-- =============================================================================

CREATE TABLE media.widget (
  widget_id     TEXT          PRIMARY KEY,                      -- External ad system identifier (TEXT to preserve leading zeros)
  client_id     TEXT          NOT NULL REFERENCES media.client(client_id)  ON DELETE CASCADE,  -- Owner client
  service_id    TEXT          NOT NULL REFERENCES media.service(service_id) ON DELETE CASCADE, -- Owner service
  widget_name   TEXT,                                           -- Human-readable widget label (nullable; may be unknown at registration)
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- Table-level comment
COMMENT ON TABLE media.widget IS
  '광고 위젯(슬롯) 마스터 테이블. '
  '외부 광고 시스템의 위젯 ID와 내부 client/service 를 매핑합니다. '
  'CSV 임포트 시 자동 UPSERT 되며, widget_contract 로 계약 단가 이력을 연결합니다.';

-- Column-level comments
COMMENT ON COLUMN media.widget.widget_id   IS '외부 광고 시스템에서 부여된 위젯 식별자. 선행 0 보존을 위해 TEXT 타입 사용. (예: "00123")';
COMMENT ON COLUMN media.widget.client_id   IS '소속 광고주 ID. media.client.client_id 참조. 클라이언트 삭제 시 위젯도 CASCADE 삭제됩니다.';
COMMENT ON COLUMN media.widget.service_id  IS '소속 서비스 ID. media.service.service_id 참조. 서비스 삭제 시 위젯도 CASCADE 삭제됩니다.';
COMMENT ON COLUMN media.widget.widget_name IS '위젯 표시명. CSV 임포트 시 스냅샷으로 저장됩니다. NULL 허용(초기 등록 시점에는 알 수 없을 수 있음).';
COMMENT ON COLUMN media.widget.created_at  IS '레코드 최초 생성 시각 (UTC). CSV 임포트에 의한 자동 등록 시점입니다.';
COMMENT ON COLUMN media.widget.updated_at  IS '레코드 최종 수정 시각 (UTC). trg_widget_updated_at 트리거가 자동 갱신합니다.';

-- Auto-update updated_at on every row modification
CREATE TRIGGER trg_widget_updated_at
  BEFORE UPDATE ON media.widget
  FOR EACH ROW EXECUTE FUNCTION media.set_updated_at();
