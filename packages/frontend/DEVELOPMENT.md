# Frontend Development Guide

## Environment Configuration

The frontend supports two development environments:

### 1. Docker Development (권장)

Docker 환경에서는 자동으로 올바른 설정이 적용됩니다.

```bash
# 루트 디렉토리에서
docker compose -f docker-compose.dev.yml up -d frontend-dev

# 로그 확인
docker compose -f docker-compose.dev.yml logs -f frontend-dev
```

**자동 설정:**
- `DOCKER_ENV=true` (docker-compose.dev.yml에서 자동 설정)
- Backend URL: `http://backend-dev:5000`
- Frontend: `http://localhost:3000`

### 2. Local Development (yarn dev)

로컬 환경에서 개발할 때는 `.env.local` 파일을 생성해야 합니다.

```bash
# packages/frontend 디렉토리에서
cp .env.example .env.local

# .env.local 파일 편집 (필요시)
# BACKEND_PORT=5000  # Backend가 실행 중인 포트

# Backend 먼저 실행 (packages/backend 디렉토리에서)
cd ../backend
yarn dev

# Frontend 실행 (packages/frontend 디렉토리에서)
cd ../frontend
yarn dev
```

**자동 설정:**
- `DOCKER_ENV` 미설정 또는 `false`
- Backend URL: `http://localhost:5000` (또는 `BACKEND_PORT` 환경 변수)
- Frontend: `http://localhost:3000`

## Vite Proxy 자동 감지

`vite.config.ts`는 환경을 자동으로 감지하여 프록시를 설정합니다:

```typescript
// Docker 환경
DOCKER_ENV=true → target: 'http://backend-dev:5000'

// 로컬 환경
DOCKER_ENV=false 또는 미설정 → target: 'http://localhost:5000'
```

시작 시 콘솔에 다음과 같은 로그가 표시됩니다:

```
🔧 Vite proxy configuration: {
  isDocker: false,
  backendUrl: 'http://localhost:5000',
  environment: 'development'
}
```

## 환경 변수

### Frontend 환경 변수 (.env.local)

```bash
# Docker 환경 플래그 (자동 설정됨)
DOCKER_ENV=false

# Backend 포트 (로컬 개발용)
BACKEND_PORT=5000

# Vite 환경 변수
VITE_API_URL=http://localhost:5000/api/v1
VITE_APP_NAME=Gatrix
VITE_DEFAULT_LANGUAGE=ko
```

### Backend 포트 설정

- **Docker**: `5000` (docker-compose.dev.yml에서 설정)
- **Local**: `5000` (packages/backend/.env 또는 기본값)

## 문제 해결

### 1. "Failed to fetch" 에러

**증상:** API 요청이 실패하고 "Failed to fetch" 에러 발생

**원인:** Backend가 실행되지 않았거나 잘못된 포트로 프록시 설정됨

**해결:**
```bash
# Backend가 실행 중인지 확인
# Docker 환경
docker compose -f docker-compose.dev.yml ps backend-dev

# 로컬 환경
# packages/backend 디렉토리에서
yarn dev
```

### 2. Proxy 에러 (ECONNREFUSED)

**증상:** `[vite] http proxy error: Error: connect ECONNREFUSED`

**원인:**
- Docker 환경: `DOCKER_ENV=true`가 설정되지 않음
- 로컬 환경: Backend 포트가 잘못 설정됨

**해결:**
```bash
# Docker 환경
# docker-compose.dev.yml에 DOCKER_ENV=true가 있는지 확인

# 로컬 환경
# .env.local 파일 확인
cat .env.local
# BACKEND_PORT가 실제 backend 포트와 일치하는지 확인
```

### 3. OAuth 리다이렉트 에러

**증상:** GitHub OAuth 로그인 후 "redirect_uri mismatch" 에러

**원인:** GitHub OAuth 앱 설정의 callback URL이 잘못됨

**해결:**
- GitHub OAuth 앱 설정에서 Authorization callback URL을 다음으로 설정:
  - Docker: `http://localhost:3000/api/v1/auth/github/callback`
  - Local: `http://localhost:3000/api/v1/auth/github/callback`

## 개발 팁

### Hot Reload

- Docker와 로컬 환경 모두 Hot Reload 지원
- 파일 변경 시 자동으로 브라우저 새로고침

### 디버깅

```bash
# Vite 프록시 로그 확인
# vite.config.ts에서 자동으로 출력되는 로그 확인

# Backend 로그 확인
# Docker
docker compose -f docker-compose.dev.yml logs -f backend-dev

# Local
# packages/backend 터미널에서 확인
```

### 빌드

```bash
# 프로덕션 빌드
yarn build

# 빌드 결과 미리보기
yarn preview
```

## 환경별 체크리스트

### Docker 환경 ✅

- [ ] `docker-compose.dev.yml`에 `DOCKER_ENV: "true"` 설정됨
- [ ] Backend 컨테이너 실행 중
- [ ] Frontend 컨테이너 실행 중
- [ ] `http://localhost:3000` 접속 가능
- [ ] Vite 로그에 `backendUrl: 'http://backend-dev:5000'` 표시

### 로컬 환경 ✅

- [ ] `.env.local` 파일 생성됨
- [ ] `BACKEND_PORT` 설정 확인
- [ ] Backend가 `localhost:5000`에서 실행 중
- [ ] Frontend가 `localhost:3000`에서 실행 중
- [ ] Vite 로그에 `backendUrl: 'http://localhost:5000'` 표시

## 참고

- Vite 설정: `vite.config.ts`
- Docker 설정: `../../docker-compose.dev.yml`
- Backend 설정: `../backend/.env`

