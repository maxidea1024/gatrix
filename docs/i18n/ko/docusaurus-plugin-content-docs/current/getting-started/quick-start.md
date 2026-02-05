---
sidebar_position: 1
---

# 빠른 시작

Gatrix를 빠르게 시작하는 방법을 안내합니다.

## 요구 사항

- **Node.js 22+** (v22.16.0 권장)
- **Yarn 1.22+** (패키지 매니저)
- **Docker & Docker Compose** (인프라 구성용)

:::info Docker Compose 서비스
Docker Compose 개발 환경에서는 다음 서비스들이 자동으로 구성됩니다:
- MySQL 8.0 (데이터베이스)
- Redis 7 Alpine (캐시 및 메시지 큐)
- etcd v3.5 (서비스 디스커버리)
- ClickHouse (분석용 데이터베이스)
- Prometheus / Grafana (모니터링)
- Loki / Fluent Bit (로그 수집)
:::

## 로컬 개발 환경 시작하기

### 1. 저장소 클론

```bash
git clone https://github.com/your-org/gatrix.git
cd gatrix
```

### 2. 의존성 설치

```bash
yarn install
```

### 3. 환경 변수 설정

```bash
cp .env.example .env.local
```

### 4. 인프라 시작 (Docker)

```bash
# MySQL, Redis만 시작 (로컬 개발용)
yarn infra:up

# 또는 전체 Docker 환경 시작
docker compose -f docker-compose.dev.yml up -d
```

### 5. 데이터베이스 마이그레이션

```bash
yarn migrate
```

### 6. 개발 서버 시작

```bash
# 기본 (Backend + Frontend + Edge)
yarn dev

# 또는 모든 서비스 시작
yarn dev:all
```

## 접속하기

개발 서버가 시작되면:

| 서비스 | URL | 포트 |
|--------|-----|------|
| **Frontend Dashboard** | http://localhost:43000 | 43000 |
| **Backend API** | http://localhost:45000 | 45000 |
| **Edge Server** | http://localhost:3400 | 3400 |
| **Chat Server** | http://localhost:45100 | 45100 |
| **Event Lens** | http://localhost:45200 | 45200 |
| **Grafana** | http://localhost:44000 | 44000 |
| **Prometheus** | http://localhost:49090 | 49090 |

## 기본 관리자 계정

첫 실행 시 기본 관리자 계정이 생성됩니다:

- **이메일**: admin@gatrix.com
- **비밀번호**: admin123

:::warning 보안 주의
프로덕션 환경에서는 반드시 `.env` 파일에서 기본 비밀번호를 변경하세요!
```env
ADMIN_EMAIL=your-admin@example.com
ADMIN_PASSWORD=your-secure-password
```
:::

## 주요 명령어

```bash
# 개발 서버
yarn dev              # Backend + Frontend + Edge
yarn dev:all          # 모든 서비스 (Chat, Event Lens 포함)
yarn dev:backend      # Backend만
yarn dev:frontend     # Frontend만

# 빌드
yarn build            # 전체 빌드
yarn build:backend    # Backend 빌드
yarn build:frontend   # Frontend 빌드

# 테스트
yarn test             # 전체 테스트
yarn lint             # 린트 검사
yarn lint:fix         # 린트 자동 수정

# 마이그레이션
yarn migrate          # 마이그레이션 실행
yarn migrate:status   # 마이그레이션 상태 확인

# 인프라
yarn infra:up         # 인프라 시작
yarn infra:down       # 인프라 중지
```

## 다음 단계

- [설치 가이드](./installation) - 상세 설치 방법
- [설정 가이드](./configuration) - 환경 설정
- [피처 플래그](../features/feature-flags) - 첫 번째 피처 플래그 생성
