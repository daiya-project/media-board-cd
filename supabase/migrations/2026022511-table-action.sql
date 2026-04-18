-- =============================================================================
-- Migration: Create media.action table
-- Date: 2026-02-25
-- Depends on: 2026022504-table-client, 2026022505-table-service, 2026022506-table-widget
-- =============================================================================
--
-- Purpose:
--   영업팀이 클라이언트와 수행한 활동(미팅, 제안, 연락 등)을 CRM 스타일로
--   기록합니다. 클라이언트 단위의 영업 파이프라인 관리에 사용됩니다.
--
-- Business context:
--   영업 담당자는 클라이언트와의 모든 접점(이메일, 전화, 방문 등)을 이 테이블에
--   기록합니다. 각 활동은 영업 단계(stage)와 연계되어 파이프라인 현황을 시각화할 수 있고,
--   후속 조치(follow-up)가 필요한 경우 has_followup 플래그를 설정합니다.
--
-- Stage pipeline:
--   contact  → 최초 연락 (이메일/전화)
--   meeting  → 미팅 진행
--   propose  → 제안서 제출
--   done     → 계약 완료 또는 종료
--   각 단계는 순서를 강제하지 않습니다. 클라이언트 상황에 따라 단계를 건너뛸 수 있습니다.
--
-- Granularity:
--   action 은 클라이언트 단위 필수, 서비스/위젯은 선택 사항입니다.
--   - 클라이언트 전체에 관한 활동: service_id = NULL, widget_id = NULL
--   - 특정 서비스에 관한 활동: service_id 지정, widget_id = NULL
--   - 특정 위젯에 관한 활동: service_id 및 widget_id 지정
--
-- CASCADE vs SET NULL:
--   client_id: ON DELETE CASCADE — 클라이언트가 삭제되면 관련 활동 기록도 삭제
--   service_id: ON DELETE SET NULL — 서비스가 삭제되면 활동 기록은 보존하되 service_id 만 NULL
--   widget_id: ON DELETE SET NULL — 위젯이 삭제되면 활동 기록은 보존하되 widget_id 만 NULL
--   → 클라이언트 활동 기록은 비즈니스 이력이므로 서비스/위젯 삭제 시에도 보존합니다.
--
-- Entity relationships:
--   media.client  (1) ──< media.action (N)  — 클라이언트당 복수 활동 (필수)
--   media.service (1) ──< media.action (N)  — 서비스별 활동 (선택)
--   media.widget  (1) ──< media.action (N)  — 위젯별 활동 (선택)
-- =============================================================================

CREATE TABLE media.action (
  action_id       SERIAL        PRIMARY KEY,
  client_id       TEXT          NOT NULL REFERENCES media.client(client_id) ON DELETE CASCADE,   -- Required: owning client
  service_id      TEXT          REFERENCES media.service(service_id) ON DELETE SET NULL,         -- Optional: related service
  widget_id       TEXT          REFERENCES media.widget(widget_id)  ON DELETE SET NULL,          -- Optional: related widget
  action_date     DATE          NOT NULL,                           -- Date the activity took place
  stage           TEXT          CHECK (stage IN ('contact', 'meeting', 'propose', 'done', 'memo')),  -- Sales pipeline stage
  memo            JSONB,                                             -- BlockNote rich-text content (JSON block array)
  has_followup    BOOLEAN       NOT NULL DEFAULT false,             -- Flag: follow-up action required
  is_deleted      BOOLEAN       NOT NULL DEFAULT false,             -- Soft delete flag
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- Table-level comment
COMMENT ON TABLE media.action IS
  '클라이언트 영업/관리 활동 CRM 기록 테이블. '
  '클라이언트 단위 필수, 서비스/위젯 단위 선택적으로 활동을 기록합니다. '
  '영업 파이프라인(contact → meeting → propose → done) 관리와 후속 조치 추적에 사용됩니다.';

-- Column-level comments
COMMENT ON COLUMN media.action.action_id    IS 'SERIAL PK. 내부 참조용.';
COMMENT ON COLUMN media.action.client_id    IS '활동 대상 클라이언트 ID. media.client.client_id 참조. 필수 컬럼. 클라이언트 삭제 시 관련 활동도 CASCADE 삭제됩니다.';
COMMENT ON COLUMN media.action.service_id   IS '활동이 특정 서비스와 관련된 경우의 서비스 ID. media.service.service_id 참조. 선택적(NULL 허용). 서비스 삭제 시 NULL 처리됩니다.';
COMMENT ON COLUMN media.action.widget_id    IS '활동이 특정 위젯과 관련된 경우의 위젯 ID. media.widget.widget_id 참조. 선택적(NULL 허용). 위젯 삭제 시 NULL 처리됩니다.';
COMMENT ON COLUMN media.action.action_date  IS '활동이 실제로 수행된 날짜. 레코드 생성일(created_at)과 다를 수 있습니다(소급 기록 가능).';
COMMENT ON COLUMN media.action.stage        IS '영업 파이프라인 단계. contact(최초 연락) → meeting(미팅) → propose(제안) → done(완료). 단계 순서는 강제되지 않습니다.';
COMMENT ON COLUMN media.action.memo         IS 'BlockNote 리치텍스트 콘텐츠 (JSONB). Block[] 배열 형태로 저장됩니다. 미팅 내용, 논의 사항, 특이사항 등을 기록합니다.';
COMMENT ON COLUMN media.action.has_followup IS 'Follow-up 필요 여부 플래그. true 이면 MGMT 화면에서 후속 조치 필요 항목으로 표시됩니다.';
COMMENT ON COLUMN media.action.is_deleted   IS '소프트 삭제 플래그. true이면 삭제된 것으로 간주하여 UI에서 표시하지 않습니다. 히스토리 관리를 위해 DB에는 보존됩니다.';
COMMENT ON COLUMN media.action.created_at   IS '레코드 최초 생성 시각 (UTC). 담당자가 시스템에 입력한 시각입니다.';
COMMENT ON COLUMN media.action.updated_at   IS '레코드 최종 수정 시각 (UTC). trg_action_updated_at 트리거가 자동 갱신합니다.';

CREATE INDEX idx_action_client_id   ON media.action (client_id);
CREATE INDEX idx_action_action_date ON media.action (action_date DESC);
CREATE INDEX idx_action_is_deleted  ON media.action (is_deleted);

-- Auto-update updated_at on every row modification
CREATE TRIGGER trg_action_updated_at
  BEFORE UPDATE ON media.action
  FOR EACH ROW EXECUTE FUNCTION media.set_updated_at();
