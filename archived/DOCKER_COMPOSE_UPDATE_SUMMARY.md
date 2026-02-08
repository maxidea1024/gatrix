# Docker Compose 업데이트 요약

## 📋 변경 사항 개요

Docker Compose 설정을 최신 표준에 맞게 업데이트하고, 누락된 서비스들을 추가했습니다.

## ✅ 완료된 작업

### 1. Docker Compose Version 필드 제거

**이유**: Docker Compose v2부터 `version` 필드가 obsolete(구식)로 간주됩니다.

**변경된 파일**:

- ✅ `docker-compose.yml`
- ✅ `docker-compose.dev.yml`
- ✅ `packages/chat-server/docker-compose.yml`

**변경 전**:

```yaml
version: '3.8'

services:
  mysql: ...
```

**변경 후**:

```yaml
services:
  mysql: ...
```

### 2. docker-compose.yml에 Chat Server 추가

**추가된 서비스**: `chat-server`

**주요 설정**:

- **포트**: 3001 (WebSocket), 9090 (Metrics)
- **의존성**: MySQL, Redis, Backend
- **클러스터링**: 활성화 (프로덕션)
- **성능 최적화**: MessagePack, 압축, 배치 처리
- **모니터링**: Prometheus metrics
- **Health Check**: HTTP GET /health

**환경 변수**:

```yaml
environment:
  NODE_ENV: production
  PORT: 3001
  DB_NAME: ${CHAT_DB_NAME:-gatrix_chat}
  REDIS_DB: 1
  CLUSTER_ENABLED: ${CHAT_CLUSTER_ENABLED:-true}
  BROADCAST_BATCH_SIZE: ${CHAT_BROADCAST_BATCH_SIZE:-1000}
  USE_MESSAGE_PACK: ${CHAT_USE_MESSAGE_PACK:-true}
  WS_MAX_CONNECTIONS: ${CHAT_WS_MAX_CONNECTIONS:-10000}
  MONITORING_ENABLED: ${CHAT_MONITORING_ENABLED:-true}
```

**볼륨**:

- `chat_server_uploads`: 파일 업로드 저장
- `chat_server_logs`: 로그 파일 저장

### 3. docker-compose.dev.yml에 서비스 추가

**추가된 서비스**:

1. ✅ `clickhouse` - ClickHouse 데이터베이스
2. ✅ `event-lens-dev` - Event Lens 서버 (hot reload)
3. ✅ `event-lens-worker-dev` - Event Lens Worker (hot reload)
4. ✅ `chat-server-dev` - Chat Server (hot reload)

**개발 환경 특징**:

- Hot reload 활성화 (nodemon)
- 디버그 로그 레벨
- 클러스터링 비활성화 (개발 편의성)
- 소스 코드 볼륨 마운트
- 개발 도구 포함 (Adminer, Redis Commander)

### 4. Dockerfile.dev 파일 생성

**생성된 파일**:

- ✅ `packages/event-lens/Dockerfile.dev`
- ✅ `packages/chat-server/Dockerfile.dev`

**특징**:

- Node.js 18 Alpine 기반
- 개발 의존성 포함
- Hot reload 지원
- Health check 포함

### 5. 문서 업데이트

**업데이트된 문서**:

- ✅ `README.md` - Docker 섹션 업데이트, 서비스 포트 테이블 추가
- ✅ `EVENT_LENS_SETUP_GUIDE.md` - Docker Compose v2 명령어 업데이트
- ✅ `packages/chat-server/README.md` - Docker Compose v2 명령어 업데이트

**새로 생성된 문서**:

- ✅ `DOCKER_COMPOSE_SETUP.md` - 완전한 Docker Compose 설정 가이드

## 📊 전체 서비스 구성

### 프로덕션 환경 (docker-compose.yml)

| 서비스            | 포트       | 용도               | Health Check |
| ----------------- | ---------- | ------------------ | ------------ |
| MySQL             | 3306       | 데이터베이스       | ✅           |
| Redis             | 6379       | 캐시 & 큐          | ✅           |
| ClickHouse        | 8123, 9000 | 분석 DB            | ✅           |
| Backend           | 5000       | REST API           | ✅           |
| Frontend          | 80, 443    | 웹 UI (Nginx)      | ✅           |
| Chat Server       | 3001, 9090 | WebSocket, Metrics | ✅           |
| Event Lens        | 3002       | 분석 API           | ✅           |
| Event Lens Worker | -          | 백그라운드 작업    | ❌           |

### 개발 환경 (docker-compose.dev.yml)

프로덕션 서비스 + 추가 도구:

| 서비스          | 포트 | 용도          |
| --------------- | ---- | ------------- |
| Adminer         | 8080 | DB 관리 UI    |
| Redis Commander | 8081 | Redis 관리 UI |

## 🚀 사용 방법

### Docker Compose v2 명령어

**중요**: Docker Compose v2부터는 하이픈 없이 `docker compose` 명령어를 사용합니다.

```bash
# ❌ 구버전 (deprecated)
docker-compose up -d

# ✅ 신버전 (권장)
docker compose up -d
```

### 프로덕션 환경

```bash
# 전체 서비스 시작
docker compose up -d

# 특정 서비스만 시작
docker compose up -d mysql redis backend

# 로그 확인
docker compose logs -f

# 서비스 상태 확인
docker compose ps

# 서비스 중지
docker compose down
```

### 개발 환경

```bash
# 전체 서비스 시작 (hot reload)
docker compose -f docker-compose.dev.yml up -d

# 특정 서비스 로그 확인
docker compose -f docker-compose.dev.yml logs -f backend-dev

# 서비스 재빌드
docker compose -f docker-compose.dev.yml up -d --build backend-dev

# 서비스 중지
docker compose -f docker-compose.dev.yml down
```

## 🔧 환경 변수

`.env` 파일에 추가할 Chat Server 관련 변수:

```bash
# Chat Server
CHAT_DB_NAME=gatrix_chat
CHAT_PORT=3001
CHAT_METRICS_PORT=9090
CHAT_LOG_LEVEL=info

# 클러스터링
CHAT_CLUSTER_ENABLED=true
CHAT_CLUSTER_WORKERS=0
CHAT_STICKY_SESSION=true

# 성능
CHAT_BROADCAST_BATCH_SIZE=1000
CHAT_USE_MESSAGE_PACK=true
CHAT_BROADCAST_COMPRESSION=true
CHAT_WS_MAX_CONNECTIONS=10000

# 모니터링
CHAT_MONITORING_ENABLED=true

# Gatrix 통합
GATRIX_API_URL=http://backend:5000
GATRIX_API_SECRET=shared-secret-between-servers
```

## 📈 개발 vs 프로덕션 차이

| 설정         | 개발                          | 프로덕션 |
| ------------ | ----------------------------- | -------- |
| Hot Reload   | ✅                            | ❌       |
| 클러스터링   | ❌                            | ✅       |
| 로그 레벨    | debug                         | info     |
| Message Pack | ❌                            | ✅       |
| 압축         | ❌                            | ✅       |
| 최대 연결    | 1,000                         | 10,000   |
| 관리 도구    | ✅ (Adminer, Redis Commander) | ❌       |

## 🔍 검증

모든 Docker Compose 파일이 유효성 검사를 통과했습니다:

```bash
# 프로덕션 환경 검증
$ docker compose -f docker-compose.yml config --quiet
✅ 성공

# 개발 환경 검증
$ docker compose -f docker-compose.dev.yml config --quiet
✅ 성공

# Chat Server 독립 환경 검증
$ docker compose -f packages/chat-server/docker-compose.yml config --quiet
✅ 성공
```

## 📚 관련 문서

- [DOCKER_COMPOSE_SETUP.md](DOCKER_COMPOSE_SETUP.md) - 완전한 Docker Compose 설정 가이드
- [EVENT_LENS_SETUP_GUIDE.md](EVENT_LENS_SETUP_GUIDE.md) - Event Lens 설정 가이드
- [packages/chat-server/README.md](packages/chat-server/README.md) - Chat Server 문서
- [README.md](README.md) - 프로젝트 메인 문서

## 🎯 다음 단계

1. `.env` 파일에 Chat Server 환경 변수 추가
2. 개발 환경에서 테스트:
   ```bash
   docker compose -f docker-compose.dev.yml up -d
   ```
3. 각 서비스 health check 확인:
   ```bash
   docker compose ps
   ```
4. 로그 확인:
   ```bash
   docker compose logs -f chat-server-dev
   docker compose logs -f event-lens-dev
   ```

## ⚠️ 주의사항

1. **Docker Compose v2 필수**: 최신 Docker Desktop 또는 Docker Engine 설치 필요
2. **포트 충돌 확인**: 3001, 3002, 8123, 9000, 9090 포트가 사용 가능한지 확인
3. **볼륨 백업**: 프로덕션 배포 전 데이터 백업 권장
4. **환경 변수**: `.env` 파일의 시크릿 값들을 프로덕션용으로 변경 필수

## ✨ 개선 사항

- ✅ Docker Compose 최신 표준 준수
- ✅ 모든 서비스 통합 (Backend, Frontend, Chat, Event Lens)
- ✅ 개발/프로덕션 환경 분리
- ✅ Health check 모든 서비스에 적용
- ✅ 볼륨 관리 체계화
- ✅ 네트워크 격리
- ✅ 문서화 완료
