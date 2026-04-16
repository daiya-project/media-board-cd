# 필수 규칙 — 이 파일의 지시를 반드시 따른다

이 프로젝트는 LiteLLM Code Deploy 플랫폼 위에서 실행된다. **아래 가이드의 절차와 제약을 무시하면 빌드/배포가 실패한다.**

- continue.md가 있으면 요구사항과 설계를 참고하되, **빌드/배포 절차는 반드시 이 파일의 가이드를 따른다**
- Dockerfile, health check, 포트, 인증, 환경변수 설정은 이 가이드가 정한 방식만 사용한다
- 가이드 섹션이 필요하면 아래 테이블의 curl 명령으로 가져와서 읽은 뒤 진행한다

---

# Dashboard — Development Guide

이 프로젝트는 **LiteLLM Code Deploy** 플랫폼에서 Docker 컨테이너로 실행되는 웹 대시보드입니다.

- **Type**: Dashboard
- **Deployment ID**: `9605fb4a-80be-4c1a-b5f7-49d572b2f42a`
- **Port**: `{{port}}`
- **Health Path**: `{{health_path}}`

## 배포 환경

- Docker 컨테이너로 빌드·배포됩니다. 프로젝트 루트에 `Dockerfile`이 반드시 필요합니다.
- 자동 주입 환경변수: LITELLM_BASE_URL, DEPLOYMENT_ID
- Agent/MCP 배포: LITELLM_API_KEY 자동 주입 (배포에 API 키가 할당된 경우. 주입되지 않으면 LLM 호출 섹션의 OAuth 또는 env_vars 설정을 참고)

### Dockerfile 제약조건

컨테이너는 **non-root (uid 1000)** 으로 실행됩니다. Dockerfile 작성 시 반드시 지켜야 할 사항:

- `USER 1000` 또는 비-root 사용자를 사용. 플랫폼이 `runAsUser: 1000`, `runAsNonRoot: true`를 강제합니다.
- **`gosu`, `su`, `sudo` 사용 불가** — `allowPrivilegeEscalation: false`가 설정되어 있어 권한 상승이 차단됩니다.
- `entrypoint.sh`에서 `chown`, `chmod` 등 root 권한이 필요한 명령을 실행할 수 없습니다. 파일 권한은 빌드 시점에 설정하세요.
- 앱이 쓰기가 필요한 디렉토리(로그, 캐시, tmp)는 빌드 시 `RUN mkdir -p /app/tmp && chown 1000:1000 /app/tmp`로 미리 생성합니다.
- PV(Persistent Volume)를 사용하면 `fsGroup: 1000`이 자동 설정되어 마운트된 볼륨에 쓰기 가능합니다.
- **`ENV HOME=/app` 필수** — 많은 라이브러리(Streamlit, matplotlib 등)가 `$HOME`에 설정 파일을 쓴다. non-root에서 `HOME=/`(기본값)이면 `PermissionError`가 발생한다.

```dockerfile
# 예시: Python non-root Dockerfile
FROM python:3.12-slim
WORKDIR /app
ENV HOME=/app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
RUN chown -R 1000:1000 /app
USER 1000
CMD ["python", "server.py"]
```

```dockerfile
# 예시: Node.js non-root Dockerfile
FROM node:20-slim
WORKDIR /app
ENV HOME=/app
COPY package.json .
RUN npm install --omit=dev
COPY . .
RUN chown -R 1000:1000 /app
USER 1000
CMD ["node", "server.js"]
```

### Git Remote 주의사항

프로젝트는 플랫폼의 Git 저장소에 push하여 빌드를 트리거합니다. 주의할 점:

- `entrypoint.sh`에서 `git clone`이나 `git reset --hard`로 `/app`을 덮어쓰면 Docker 이미지에 포함된 코드가 사라집니다.
- 런타임에 git 작업이 필요하면 `/app`이 아닌 별도 디렉토리(예: `/data/repo`)를 사용하세요.

### ServiceAccount / IRSA

각 배포마다 K8s ServiceAccount가 자동 생성됩니다 (이름: deployment name 기반). AWS IRSA(IAM Role 연동)가 필요하면 정보보호팀에 요청하세요.

- Custom domain 설정 가능: `<subdomain>.dllm.dable.io` (와일드카드 DNS로 즉시 접속 가능)
- `APP_URL` 환경변수로 현재 앱의 외부 URL이 자동 주입됩니다 (예: `https://my-app.dllm.dable.io`)

## 필수 작업 순서

1. Health Check 설정 (프레임워크별 포트/경로 확인)
2. Dockerfile 작성
3. 필요 시: OAuth 설정, SSO 연동, Credential 등록, PV 설정, MCP 서버 연결, 환경변수 설정
4. 빌드/배포 (3단계 설정 후 빌드해야 환경변수가 반영됨)
5. 배포 후 검증

## 주의사항

- 앱의 리슨 포트는 배포 설정의 `port` 값과 반드시 일치해야 합니다
- non-root (uid 1000) 환경에서 실행됩니다
- `ENV HOME=/app`을 Dockerfile에 반드시 설정하세요

## 가이드 섹션

아래 테이블에서 필요한 섹션을 개별 조회할 수 있습니다.

| 섹션 | 설명 | 조회 |
|------|------|------|
| 빌드/배포 API | 파일 관리, 빌드, 배포, 인증 설정 | `curl -s "https://litellm.internal.dable.io/v1/code-deployment-templates/guide?deployment_id=9605fb4a-80be-4c1a-b5f7-49d572b2f42a&section=deploy-api" -H "Authorization: Bearer $LITELLM_PAT"` |
| Health Check | 타입별 Health Check 설정 | `curl -s "https://litellm.internal.dable.io/v1/code-deployment-templates/guide?deployment_id=9605fb4a-80be-4c1a-b5f7-49d572b2f42a&section=health-check" -H "Authorization: Bearer $LITELLM_PAT"` |
| 도구 탐색 | 스킬/MCP 서버 자동 탐색 | `curl -s "https://litellm.internal.dable.io/v1/code-deployment-templates/guide?deployment_id=9605fb4a-80be-4c1a-b5f7-49d572b2f42a&section=tool-discovery" -H "Authorization: Bearer $LITELLM_PAT"` |
| Credentials | 민감정보 관리 (Custom Credential) | `curl -s "https://litellm.internal.dable.io/v1/code-deployment-templates/guide?deployment_id=9605fb4a-80be-4c1a-b5f7-49d572b2f42a&section=credentials" -H "Authorization: Bearer $LITELLM_PAT"` |
| MySQL | MySQL Database 설정 및 사용 | `curl -s "https://litellm.internal.dable.io/v1/code-deployment-templates/guide?deployment_id=9605fb4a-80be-4c1a-b5f7-49d572b2f42a&section=mysql" -H "Authorization: Bearer $LITELLM_PAT"` |
| 환경변수 | 평문 환경변수 설정 | `curl -s "https://litellm.internal.dable.io/v1/code-deployment-templates/guide?deployment_id=9605fb4a-80be-4c1a-b5f7-49d572b2f42a&section=env-vars" -H "Authorization: Bearer $LITELLM_PAT"` |
| HPA | 자동 스케일링 설정 | `curl -s "https://litellm.internal.dable.io/v1/code-deployment-templates/guide?deployment_id=9605fb4a-80be-4c1a-b5f7-49d572b2f42a&section=hpa" -H "Authorization: Bearer $LITELLM_PAT"` |
| PV | 영구 저장소 설정 | `curl -s "https://litellm.internal.dable.io/v1/code-deployment-templates/guide?deployment_id=9605fb4a-80be-4c1a-b5f7-49d572b2f42a&section=pv" -H "Authorization: Bearer $LITELLM_PAT"` |
| SSO | Google SSO 연동 | `curl -s "https://litellm.internal.dable.io/v1/code-deployment-templates/guide?deployment_id=9605fb4a-80be-4c1a-b5f7-49d572b2f42a&section=sso" -H "Authorization: Bearer $LITELLM_PAT"` |
| MCP 연동 | MCP 서버 도구 호출 | `curl -s "https://litellm.internal.dable.io/v1/code-deployment-templates/guide?deployment_id=9605fb4a-80be-4c1a-b5f7-49d572b2f42a&section=mcp" -H "Authorization: Bearer $LITELLM_PAT"` |
| 검증 | 배포 후 검증 절차 | `curl -s "https://litellm.internal.dable.io/v1/code-deployment-templates/guide?deployment_id=9605fb4a-80be-4c1a-b5f7-49d572b2f42a&section=verify" -H "Authorization: Bearer $LITELLM_PAT"` |
| 트러블슈팅 | 문제 해결 가이드 | `curl -s "https://litellm.internal.dable.io/v1/code-deployment-templates/guide?deployment_id=9605fb4a-80be-4c1a-b5f7-49d572b2f42a&section=troubleshooting" -H "Authorization: Bearer $LITELLM_PAT"` |


## continue.md

`continue.md` 파일이 프로젝트 루트에 존재하면 읽는다. 이전 세션의 요구사항과 설계가 기록되어 있다. 단, 빌드/배포 절차는 위 가이드가 우선한다.

## 온보딩

`onboarding` 플러그인이 설치되어 있으면 `/onboarding:setup`을 실행하여 프로젝트 초기 설정을 진행할 수 있다.

설치 (최초 1회):
```
claude plugin marketplace add https://litellm.internal.dable.io/claude-code/marketplace.json
claude plugin install onboarding@litellm
```

이미 onboarding을 실행한 프로젝트에서는 이 단계를 건너뛴다.
