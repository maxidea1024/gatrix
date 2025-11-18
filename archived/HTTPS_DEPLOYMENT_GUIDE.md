# HTTPS 배포 가이드

## 개요

Gatrix는 클라우드 환경에서 HTTPS를 통해 안전하게 배포할 수 있도록 설계되었습니다.
이 가이드는 `https://uwocngatrixcbt.dorado.zjshulong.com`과 같은 도메인으로 배포하는 방법을 설명합니다.

## 전제 조건

- 클라우드 로드 밸런서 또는 리버스 프록시에서 SSL/TLS 종료 처리
- 도메인 이름 (예: `uwocngatrixcbt.dorado.zjshulong.com`)
- Docker 및 Docker Compose 설치

## 자동 설정 (권장)

### 1. setup-env.sh 스크립트 사용

```bash
./setup-env.sh <DOMAIN> production ko --protocol https --force --nobackup
```

**예시:**
```bash
./setup-env.sh uwocngatrixcbt.dorado.zjshulong.com production ko --protocol https --force --nobackup
```

이 명령은 자동으로 다음을 설정합니다:
- ✅ `CORS_ORIGIN=https://uwocngatrixcbt.dorado.zjshulong.com` (표준 포트 443)
- ✅ `FRONTEND_URL=https://uwocngatrixcbt.dorado.zjshulong.com` (표준 포트 443)
- ✅ `VITE_GRAFANA_URL=https://uwocngatrixcbt.dorado.zjshulong.com/grafana` (서브패스)
- ✅ `VITE_BULL_BOARD_URL=https://uwocngatrixcbt.dorado.zjshulong.com/bull-board` (서브패스)
- ✅ 모든 호스트 포트 매핑 (50000번대)

**중요:** Production 환경에서는 표준 HTTPS 포트(443)를 사용하므로 URL에 포트 번호가 포함되지 않습니다.

### 2. Docker 서비스 시작

```bash
docker-compose down
docker-compose up -d
```

## 클라우드 설정

### 필수 포트 노출

클라우드 로드 밸런서에서 다음과 같이 포트 포워딩을 설정해야 합니다:

| 외부 접근 | 내부 포트 | 용도 | 비고 |
|----------|----------|------|------|
| `https://domain.com/` | 53000 | 웹 애플리케이션 (Frontend) | 기본 경로 |
| `https://domain.com/grafana` | 54000 | 모니터링 대시보드 (Grafana) | 별도 포트 포워딩 필요 |
| `https://domain.com/bull-board` | 53000 | 큐 모니터링 (Bull Board) | Frontend와 동일 포트 사용 |

**중요:**
- 외부에서는 표준 HTTPS 포트(443)로 접근
- **Grafana만 별도 포트(54000) 포워딩 필요** - `/grafana` 경로로 접근 시 54000 포트로 전달
- **Bull Board는 별도 포워딩 불필요** - Frontend(53000)에서 `/bull-board` 경로로 서비스됨
- 로드 밸런서에서 경로 기반 라우팅 설정 필요

### 로드 밸런서 설정 예시

**텐센트 클라우드 CLB (Cloud Load Balancer):**
```
리스너: HTTPS:443 (SSL 인증서 연결)
  - 전달 규칙 1: 도메인 = uwocngatrixcbt.dorado.zjshulong.com, URL = /grafana*
    → 백엔드 서버: CVM:54000 (Grafana 전용)
    → 상태 확인: HTTP GET /grafana/api/health
  - 전달 규칙 2: 도메인 = uwocngatrixcbt.dorado.zjshulong.com, URL = /*
    → 백엔드 서버: CVM:53000 (Frontend + Bull Board)
    → 상태 확인: HTTP GET /api/health
    → 참고: /bull-board 경로도 이 규칙으로 처리됨

세션 유지: 활성화 (30초)
X-Forwarded-For: 활성화
```

**참고:** Bull Board는 Frontend Nginx에서 `/bull-board` 경로로 프록시되므로 별도의 CLB 규칙이 필요하지 않습니다.

**AWS Application Load Balancer:**
```
Listener: HTTPS:443 (SSL Certificate attached)
  - Rule 1: Path = /grafana*
    → Target Group: EC2:54000 (Grafana only)
    → Path Pattern: /grafana* → /
  - Rule 2: Path = /*
    → Target Group: EC2:53000 (Frontend + Bull Board)
    → Default action
    → Note: /bull-board path is handled by this rule
```

**참고:** Bull Board는 Frontend Nginx에서 `/bull-board` 경로로 프록시되므로 별도의 ALB 규칙이 필요하지 않습니다.

**Nginx Reverse Proxy:**
```nginx
server {
    listen 443 ssl http2;
    server_name uwocngatrixcbt.dorado.zjshulong.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # Grafana (별도 포트 포워딩)
    location /grafana/ {
        proxy_pass http://localhost:54000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }

    # Frontend + Bull Board (동일 포트)
    # /bull-board 경로는 Frontend Nginx에서 처리됨
    location / {
        proxy_pass http://localhost:53000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }
}
```

## 확인 사항

### 1. 환경 변수 확인

```bash
grep -E "CORS_ORIGIN|FRONTEND_URL|VITE_GRAFANA|VITE_BULL" .env
```

**예상 출력:**
```
CORS_ORIGIN=https://uwocngatrixcbt.dorado.zjshulong.com
FRONTEND_URL=https://uwocngatrixcbt.dorado.zjshulong.com
VITE_GRAFANA_URL=https://uwocngatrixcbt.dorado.zjshulong.com/grafana
VITE_BULL_BOARD_URL=https://uwocngatrixcbt.dorado.zjshulong.com/bull-board
```

**주의:** Production 환경에서는 포트 번호가 포함되지 않습니다 (표준 HTTPS 포트 443 사용).

### 2. 서비스 상태 확인

```bash
docker ps --filter "name=gatrix" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

모든 서비스가 `healthy` 상태여야 합니다.

### 3. Grafana 임베딩 확인

Grafana가 iframe 임베딩을 허용하는지 확인:

```bash
docker exec gatrix-grafana env | grep GF_SECURITY
```

**예상 출력:**
```
GF_SECURITY_ALLOW_EMBEDDING=true
GF_SECURITY_COOKIE_SAMESITE=Lax
```

## 접속 URL

사용자는 다음 URL로 접근합니다 (포트 번호 없음):

- **Frontend**: https://uwocngatrixcbt.dorado.zjshulong.com
- **Grafana**: https://uwocngatrixcbt.dorado.zjshulong.com/grafana
- **Bull Board**: https://uwocngatrixcbt.dorado.zjshulong.com/bull-board

**내부 포트 매핑:**
- Frontend: 443 → 53000
- Grafana: 443/grafana → 54000

## 문제 해결

### Grafana iframe이 표시되지 않음

**증상:** "Refused to display in a frame because it set 'X-Frame-Options' to 'deny'"

**해결:**
```bash
docker-compose restart grafana
```

### CORS 오류

**증상:** "Access to XMLHttpRequest has been blocked by CORS policy"

**해결:**
1. `.env` 파일에서 `CORS_ORIGIN` 확인
2. Backend 재시작: `docker-compose restart backend`

### Bull Board 접근 불가

**증상:** 404 Not Found

**해결:**
1. Backend 로그 확인: `docker logs gatrix-backend --tail 50`
2. Bull Board 경로 확인: `/bull-board`

## 보안 권장 사항

1. ✅ **HTTPS 강제**: 클라우드에서 HTTP → HTTPS 리다이렉트 설정
2. ✅ **방화벽**: 필요한 포트만 외부에 노출
3. ✅ **인증서**: Let's Encrypt 또는 상용 SSL 인증서 사용
4. ✅ **비밀번호**: `.env`의 `ADMIN_PASSWORD` 변경
5. ✅ **시크릿**: JWT_SECRET, SESSION_SECRET 등 자동 생성된 값 유지

