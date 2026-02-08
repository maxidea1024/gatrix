---
sidebar_position: 2
---

# 설치 가이드

Gatrix 설치 방법을 상세히 안내합니다.

## 개발 환경 설정

### 1. 사전 요구사항

- **Node.js 22+** - [nodejs.org](https://nodejs.org/)에서 LTS 버전을 설치하세요.
- **Yarn 1.22+** - `npm install -g yarn`
- **Docker Desktop** - [docker.com](https://docker.com/)에서 설치하세요.
- **Git** - 버전 관리

### 2. 저장소 클론

```bash
git clone https://github.com/your-org/gatrix.git
cd gatrix
```

### 3. 의존성 설치

```bash
yarn install
```

### 4. 환경 변수 설정

```bash
# 환경 파일 복사
cp .env.example .env.local
```

`.env.local` 파일을 편집하여 설정합니다:

```env
# 데이터베이스 (Docker 인프라 사용 시 기본값 유지)
DB_HOST=localhost
DB_PORT=43306
DB_NAME=gatrix
DB_USER=gatrix_user
DB_PASSWORD=gatrix_password

# Redis
REDIS_HOST=localhost
REDIS_PORT=46379

# JWT 시크릿 (프로덕션에서는 반드시 변경!)
JWT_SECRET=your-jwt-secret
JWT_REFRESH_SECRET=your-refresh-secret

# 관리자 계정
ADMIN_EMAIL=admin@gatrix.com
ADMIN_PASSWORD=admin123
```

### 5. 인프라 시작

**옵션 A: Docker 인프라만 (권장)**

```bash
yarn infra:up
```

**옵션 B: 전체 Docker 환경**

```bash
docker compose -f docker-compose.dev.yml up -d
```

### 6. 데이터베이스 마이그레이션

```bash
yarn migrate
```

### 7. 개발 서버 시작

```bash
# 기본 서비스 (Backend + Frontend + Edge)
yarn dev

# 모든 서비스 포함
yarn dev:all
```

## 전체 Docker 환경

모든 서비스를 Docker에서 실행하려면:

```bash
docker compose -f docker-compose.dev.yml up -d
```

### 포함된 서비스

| 서비스      | 컨테이너               | 포트         |
| ----------- | ---------------------- | ------------ |
| MySQL       | gatrix-mysql-dev       | 43306        |
| Redis       | gatrix-redis-dev       | 46379        |
| etcd        | gatrix-etcd-dev        | (내부)       |
| ClickHouse  | gatrix-clickhouse-dev  | 48123, 49000 |
| Backend     | gatrix-backend-dev     | 45000        |
| Frontend    | gatrix-frontend-dev    | 43000        |
| Edge        | gatrix-edge-dev        | 3400         |
| Chat Server | gatrix-chat-server-dev | 45100        |
| Event Lens  | gatrix-event-lens-dev  | 45200        |
| Loki        | gatrix-loki-dev        | 43100        |
| Prometheus  | gatrix-prometheus-dev  | 49090        |
| Grafana     | gatrix-grafana-dev     | 44000        |

## 프로덕션 배포

프로덕션 환경에서는 Docker 이미지를 빌드합니다:

```bash
# 빌드
yarn build

# Docker 이미지 빌드
docker build -t gatrix-backend -f packages/backend/Dockerfile .
docker build -t gatrix-frontend -f packages/frontend/Dockerfile .
docker build -t gatrix-edge -f packages/edge/Dockerfile .
docker build -t gatrix-chat-server -f packages/chat-server/Dockerfile .
docker build -t gatrix-event-lens -f packages/event-lens/Dockerfile .
```

자세한 배포 방법은 [Docker 배포 가이드](../deployment/docker)를 참고하세요.
