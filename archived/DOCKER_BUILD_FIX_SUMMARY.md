# Docker Build 문제 해결 요약

## ✅ 최종 상태: 모든 문제 해결 완료

**빌드 성공:**

```bash
✔ gatrix-event-lens   Built
✔ gatrix-chat-server  Built
```

**최종 해결책:** Yarn Workspace 패턴 통일 + Node 20 업그레이드

---

## 🐛 발생했던 문제들

### 1차 문제: 빌드 컨텍스트 경로 문제

Docker Compose 빌드 중 다음 에러가 발생했습니다:

```
ERROR [event-lens builder 6/7] COPY src ./src
ERROR [chat-server builder 6/7] COPY src ./src
failed to solve: "/src": not found
```

### 2차 문제: Node 버전 호환성

```
error glob@11.0.3: The engine "node" is incompatible with this module.
Expected version "20 || >=22". Got "18.20.8"
```

## 🔍 원인 분석

### 1. 빌드 컨텍스트 경로 문제

**문제**: Dockerfile이 루트 디렉토리(`.`)에서 빌드되도록 docker-compose.yml에 설정되어 있었지만, Dockerfile 내부에서는 패키지 디렉토리 내부의 파일들을 복사하려고 시도했습니다.

```yaml
# docker-compose.yml
event-lens:
  build:
    context: . # 루트 디렉토리
    dockerfile: packages/event-lens/Dockerfile
```

```dockerfile
# packages/event-lens/Dockerfile (수정 전)
COPY package*.json ./  # ❌ 루트에서 찾으려고 시도
COPY src ./src         # ❌ 루트에서 src를 찾으려고 시도
```

### 2. package-lock.json 동기화 문제

**문제**: `npm ci` 명령은 `package.json`과 `package-lock.json`이 완벽하게 동기화되어 있어야 하는데, monorepo 구조에서 각 패키지의 의존성이 루트의 lock 파일과 맞지 않았습니다.

```
npm error `npm ci` can only install packages when your package.json and
package-lock.json are in sync.
npm error Invalid: lock file's winston-daily-rotate-file@4.7.1 does not
satisfy winston-daily-rotate-file@5.0.0
```

## ✅ 최종 해결 방법

### 1. **Yarn Workspace 패턴으로 통일** ⭐

모든 서비스(backend, frontend, event-lens, chat-server)를 동일한 Yarn Workspace 빌드 패턴으로 통일했습니다.

**최종 Dockerfile 구조 (Multi-Stage Build):**

```dockerfile
# Base stage
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Dependencies stage
FROM base AS deps
WORKDIR /app
COPY package.json yarn.lock* ./
COPY packages/[service]/package.json ./packages/[service]/
RUN yarn install --frozen-lockfile --production=false

# Builder stage
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN yarn workspace @gatrix/[service] build

# Production stage
FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app
COPY package.json yarn.lock* ./
COPY packages/[service]/package.json ./packages/[service]/
RUN yarn install --frozen-lockfile --production=true && yarn cache clean
COPY --from=builder /app/packages/[service]/dist ./packages/[service]/dist
CMD ["node", "packages/[service]/dist/index.js"]
```

### 2. **Node 20으로 업그레이드**

최신 패키지 호환성을 위해 Node 18에서 Node 20으로 업그레이드했습니다.

```dockerfile
# 변경 전
FROM node:18-alpine

# 변경 후
FROM node:20-alpine
```

### 3. **Lock 파일 통일**

package-lock.json을 제거하고 yarn.lock만 사용하도록 통일했습니다.

```bash
# package-lock.json 제거
rm package-lock.json

# yarn.lock 업데이트
yarn install
```

---

## 📝 이전 시도 (참고용)

### 시도 1: Dockerfile 경로 수정 (부분 해결)

빌드 컨텍스트가 루트이므로, Dockerfile에서 파일을 복사할 때 `packages/` 경로를 포함하도록 수정했습니다.

```dockerfile
# 수정 전
COPY package*.json ./
COPY src ./src

# 수정 후
COPY packages/event-lens/package*.json ./
COPY packages/event-lens/src ./src
```

**결과:** 경로 문제는 해결되었으나 npm ci 동기화 문제 발생

### 시도 2: npm ci → npm install 변경 (임시 해결)

`npm ci`는 lock 파일과의 완벽한 동기화를 요구하므로, monorepo 환경에서는 `npm install`을 사용하도록 변경했습니다.

**결과:** 빌드는 성공했으나 npm과 yarn이 혼재되어 일관성 문제 발생

---

## 🎯 최종 해결책의 장점

### 1. **일관성 (Consistency)**

- 모든 서비스가 동일한 빌드 패턴 사용
- Backend, Frontend와 동일한 구조
- 명확한 명령어 규칙 (`yarn workspace @gatrix/[service]`)

### 2. **재현성 (Reproducibility)**

- `--frozen-lockfile` 사용으로 동일한 의존성 버전 보장
- 단일 yarn.lock 파일로 버전 충돌 방지
- CI/CD 환경에서 안정적인 빌드

### 3. **성능 (Performance)**

- Multi-stage 빌드로 Docker layer 캐싱 최적화
- Production 이미지 크기 최소화
- 병렬 빌드 지원

### 4. **유지보수성 (Maintainability)**

- Root에서 모든 서비스 관리 가능
- 통일된 스크립트 구조
- 명확한 문서화

---

## 📝 최종 수정된 파일

### 1. packages/event-lens/Dockerfile

```dockerfile
# Base stage
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Dependencies stage
FROM base AS deps
WORKDIR /app
COPY package.json yarn.lock* ./
COPY packages/event-lens/package.json ./packages/event-lens/
RUN yarn install --frozen-lockfile --production=false

# Builder stage
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN yarn workspace @gatrix/event-lens build

# Production stage
FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app
COPY package.json yarn.lock* ./
COPY packages/event-lens/package.json ./packages/event-lens/
RUN yarn install --frozen-lockfile --production=true && yarn cache clean
COPY --from=builder /app/packages/event-lens/dist ./packages/event-lens/dist
RUN mkdir -p logs
CMD ["node", "packages/event-lens/dist/index.js"]
```

### 2. packages/chat-server/Dockerfile

```dockerfile
# Base stage
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat dumb-init
WORKDIR /app

# Dependencies stage
FROM base AS deps
WORKDIR /app
COPY package.json yarn.lock* ./
COPY packages/chat-server/package.json ./packages/chat-server/
RUN yarn install --frozen-lockfile --production=false

# Builder stage
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN yarn workspace @gatrix/chat-server build

# Production stage
FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S chatserver -u 1001

COPY package.json yarn.lock* ./
COPY packages/chat-server/package.json ./packages/chat-server/
RUN yarn install --frozen-lockfile --production=true && yarn cache clean

COPY --from=builder /app/packages/chat-server/dist ./packages/chat-server/dist

# Create uploads directory
RUN mkdir -p uploads && chown -R chatserver:nodejs uploads

# Switch to non-root user
USER chatserver

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node packages/chat-server/dist/health-check.js

# Start the application
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "packages/chat-server/dist/index.js"]
```

### 3. docker-compose.dev.yml

모든 서비스 명령어를 yarn workspace로 변경:

```yaml
backend-dev:
  command: yarn workspace @gatrix/backend dev

frontend-dev:
  command: yarn workspace @gatrix/frontend dev

event-lens-dev:
  command: yarn workspace @gatrix/event-lens dev

event-lens-worker-dev:
  command: yarn workspace @gatrix/event-lens dev:worker

chat-server-dev:
  command: yarn workspace @gatrix/chat-server dev
```

### 4. package.json (Root)

모든 서비스 관리 스크립트 추가:

```json
{
  "scripts": {
    "dev:event-lens": "yarn workspace @gatrix/event-lens dev",
    "dev:chat-server": "yarn workspace @gatrix/chat-server dev",
    "build:event-lens": "yarn workspace @gatrix/event-lens build",
    "build:chat-server": "yarn workspace @gatrix/chat-server build",
    "lint": "yarn workspaces run lint",
    "typecheck": "yarn workspaces run typecheck"
  }
}
```

---

## 🚀 빌드 결과

```bash
$ docker compose build --no-cache event-lens chat-server

[+] Building 45.7s (39/39) FINISHED
 ✔ gatrix-event-lens   Built
 ✔ gatrix-chat-server  Built

Successfully built:
- docker.io/library/gatrix-event-lens:latest
- docker.io/library/gatrix-chat-server:latest
```

**검증:**

```bash
✅ docker compose -f docker-compose.yml config --quiet
✅ docker compose -f docker-compose.dev.yml config --quiet
```

---

## 📚 학습 포인트

### 1. Yarn Workspace의 장점

- **일관성**: 모든 서비스가 동일한 빌드 패턴 사용
- **재현성**: `--frozen-lockfile`로 동일한 의존성 보장
- **효율성**: 공통 의존성 공유로 디스크 공간 절약
- **관리 용이성**: Root에서 모든 서비스 관리

### 2. Multi-Stage Docker Build

- **Base Stage**: 공통 설정 (Node, 시스템 패키지)
- **Deps Stage**: 의존성 설치 (캐싱 최적화)
- **Builder Stage**: 애플리케이션 빌드
- **Runner Stage**: 프로덕션 실행 (최소 이미지)

### 3. Node 버전 관리

- 최신 패키지 호환성을 위해 Node 20 사용
- Alpine 이미지로 이미지 크기 최소화
- 보안 업데이트 및 성능 개선

### 4. Lock 파일 전략

| 파일                | 사용 여부 | 이유                           |
| ------------------- | --------- | ------------------------------ |
| `yarn.lock`         | ✅ 사용   | Yarn Workspace 표준, 단일 소스 |
| `package-lock.json` | ❌ 제거   | npm과 충돌, 불필요             |

## ⚠️ 주의사항

### 1. **Node 버전 일치**

- 모든 Dockerfile에서 Node 20 사용
- 로컬 개발 환경도 Node 20 권장

### 2. **Lock 파일 관리**

- `yarn.lock`만 사용, `package-lock.json` 생성 금지
- 의존성 추가 시 `yarn add` 사용 (npm install 금지)

### 3. **Docker 캐시**

- `--frozen-lockfile` 사용으로 재현 가능한 빌드 보장
- 의존성 변경 시 캐시 무효화로 재빌드 필요

### 4. **Workspace 명령어**

- 개별 패키지에서 직접 명령 실행 금지
- 항상 `yarn workspace @gatrix/[service]` 패턴 사용

---

## ✅ 검증 및 테스트

### 빌드 검증

```bash
# 프로덕션 빌드
docker compose build --no-cache event-lens chat-server

# 개발 환경 검증
docker compose -f docker-compose.dev.yml config --quiet

# 프로덕션 환경 검증
docker compose -f docker-compose.yml config --quiet
```

### 실행 테스트

```bash
# 프로덕션 환경 실행
docker compose up -d event-lens chat-server

# 개발 환경 실행
docker compose -f docker-compose.dev.yml up -d event-lens-dev chat-server-dev

# 로그 확인
docker compose logs -f event-lens chat-server

# Health check 확인
curl http://localhost:3002/health  # Event Lens
curl http://localhost:3001/health  # Chat Server
```

### 로컬 개발 테스트

```bash
# 의존성 설치
yarn install

# 개발 모드 실행
yarn dev:event-lens
yarn dev:chat-server

# 빌드 테스트
yarn build:event-lens
yarn build:chat-server

# 린트 및 타입체크
yarn lint
yarn typecheck
```

---

## 🎉 결론

모든 Docker 빌드 문제가 해결되었으며, **Yarn Workspace 패턴**으로 통일되어 일관되고 유지보수하기 쉬운 구조를 갖추게 되었습니다!

### 핵심 성과:

- ✅ Yarn Workspace 통일 완료
- ✅ Node 20 업그레이드 완료
- ✅ Lock 파일 단일화 (yarn.lock)
- ✅ Docker 빌드 성공
- ✅ 프로덕션/개발 환경 모두 검증 완료

### 다음 단계:

1. CI/CD 파이프라인 업데이트
2. 개발자 문서 업데이트
3. 프로덕션 배포 테스트
