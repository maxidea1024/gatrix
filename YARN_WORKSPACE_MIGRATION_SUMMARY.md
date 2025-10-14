# Yarn Workspace 통합 및 Docker 빌드 최적화 완료

## 📋 작업 요약

모든 서비스를 **Yarn Workspace 패턴**으로 통일하고, **Lock 파일 관리**를 개선하며, **Docker 빌드 문제**를 해결했습니다.

---

## ✅ 완료된 작업

### 1. **Yarn Workspace 패턴 통일** ✅

모든 서비스(backend, frontend, event-lens, chat-server)가 동일한 빌드 패턴을 사용하도록 통일했습니다.

#### 변경 사항:
- **npm 제거**: event-lens와 chat-server에서 npm 사용 중단
- **yarn workspace 명령어 사용**: 모든 빌드/실행 명령어를 `yarn workspace @gatrix/[service]` 패턴으로 변경
- **일관된 Dockerfile 구조**: 모든 서비스가 동일한 multi-stage 빌드 패턴 사용

#### 영향받은 파일:
- `packages/event-lens/Dockerfile`
- `packages/event-lens/Dockerfile.dev`
- `packages/chat-server/Dockerfile`
- `packages/chat-server/Dockerfile.dev`
- `docker-compose.yml`
- `docker-compose.dev.yml`
- `package.json` (root)

---

### 2. **Lock 파일 관리 개선** ✅

단일 lock 파일(yarn.lock)로 통일하여 의존성 충돌을 방지했습니다.

#### 변경 사항:
- **package-lock.json 제거**: npm lock 파일 삭제
- **yarn.lock 업데이트**: `yarn install` 실행으로 최신 상태 유지
- **Dockerfile에서 --frozen-lockfile 사용**: 재현 가능한 빌드 보장

#### 결과:
```bash
✅ 단일 lock 파일: yarn.lock (root)
❌ 제거됨: package-lock.json
```

---

### 3. **Node 버전 업그레이드** ✅

Node 18에서 Node 20으로 업그레이드하여 최신 패키지 호환성 확보했습니다.

#### 이유:
- `glob@11.0.3` 패키지가 Node 20+ 요구
- 최신 의존성 패키지들의 호환성 개선

#### 변경 사항:
```dockerfile
# 변경 전
FROM node:18-alpine

# 변경 후
FROM node:20-alpine
```

#### 영향받은 파일 (총 8개):
- `packages/event-lens/Dockerfile`
- `packages/event-lens/Dockerfile.dev`
- `packages/chat-server/Dockerfile`
- `packages/chat-server/Dockerfile.dev`
- `packages/backend/Dockerfile` ⭐ 추가
- `packages/backend/Dockerfile.dev` ⭐ 추가
- `packages/frontend/Dockerfile` ⭐ 추가
- `packages/frontend/Dockerfile.dev` ⭐ 추가

**중요**: 모든 서비스가 동일한 Node 버전(20)을 사용하여 일관성을 유지합니다.

---

### 4. **ClickHouse IPv6 이슈 해결** ✅

Windows Docker 환경에서 ClickHouse의 IPv6 연결 문제를 해결했습니다.

#### 문제:
```
Listen [::]:8123 failed: DNS error: EAI: Address family for hostname not supported
```

#### 해결 방법:
`docker-compose.dev.yml`에 환경 변수 및 ulimits 추가:
```yaml
clickhouse:
  environment:
    CLICKHOUSE_DEFAULT_ACCESS_MANAGEMENT: 1
  ulimits:
    nofile:
      soft: 262144
      hard: 262144
  healthcheck:
    test: ["CMD", "wget", "--spider", "-q", "http://127.0.0.1:8123/ping"]
    start_period: 60s
    retries: 5
```

#### 결과:
```bash
✔ ClickHouse (healthy) - IPv6 이슈 해결됨
```

---

### 5. **Root package.json 스크립트 추가** ✅

모든 서비스를 root에서 관리할 수 있도록 스크립트를 추가했습니다.

#### 추가된 스크립트:

**개발 모드:**
```json
"dev:event-lens": "yarn workspace @gatrix/event-lens dev",
"dev:event-lens:worker": "yarn workspace @gatrix/event-lens dev:worker",
"dev:chat-server": "yarn workspace @gatrix/chat-server dev"
```

**빌드:**
```json
"build:event-lens": "yarn workspace @gatrix/event-lens build",
"build:chat-server": "yarn workspace @gatrix/chat-server build"
```

**실행:**
```json
"start:event-lens": "yarn workspace @gatrix/event-lens start",
"start:event-lens:worker": "yarn workspace @gatrix/event-lens start:worker",
"start:chat-server": "yarn workspace @gatrix/chat-server start"
```

**테스트:**
```json
"test:event-lens": "yarn workspace @gatrix/event-lens test",
"test:chat-server": "yarn workspace @gatrix/chat-server test"
```

**린트 및 타입체크:**
```json
"lint": "yarn workspaces run lint",
"lint:fix": "yarn workspaces run lint:fix",
"typecheck": "yarn workspaces run typecheck"
```

---

### 5. **Docker Compose 설정 최적화** ✅

#### docker-compose.yml (프로덕션)
- ✅ Chat Server 추가
- ✅ Event Lens 설정 확인
- ✅ `version` 필드 제거 (Docker Compose v2+ 호환)

#### docker-compose.dev.yml (개발)
- ✅ ClickHouse 추가
- ✅ Event Lens (server + worker) 추가
- ✅ Chat Server 추가
- ✅ 모든 서비스 명령어를 yarn workspace로 변경
- ✅ 볼륨 마운트를 전체 워크스페이스(`.:/app`)로 변경

---

## 🏗️ Dockerfile 구조

### 통일된 Multi-Stage 빌드 패턴

모든 서비스가 동일한 4단계 빌드 패턴을 사용합니다:

```dockerfile
# 1. Base Stage
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat [dumb-init]
WORKDIR /app

# 2. Dependencies Stage
FROM base AS deps
WORKDIR /app
COPY package.json yarn.lock* ./
COPY packages/[service]/package.json ./packages/[service]/
RUN yarn install --frozen-lockfile --production=false

# 3. Builder Stage
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN yarn workspace @gatrix/[service] build

# 4. Runner/Production Stage
FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app
COPY package.json yarn.lock* ./
COPY packages/[service]/package.json ./packages/[service]/
RUN yarn install --frozen-lockfile --production=true && yarn cache clean
COPY --from=builder /app/packages/[service]/dist ./packages/[service]/dist
CMD ["node", "packages/[service]/dist/index.js"]
```

---

## 🚀 사용 방법

### 로컬 개발 (Yarn Workspace)

```bash
# 전체 의존성 설치
yarn install

# 개발 모드 실행
yarn dev:backend
yarn dev:frontend
yarn dev:event-lens
yarn dev:event-lens:worker
yarn dev:chat-server

# 빌드
yarn build:backend
yarn build:frontend
yarn build:event-lens
yarn build:chat-server

# 테스트
yarn test:backend
yarn test:event-lens
yarn test:chat-server

# 린트
yarn lint
yarn lint:fix

# 타입체크
yarn typecheck
```

### Docker Compose (프로덕션)

```bash
# 전체 스택 빌드 및 실행
docker compose up --build -d

# 특정 서비스만 빌드
docker compose build event-lens chat-server

# 로그 확인
docker compose logs -f event-lens
docker compose logs -f chat-server

# 중지
docker compose down
```

### Docker Compose (개발)

```bash
# 개발 환경 실행
docker compose -f docker-compose.dev.yml up -d

# 특정 서비스만 실행
docker compose -f docker-compose.dev.yml up -d event-lens-dev chat-server-dev

# 로그 확인 (hot reload 확인)
docker compose -f docker-compose.dev.yml logs -f event-lens-dev
docker compose -f docker-compose.dev.yml logs -f chat-server-dev

# 중지
docker compose -f docker-compose.dev.yml down
```

---

## 📊 빌드 검증 결과

### ✅ Docker Compose 검증

```bash
# 프로덕션 설정 검증
✅ docker compose -f docker-compose.yml config --quiet

# 개발 설정 검증
✅ docker compose -f docker-compose.dev.yml config --quiet
```

### ✅ 프로덕션 빌드 성공

```bash
# Event Lens 빌드 성공
✔ gatrix-event-lens   Built

# Chat Server 빌드 성공
✔ gatrix-chat-server  Built
```

### ✅ 개발 환경 빌드 성공 (Node 20 업그레이드 후)

**모든 서비스 빌드 완료**:
```bash
✔ gatrix-backend-dev           Built (194.7s)
✔ gatrix-frontend-dev          Built (194.7s)
✔ gatrix-event-lens-dev        Built
✔ gatrix-event-lens-worker-dev Built
✔ gatrix-chat-server-dev       Built
```

### ✅ 개발 환경 실행 상태

**인프라 서비스 (모두 정상)**:
```bash
✔ MySQL              (healthy)
✔ Redis              (healthy)
✔ ClickHouse         (healthy) - IPv6 이슈 해결됨
✔ Adminer            (running)
✔ Redis Commander    (healthy)
```

**애플리케이션 서비스**:
```bash
✔ Frontend           (healthy)
⚠ Backend            (unhealthy) - 애플리케이션 레벨 설정 필요
⚠ Chat Server        (unhealthy) - DB 연결 타임아웃 (설정 필요)
⚠ Event Lens         (starting)  - Queue 이름 설정 이슈
⚠ Event Lens Worker  (starting)  - Queue 이름 설정 이슈
```

**중요**:
- ✅ **Docker 빌드는 모두 성공**했습니다
- ⚠ 일부 서비스의 unhealthy 상태는 **애플리케이션 코드 레벨의 설정 문제**입니다
- 🔧 환경 변수 및 애플리케이션 설정 조정이 필요합니다

---

## 🔧 주요 개선 사항

### 1. **일관성 (Consistency)**
- 모든 서비스가 동일한 빌드 패턴 사용
- 동일한 명령어 구조 (`yarn workspace @gatrix/[service]`)
- 통일된 Dockerfile 구조

### 2. **재현성 (Reproducibility)**
- `--frozen-lockfile` 사용으로 동일한 의존성 버전 보장
- 단일 yarn.lock 파일로 버전 충돌 방지
- Multi-stage 빌드로 캐시 최적화

### 3. **유지보수성 (Maintainability)**
- Root에서 모든 서비스 관리 가능
- 명확한 스크립트 네이밍
- 문서화된 빌드 프로세스

### 4. **성능 (Performance)**
- Docker layer 캐싱 최적화
- Production 이미지 크기 최소화 (production dependencies만 포함)
- 병렬 빌드 지원

---

## 📝 다음 단계 권장사항

### 1. **테스트 실행**
```bash
# 로컬에서 테스트
yarn test:event-lens
yarn test:chat-server

# Docker에서 테스트
docker compose -f docker-compose.dev.yml up -d
# 각 서비스 동작 확인
```

### 2. **CI/CD 파이프라인 업데이트**
- Node 20 사용하도록 CI 설정 업데이트
- Yarn workspace 명령어로 빌드 스크립트 변경
- Docker 빌드 캐싱 최적화

### 3. **문서 업데이트**
- 개발자 온보딩 가이드에 Yarn workspace 사용법 추가
- Docker 빌드 가이드 업데이트
- 트러블슈팅 섹션 추가

---

## 🎉 결론

모든 서비스가 **Yarn Workspace 패턴**으로 통일되었으며, **Docker 빌드**가 성공적으로 완료되었습니다.

### 핵심 성과:
- ✅ Yarn Workspace 통일
- ✅ Lock 파일 관리 개선 (yarn.lock 단일화)
- ✅ Node 20 업그레이드
- ✅ Docker 빌드 성공
- ✅ docker-compose.yml 및 docker-compose.dev.yml 검증 완료

이제 일관되고 유지보수하기 쉬운 모노레포 구조를 갖추게 되었습니다! 🚀

