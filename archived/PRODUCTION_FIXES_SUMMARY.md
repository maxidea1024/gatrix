# 프로덕션 배포 준비 - 변경사항 요약

## 🎯 목표
프로덕션 환경에서 localhost 하드코딩으로 인한 문제를 해결하고, Docker 컨테이너 간 통신이 정상 작동하도록 설정

---

## 📝 변경사항 상세

### 1. docker-compose.yml 수정

#### Backend CORS_ORIGIN
```yaml
# Before
CORS_ORIGIN: ${CORS_ORIGIN:-http://localhost:3000}

# After
CORS_ORIGIN: ${CORS_ORIGIN:-http://frontend:80}
```
**이유**: 프로덕션에서 frontend 컨테이너는 localhost가 아닌 서비스명으로 접근

#### Frontend VITE_API_URL
```yaml
# Before
VITE_API_URL: ${VITE_API_URL:-http://localhost:5000/api/v1}

# After
VITE_API_URL: ${VITE_API_URL:-/api/v1}
```
**이유**: 상대 경로 사용으로 Nginx 프록시를 통해 backend 접근

#### Chat Server CORS_ORIGIN
```yaml
# Before
CORS_ORIGIN: ${CORS_ORIGIN:-http://localhost:3000}

# After
CORS_ORIGIN: ${CORS_ORIGIN:-http://frontend:80}
```

#### Healthcheck 수정 (모든 서비스)
```yaml
# Before
test: ["CMD", "node", "-e", "require('http').get('http://localhost:PORT/health', ...)"]

# After
test: ["CMD", "node", "-e", "require('http').get('http://127.0.0.1:PORT/health', ...)"]
```
**이유**: 컨테이너 내부에서는 localhost 대신 127.0.0.1 사용

---

### 2. packages/backend/src/config/index.ts 수정

```typescript
// Before
corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',

// After
corsOrigin: process.env.CORS_ORIGIN || (process.env.NODE_ENV === 'production' ? 'http://frontend:80' : 'http://localhost:3000'),
frontendUrl: process.env.FRONTEND_URL || (process.env.NODE_ENV === 'production' ? 'http://frontend:80' : 'http://localhost:3000'),
```
**이유**: 환경에 따라 동적으로 기본값 설정

---

### 3. packages/chat-server/src/config/index.ts 수정

```typescript
// Before
get origin() {
  const corsEnv = process.env.CORS_ORIGIN || 'http://localhost:5173,http://localhost:3000,http://localhost:3002';
  const list = corsEnv.split(',');
  return list.includes('*') ? '*' : list;
}

// After
get origin() {
  const defaultOrigins = process.env.NODE_ENV === 'production' 
    ? 'http://frontend:80' 
    : 'http://localhost:5173,http://localhost:3000,http://localhost:3002';
  const corsEnv = process.env.CORS_ORIGIN || defaultOrigins;
  const list = corsEnv.split(',');
  return list.includes('*') ? '*' : list;
}
```

---

### 4. packages/frontend/docker-entrypoint.sh 수정

```bash
# Before
API_URL=${VITE_API_URL:-"http://localhost:5000/api/v1"}

# After
# In production, use relative path for API calls (same origin)
# In development, use absolute URL
API_URL=${VITE_API_URL:-"/api/v1"}
```

---

### 5. packages/backend/src/index.ts 수정

```typescript
// Before
logger.info(`Health check available at http://localhost:${config.port}/health`);
logger.info(`API available at http://localhost:${config.port}/api/v1`);

// After
logger.info(`Health check available at http://127.0.0.1:${config.port}/health`);
logger.info(`API available at http://127.0.0.1:${config.port}/api/v1`);
```
**이유**: 로그 메시지 일관성 (컨테이너 내부 접근)

---

### 6. 새 파일 생성

#### .env.production.example
프로덕션 환경 변수 템플릿 파일
- 모든 필수 환경 변수 포함
- 주석으로 설명 추가
- 보안 관련 주의사항 포함

---

## 🔄 Docker 네트워크 통신 흐름

### 프로덕션 환경
```
Frontend (Nginx:80)
    ↓
Nginx 프록시 (/api → backend:5000)
    ↓
Backend (Node:5000)
    ↓
MySQL (mysql:3306)
Redis (redis:6379)
Chat Server (chat-server:3001)
Event Lens (clickhouse:8123)
```

### 개발 환경
```
Frontend (localhost:3000)
    ↓
Vite 프록시 (/api → localhost:5000)
    ↓
Backend (localhost:5000)
    ↓
MySQL (localhost:3306)
Redis (localhost:6379)
```

---

## ✅ 검증 완료

- [x] TypeScript 빌드 성공
- [x] Docker 빌드 성공 (모든 5개 서비스)
- [x] 환경 변수 설정 검증
- [x] 네트워크 통신 경로 검증

---

## 🚀 배포 준비 상태

**상태**: ✅ 프로덕션 배포 준비 완료

다음 단계:
1. `.env` 파일 생성 및 프로덕션 값 설정
2. 데이터베이스 마이그레이션 실행
3. `docker-compose up -d` 실행
4. 헬스체크 및 기능 테스트

