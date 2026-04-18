-- =============================================================================
-- Migration: Create media.client table
-- Date: 2026-02-25
-- Depends on: 2026022502-view-ref-shared (media.ref_manager → shared.manager)
-- =============================================================================
--
-- Purpose:
--   매체사(클라이언트)의 기본 정보를 관리합니다.
--   이 테이블은 시스템 전체의 최상위 엔티티로, 거의 모든 도메인 객체가
--   client_id 를 통해 이 테이블을 참조합니다.
--
-- Business context:
--   "클라이언트"는 광고 지면을 제공/운영하는 매체사(퍼블리셔)입니다. 하나의 매체사는
--   복수의 서비스(광고 채널)를 운영할 수 있으며, 각 서비스 하에 위젯(광고 슬롯)이
--   배치됩니다. 영업팀은 매체사 단위로 활동(action)을 기록하고 영업 파이프라인을
--   관리합니다.
--
-- Entity relationships (이 테이블을 참조하는 테이블):
--   media.client (PK: client_id)
--     ├── media.service.client_id     — 1:N (매체사 → 서비스)
--     ├── media.widget.client_id      — 1:N (매체사 → 위젯, service 경유)
--     ├── media.daily.client_id       — 1:N (매체사 → 일별 성과 원본 데이터)
--     └── media.action.client_id      — 1:N (매체사 → 영업 활동 기록)
--
--   media.client.manager_id        → shared.manager.id (주 담당자, FK)
--   media.client.manager_id_second → shared.manager.id (부 담당자, FK)
--   ※ media.ref_manager 는 shared.manager 의 래퍼 VIEW. FK 는 원본 테이블을 직접 참조.
--
-- Soft-delete strategy:
--   실제 삭제 대신 is_active = false 로 비활성 처리합니다.
--   비활성 매체사의 과거 데이터(daily, action 등)는 보존됩니다.
--   UI에서는 기본적으로 is_active = true 인 매체사만 표시합니다.
-- =============================================================================

CREATE TABLE media.client (
  client_id         TEXT          PRIMARY KEY,
  client_name       TEXT          NOT NULL UNIQUE,               -- Publisher display name (must be unique)
  tier              TEXT          CHECK (tier IN ('상', '중', '하', '기타')),  -- Business priority tier
  manager_id        INTEGER       REFERENCES shared.manager(id) ON DELETE SET NULL,  -- Primary account manager
  manager_id_second INTEGER       REFERENCES shared.manager(id) ON DELETE SET NULL,  -- Secondary account manager
  contact_name      TEXT,                                        -- Publisher-side contact person name
  contact_phone     TEXT,                                        -- Publisher-side contact phone number
  contact_email     TEXT,                                        -- Publisher-side contact email address
  is_active         BOOLEAN       NOT NULL DEFAULT true,         -- Soft-delete flag (false = inactive/archived)
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- Table-level comment
COMMENT ON TABLE media.client IS
  '매체사(클라이언트) 마스터 테이블. '
  '시스템의 최상위 엔티티로 service / widget / daily / action 모두 이 테이블을 참조합니다. '
  '삭제 대신 is_active = false 로 비활성 처리(소프트 딜리트)합니다.';

-- Column-level comments
COMMENT ON COLUMN media.client.client_id         IS 'TEXT PK. 외부 시스템 식별자 또는 애플리케이션 레벨에서 부여하는 고유 키. service / widget / daily / action 에서 FK로 참조합니다.';
COMMENT ON COLUMN media.client.client_name       IS '매체사 표시명. 시스템 전체에서 고유해야 합니다(UNIQUE 제약).';
COMMENT ON COLUMN media.client.tier              IS '영업 우선순위 등급: 상(高) / 중(中) / 하(低) / 기타. MGMT 화면에서 필터/정렬에 사용됩니다.';
COMMENT ON COLUMN media.client.manager_id        IS '주 담당 매니저 ID. shared.manager.id 직접 참조(FK). media.ref_manager 는 이 테이블의 래퍼 VIEW. 담당자 삭제 시 NULL 처리됩니다.';
COMMENT ON COLUMN media.client.manager_id_second IS '부 담당 매니저 ID. shared.manager.id 직접 참조(FK). 2명의 담당자를 지원하기 위한 보조 컬럼. NULL 이면 부 담당자 미지정. 담당자 삭제 시 NULL 처리됩니다.';
COMMENT ON COLUMN media.client.contact_name      IS '매체사 측 담당자 이름 (내부 매니저가 아닌 매체사 측 연락 담당자).';
COMMENT ON COLUMN media.client.contact_phone     IS '매체사 측 담당자 전화번호.';
COMMENT ON COLUMN media.client.contact_email     IS '매체사 측 담당자 이메일.';
COMMENT ON COLUMN media.client.is_active         IS '활성 여부. false 이면 UI에서 기본 숨김. 과거 데이터는 보존됩니다.';
COMMENT ON COLUMN media.client.created_at        IS '레코드 최초 생성 시각 (UTC).';
COMMENT ON COLUMN media.client.updated_at        IS '레코드 최종 수정 시각 (UTC). trg_client_updated_at 트리거가 자동 갱신합니다.';

-- Auto-update updated_at on every row modification
CREATE TRIGGER trg_client_updated_at
  BEFORE UPDATE ON media.client
  FOR EACH ROW EXECUTE FUNCTION media.set_updated_at();
