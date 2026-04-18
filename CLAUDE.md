# media-board-cd — Project Knowledge

프로젝트 도메인 지식과 Claude 에게 도움이 되는 컨텍스트를 기록한다. 배포/빌드/설정 관련 룰은 `CLAUDE.local.md` 를 참고한다.

## Domain — `client_id` 규칙

- `client_id` 는 **Dable 내부 시스템과 연결된 유니크 ID** 다 (OBI, Redash, data warehouse 등 사내 시스템과 동일 키 사용).
- **`90000`번대 (`90001`, `90002`, ...)** 는 **아직 고객사로 확보되지 않은 매체** 를 의미한다. 세일즈 파이프라인 관리 목적으로 선등록해 둔다.
  - 특징: OBI 에 매출/광고 연동 이력이 없음 → `media.service` 에 실제 service 가 붙지 않을 수 있다.
  - 예: KBS, 한국일보, 문화일보, 한겨레 등 (계약 전 단계).
- 일반 번호대 (5자리 이하) 는 실제 계약·연동된 매체.
