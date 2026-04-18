-- =============================================================================
-- Migration: Create media.service table
-- Date: 2026-02-25
-- Depends on: 2026022504-table-client
-- =============================================================================
--
-- Purpose:
--   클라이언트(광고주)가 운영하는 개별 광고 서비스(채널/지면 단위)를 관리합니다.
--   하나의 클라이언트는 여러 서비스를 운영할 수 있으며(예: 네이버 디스플레이,
--   네이버 네이티브), 각 서비스는 복수의 위젯(광고 슬롯)을 포함합니다.
--
-- Business context:
--   "서비스"는 광고 게재 채널 또는 광고 상품의 단위입니다.
--   실무에서는 "매체" 또는 "플레이스먼트"라고도 부릅니다.
--   동일 클라이언트가 채널을 늘릴 때 새 service 레코드를 추가하며,
--   해당 서비스에 위젯과 계약 정보를 연결합니다.
--
-- Entity relationships:
--   media.client (1) ──< media.service (N)      — 클라이언트당 복수 서비스
--   media.service (1) ──< media.widget (N)       — 서비스당 복수 위젯
--   media.service (1) ──< media.daily (N)         — 서비스별 일별 성과 데이터
--   media.service (1) ──< media.action (N)       — 서비스별 영업 활동 기록(선택)
--
-- Uniqueness constraint:
--   (client_id, service_name) UNIQUE — 동일 클라이언트 내에서 서비스명은 중복 불가.
--   클라이언트가 다르면 동일 서비스명 사용 가능합니다.
--
-- Competitor tracking:
--   has_competitor_taboola: Taboola 가 경쟁사인지 여부를 bool 로 빠르게 필터링.
--   competitor_etc: Taboola 외 경쟁사 정보를 JSONB 로 유연하게 저장합니다.
--   예: {"outbrain": true, "dable": false}
-- =============================================================================

CREATE TABLE media.service (
  service_id              TEXT          PRIMARY KEY,
  client_id               TEXT          NOT NULL REFERENCES media.client(client_id) ON DELETE CASCADE,  -- Parent client
  service_name            TEXT          NOT NULL,               -- Service display name
  service_type            TEXT,                                 -- Ad format type (e.g. display, native, video)
  has_competitor_taboola  BOOLEAN       NOT NULL DEFAULT false, -- Flag: Taboola is a competitor for this service
  competitor_etc          JSONB         NOT NULL DEFAULT '{}',  -- Other competitors as JSON object
  is_active               BOOLEAN       NOT NULL DEFAULT true,  -- Soft-delete flag
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ   NOT NULL DEFAULT now(),

  UNIQUE (client_id, service_name)  -- Service name must be unique per client
);

-- Table-level comment
COMMENT ON TABLE media.service IS
  '클라이언트별 광고 서비스(채널/지면) 테이블. '
  '하나의 클라이언트는 복수의 서비스를 가질 수 있으며, 각 서비스에 위젯과 일별 성과 데이터가 연결됩니다. '
  '(client_id, service_name) 복합 UNIQUE 제약으로 동일 클라이언트 내 서비스명 중복을 방지합니다.';

-- Column-level comments
COMMENT ON COLUMN media.service.service_id             IS 'TEXT PK. 외부 시스템 식별자 또는 애플리케이션 레벨에서 부여하는 고유 키. widget / daily / action 에서 FK로 참조합니다.';
COMMENT ON COLUMN media.service.client_id              IS '소속 광고주 ID. media.client.client_id 참조. 클라이언트 삭제 시 관련 서비스도 CASCADE 삭제됩니다.';
COMMENT ON COLUMN media.service.service_name           IS '서비스 표시명. 동일 클라이언트 내에서 고유해야 합니다.';
COMMENT ON COLUMN media.service.service_type           IS '서비스 광고 유형. 예: display(디스플레이), native(네이티브), video(동영상). 자유 텍스트이므로 일관된 값 입력이 중요합니다.';
COMMENT ON COLUMN media.service.has_competitor_taboola IS 'Taboola 경쟁사 여부. MGMT 화면에서 경쟁사 현황 빠른 필터링에 사용됩니다.';
COMMENT ON COLUMN media.service.competitor_etc         IS 'Taboola 외 기타 경쟁사 정보를 JSON 형태로 저장합니다. 예: {"outbrain": true, "dable": false}';
COMMENT ON COLUMN media.service.is_active              IS '활성 여부. false 이면 UI에서 기본 숨김. 과거 데이터는 보존됩니다.';
COMMENT ON COLUMN media.service.created_at             IS '레코드 최초 생성 시각 (UTC).';
COMMENT ON COLUMN media.service.updated_at             IS '레코드 최종 수정 시각 (UTC). trg_service_updated_at 트리거가 자동 갱신합니다.';

-- Auto-update updated_at on every row modification
CREATE TRIGGER trg_service_updated_at
  BEFORE UPDATE ON media.service
  FOR EACH ROW EXECUTE FUNCTION media.set_updated_at();
