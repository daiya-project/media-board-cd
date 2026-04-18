-- =============================================================================
-- Migration: Create media.daily_failed table
-- Date: 2026-02-25 (renamed from daily_data_failed: import_log FK removed)
-- Depends on: (none — intentionally no FK constraints)
-- =============================================================================
--
-- Purpose:
--   CSV 임포트 과정에서 유효성 검사에 실패하거나 삽입 오류가 발생한 행을
--   격리(quarantine)하여 저장합니다. 운영자가 실패 원인을 분석하고
--   데이터를 수정한 후 재처리할 수 있도록 지원합니다.
--
-- Business context:
--   CSV 임포트 시 일부 행은 다음과 같은 이유로 daily 에 삽입되지 않을 수 있습니다:
--   - client_id / service_id 가 화이트리스트에 없는 미등록 거래처
--   - 필수 컬럼 누락 또는 형식 오류 (날짜, 숫자 파싱 실패)
--   - PK 중복 (동일 날짜/매체/서비스/위젯 조합 재입력)
--   이 테이블은 그러한 실패 행을 모두 보관하며, 각 행에 오류 메시지를 첨부합니다.
--
-- Design: Intentionally no FK constraints on data columns
--   daily 와 동일한 컬럼 구조를 가지지만, 모든 데이터 컬럼이 NULL 허용입니다.
--   FK 제약을 걸지 않은 이유: 실패의 원인 자체가 참조 무결성 위반일 수 있으며,
--   제약이 있으면 실패 행 자체를 이 테이블에도 저장할 수 없게 됩니다.
--
-- Note: import_log_id is intentionally omitted.
--   import_log 기능이 앱 레이어에서 제거되어 FK 참조가 불필요합니다.
-- =============================================================================

CREATE TABLE media.daily_failed (
  id              BIGSERIAL     PRIMARY KEY,                     -- Auto-increment PK
  -- Mirror of daily columns — all nullable (no FK constraints by design)
  date            DATE,
  client_id       TEXT,
  service_id      TEXT,
  widget_id       TEXT,
  widget_name     TEXT,
  cost_spent      NUMERIC(15, 4),
  pub_profit      NUMERIC(15, 4),
  imp             BIGINT,
  vimp            BIGINT,
  cnt_click       BIGINT,
  cnt_cv          BIGINT,
  -- Failure metadata
  error_message   TEXT          NOT NULL,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

COMMENT ON TABLE media.daily_failed IS
  'CSV 임포트 실패 행 격리(quarantine) 테이블. '
  'daily 와 동일한 컬럼 구조를 가지지만 모든 데이터 컬럼이 NULL 허용이며 FK 제약이 없습니다. '
  '실패 원인 자체가 참조 무결성 위반일 수 있으므로 제약을 의도적으로 제거했습니다. '
  '운영자는 error_message 를 확인하고 원본 데이터 또는 마스터(client/service) 를 수정한 후 재임포트합니다.';

COMMENT ON COLUMN media.daily_failed.error_message IS
  '실패 원인. 예: "미등록 client_id: abc", "필수값 누락: date", "PK 중복". ';
